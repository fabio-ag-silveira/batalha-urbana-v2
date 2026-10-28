import { CITY_GEN, GROUND_GEN, ISLAND_GEN } from "./config.js";
import { clamp, createRng } from "./math.js";
import { groundHeightAt, isCartSupported, placeOnGround, sampleIsland } from "./physics.js";

const STEP = 1;
const ROOF_CLEARANCE = 14;
const MAX_ISLAND_TOP = 125;

function between(rng, [min, max]) {
  return min + rng() * (max - min);
}

function pickWeighted(rng, options) {
  let roll = rng() * options.reduce((sum, option) => sum + option.weight, 0);
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      return option;
    }
  }
  return options[options.length - 1];
}

// Chao: ondas longas + morros + vale opcional + ruido fino interpolado.
function generateGround(rng) {
  const waves = Array.from({ length: Math.round(between(rng, GROUND_GEN.waves)) }, () => ({
    amplitude: between(rng, GROUND_GEN.waveAmplitude),
    wavelength: between(rng, GROUND_GEN.wavelength),
    phase: rng() * Math.PI * 2,
  }));
  const hills = Array.from({ length: Math.round(between(rng, GROUND_GEN.hills)) }, () => ({
    center: between(rng, [-170, 170]),
    height: between(rng, GROUND_GEN.hillHeight),
    width: between(rng, GROUND_GEN.hillWidth),
  }));
  const valley = rng() < GROUND_GEN.valleyChance
    ? { center: between(rng, [-160, 160]), depth: between(rng, GROUND_GEN.valleyDepth), width: between(rng, [25, 45]) }
    : null;
  const noise = Array.from({ length: Math.ceil((GROUND_GEN.maxX - GROUND_GEN.minX) / 4) + 2 }, () => rng() * 2 - 1);

  const heights = [];
  for (let x = GROUND_GEN.minX; x <= GROUND_GEN.maxX; x += STEP) {
    let height = GROUND_GEN.base;
    waves.forEach((wave) => {
      height += wave.amplitude * Math.sin((Math.PI * 2 * x) / wave.wavelength + wave.phase);
    });
    hills.forEach((hill) => {
      height += hill.height * Math.exp(-((x - hill.center) ** 2) / (2 * (hill.width / 2.5) ** 2));
    });
    if (valley) {
      height -= valley.depth * Math.exp(-((x - valley.center) ** 2) / (2 * (valley.width / 2.5) ** 2));
    }
    const noisePosition = (x - GROUND_GEN.minX) / 4;
    const index = Math.floor(noisePosition);
    const fraction = noisePosition - index;
    height += (noise[index] + (noise[index + 1] - noise[index]) * fraction) * GROUND_GEN.roughness;
    heights.push(clamp(height, GROUND_GEN.minY, GROUND_GEN.maxY));
  }
  return { minX: GROUND_GEN.minX, step: STEP, heights };
}

// Dimensoes iguais aos desenhos de scene.js: meia altura 14 * scaleY a partir da origem.
function createBuilding(type, x, baseY, scaleY, halfWidth) {
  const originY = baseY + 14 * scaleY;
  const top = type === "small" ? originY + 10.5 * scaleY : originY + 14 * scaleY;
  const colliders = [{ x, y: (baseY + top) / 2, halfWidth: halfWidth + 0.5, halfHeight: (top - baseY) / 2 }];
  if (type === "tower") {
    colliders.push({ x, y: top + 3 * scaleY, halfWidth: (2.5 * halfWidth) / 6, halfHeight: 3 * scaleY });
  }
  return { type, x, y: originY, scaleY, halfWidth, top, roofTop: type === "tower" ? top + 6 * scaleY : top, colliders };
}

function pickBuildingType(rng) {
  const roll = rng();
  return roll < 0.15 ? "tower" : roll < 0.6 ? "large" : "small";
}

function footprint(map, x, halfWidth) {
  const samples = [];
  for (let dx = -halfWidth; dx <= halfWidth; dx += 1) {
    samples.push(groundHeightAt(map, x + dx));
  }
  return { low: Math.min(...samples), high: Math.max(...samples) };
}

// Cidade com o visual original: larguras, alturas, densidade e becos sorteados, assentada no relevo.
function generateCity(rng, map) {
  const densities = Object.entries(CITY_GEN.densities).map(([id, value]) => ({ id, ...value }));
  const density = pickWeighted(rng, densities);
  const buildings = [];
  const openings = [];
  const addOpening = (left, right) => {
    const last = openings[openings.length - 1];
    if (last && left - last.right < 0.5) {
      last.right = right;
    } else {
      openings.push({ left, right });
    }
  };

  let cursor = CITY_GEN.minX + rng() * 8;
  addOpening(-198, cursor);
  while (cursor < CITY_GEN.maxX) {
    const type = pickBuildingType(rng);
    // Torre de relogio larga demais vira "celeiro": fica sempre esguia.
    const halfWidth = type === "tower" ? between(rng, [4, 7]) : between(rng, CITY_GEN.halfWidth);
    const x = cursor + halfWidth;
    if (x + halfWidth > CITY_GEN.maxX) {
      break;
    }
    const ground = footprint(map, x, halfWidth);
    if (ground.high - ground.low > CITY_GEN.maxSlope) {
      // Encosta ingreme demais para construir: vira espaco aberto.
      addOpening(cursor, cursor + halfWidth * 2);
      cursor += halfWidth * 2;
      continue;
    }
    const scaleY = type === "tower" ? between(rng, [0.85, 1.25]) : between(rng, CITY_GEN.scaleY);
    buildings.push(createBuilding(type, x, ground.low - 3, scaleY, halfWidth));
    const alley = rng() < density.alleyChance;
    const gap = alley ? between(rng, CITY_GEN.alleyGap) : between(rng, CITY_GEN.blockGap);
    addOpening(x + halfWidth, x + halfWidth + gap);
    cursor = x + halfWidth + gap;
  }
  addOpening(cursor, 198);

  const alleys = openings
    .map((opening) => ({ left: opening.left, right: Math.min(opening.right, 198) }))
    .filter((opening) => opening.right - opening.left >= CITY_GEN.minSpawnAlley);
  return { density: density.id, buildings, alleys };
}

// Laje quase plana com bordas lascadas e a parte de baixo angular, como concreto arrancado.
function islandShape(rng, left, width, topY, thickness) {
  const samples = Math.ceil(width / STEP) + 1;
  const chips = {
    left: { width: 1 + rng() * 3, depth: 0.6 + rng() * 1.6 },
    right: { width: 1 + rng() * 3, depth: 0.6 + rng() * 1.6 },
  };
  const controls = [{ u: 0, depth: 1.2 }];
  const breaks = 3 + Math.floor(rng() * 4);
  for (let index = 1; index <= breaks; index += 1) {
    const u = index / (breaks + 1) + (rng() - 0.5) * 0.08;
    const belly = Math.sin(Math.PI * u);
    controls.push({ u, depth: Math.max(2, thickness * belly * (0.55 + rng() * 0.45)) });
    if (rng() < 0.35) {
      // Degrau: mesma posicao, outra profundidade.
      controls.push({ u: u + 0.02, depth: Math.max(2, thickness * belly * (0.55 + rng() * 0.45)) });
    }
  }
  controls.push({ u: 1, depth: 1.2 });
  controls.sort((a, b) => a.u - b.u);

  const top = [];
  const bottom = [];
  for (let index = 0; index < samples; index += 1) {
    const u = index / (samples - 1);
    const offset = index * STEP;
    let height = topY;
    if (offset < chips.left.width) {
      height -= chips.left.depth;
    } else if (width - offset < chips.right.width) {
      height -= chips.right.depth;
    }
    const next = controls.findIndex((control) => control.u >= u);
    const after = controls[Math.max(1, next)];
    const before = controls[Math.max(0, next - 1)];
    const t = after.u === before.u ? 0 : (u - before.u) / (after.u - before.u);
    const depth = before.depth + (after.depth - before.depth) * clamp(t, 0, 1);
    top.push(height);
    bottom.push(height - Math.max(1, depth));
  }
  return { top, bottom };
}

function overlaps(a, b) {
  return (
    a.left - ISLAND_GEN.gapX < b.right && b.left - ISLAND_GEN.gapX < a.right &&
    a.bottomY - ISLAND_GEN.gapY < b.topY && b.bottomY - ISLAND_GEN.gapY < a.topY
  );
}

function decorateIsland(rng, island) {
  const decor = [];
  const buildings = [];
  const width = island.right - island.left;
  const surfaceAt = (x) => sampleIsland(island, x).top;
  const spot = (margin) => island.left + margin + rng() * (width - margin * 2);

  if (island.type === "block") {
    const wanted = width > 45 && rng() < 0.6 ? 2 : 1;
    for (let attempt = 0; attempt < 12 && buildings.length < wanted; attempt += 1) {
      const halfWidth = between(rng, [4, 7]);
      const x = spot(halfWidth + 3);
      if (buildings.some((building) => Math.abs(building.x - x) < building.halfWidth + halfWidth + 3)) {
        continue;
      }
      const base = Math.min(surfaceAt(x - halfWidth), surfaceAt(x), surfaceAt(x + halfWidth)) - 1;
      buildings.push(createBuilding(rng() < 0.5 ? "large" : "small", x, base, between(rng, [0.45, 0.75]), halfWidth));
    }
  }

  if (island.type === "rubble") {
    const halfWidth = between(rng, [3, 6]);
    const x = spot(halfWidth + 3);
    const base = surfaceAt(x) - 1;
    const height = between(rng, [4, 9]);
    buildings.push({
      type: "stub",
      x,
      base,
      top: base + height,
      halfWidth,
      jag: Array.from({ length: 5 }, () => rng()),
      colliders: [{ x, y: base + height / 2, halfWidth, halfHeight: height / 2 }],
    });
  }

  const free = (x, room) => buildings.every((building) => Math.abs(building.x - x) > building.halfWidth + room);
  const add = (kind, count, size, margin = 3, room = 2) => {
    for (let index = 0; index < count; index += 1) {
      const x = spot(margin);
      if (free(x, room)) {
        decor.push({ kind, x, y: surfaceAt(x), size: between(rng, size), variant: rng() });
      }
    }
  };

  if (island.type === "rooftop") {
    add("tank", 1, [3, 4.5], 6, 4);
    add("antenna", 1 + Math.floor(rng() * 2), [5, 10], 4);
    add("ac", 1 + Math.floor(rng() * 3), [1.2, 2]);
  } else if (island.type === "plaza") {
    add("lamp", 1 + Math.floor(rng() * 2), [6, 8], 4);
    add("bench", rng() < 0.7 ? 1 : 0, [2.5, 3.5], 5);
    add("cone", Math.floor(rng() * 3), [1, 1.4]);
  } else if (island.type === "block") {
    add("ac", Math.floor(rng() * 2), [1.2, 1.8]);
  } else {
    add("debris", 2 + Math.floor(rng() * 3), [0.8, 2]);
  }

  // Vergalhoes espetados nas bordas quebradas e canos pendurados embaixo.
  [island.left, island.right].forEach((edge, side) => {
    const count = 1 + Math.floor(rng() * 3);
    for (let index = 0; index < count; index += 1) {
      const x = edge + (side === 0 ? 1 : -1) * (0.5 + rng() * 2);
      const sample = sampleIsland(island, x);
      decor.push({
        kind: "rebar",
        x,
        y: sample.bottom + (sample.top - sample.bottom) * (0.3 + rng() * 0.5),
        size: 2 + rng() * 3,
        variant: side === 0 ? -1 : 1,
      });
    }
  });
  const pipes = 1 + Math.floor(rng() * 3);
  for (let index = 0; index < pipes; index += 1) {
    const x = spot(5);
    decor.push({ kind: "pipe", x, y: sampleIsland(island, x).bottom, size: 2 + rng() * 6, variant: rng() });
  }

  return { decor, buildings };
}

function generateIslands(rng, map, city) {
  const types = Object.values(ISLAND_GEN.types);
  const count = Math.round(between(rng, ISLAND_GEN.count));
  const islands = [];

  for (let attempt = 0; attempt < 300 && islands.length < count; attempt += 1) {
    const width = between(rng, ISLAND_GEN.width);
    const left = between(rng, [ISLAND_GEN.minX, ISLAND_GEN.maxX - width]);
    const right = left + width;
    const thickness = between(rng, ISLAND_GEN.thickness);
    let topY = between(rng, ISLAND_GEN.topY);

    // Folga acima dos telhados e do morro que ficam embaixo da ilha.
    const roofs = city.buildings
      .filter((building) => building.x + building.halfWidth > left && building.x - building.halfWidth < right)
      .map((building) => building.roofTop);
    const minBottom = Math.max(footprint(map, (left + right) / 2, width / 2).high, ...roofs) + ROOF_CLEARANCE;
    if (topY - thickness < minBottom) {
      topY = minBottom + thickness;
    }
    if (topY > MAX_ISLAND_TOP) {
      continue;
    }

    const candidate = { left, right, topY, bottomY: topY - thickness };
    if (islands.some((island) => overlaps(island, candidate))) {
      continue;
    }

    const type = pickWeighted(rng, types).id;
    const island = { ...candidate, type, step: STEP, ...islandShape(rng, left, width, topY, thickness) };
    Object.assign(island, decorateIsland(rng, island));
    islands.push(island);
  }

  islands.sort((a, b) => a.left - b.left);
  return islands;
}

function findSpawnPoints(map) {
  const points = [];
  const blocked = (x) => map.colliders.some((collider) => Math.abs(collider.x - x) <= collider.halfWidth + 3);

  map.islands.forEach((island, index) => {
    for (let x = island.left + 8; x <= island.right - 8; x += 4) {
      const sample = sampleIsland(island, x);
      if (blocked(x)) {
        continue;
      }
      const y = placeOnGround(x, map, [], sample.top + 6);
      if (y > sample.top && isCartSupported({ x, y }, map, [])) {
        points.push({ x, y, kind: "island", group: `island-${index}` });
      }
    }
  });

  map.city.buildings.filter((building) => building.type !== "tower").forEach((building) => {
    const y = placeOnGround(building.x, map, [], building.top + 6);
    if (y > building.top) {
      points.push({ x: building.x, y, kind: "roof", group: "city" });
    }
  });

  map.city.alleys.forEach((alley) => {
    const x = (alley.left + alley.right) / 2;
    const slope = Math.abs(groundHeightAt(map, x + 3) - groundHeightAt(map, x - 3));
    if (Math.abs(x) <= 190 && slope < 4 && !blocked(x)) {
      points.push({ x, y: placeOnGround(x, map, [], groundHeightAt(map, x) + 8), kind: "street", group: "city" });
    }
  });
  return points;
}

function validPairs(points) {
  const pairs = [];
  points.forEach((first, i) => points.forEach((second, j) => {
    if (j > i && Math.abs(second.x - first.x) >= ISLAND_GEN.minSpawnDistance) {
      pairs.push([first, second]);
    }
  }));
  return pairs;
}

function buildMap(seed) {
  const rng = createRng(seed);
  const map = { seed, ground: generateGround(rng), islands: [], colliders: [], spawnPoints: [] };
  map.city = generateCity(rng, map);
  map.islands = generateIslands(rng, map, map.city);
  map.colliders = [
    ...map.city.buildings.flatMap((building) => building.colliders),
    ...map.islands.flatMap((island) => island.buildings.flatMap((building) => building.colliders)),
  ];
  map.spawnPoints = findSpawnPoints(map);
  return map;
}

function isPlayable(map) {
  const hasLeft = map.islands.some((island) => (island.left + island.right) / 2 < -40);
  const hasRight = map.islands.some((island) => (island.left + island.right) / 2 > 40);
  const pairs = validPairs(map.spawnPoints);
  return (
    map.islands.length >= ISLAND_GEN.count[0] && hasLeft && hasRight &&
    map.city.alleys.length >= CITY_GEN.minAlleys &&
    pairs.some((pair) => pair.some((point) => point.kind === "island"))
  );
}

// O mapa inteiro sai da seed; se ela gerar algo injogavel, tenta seeds vizinhas.
export function generateMap(seed) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const map = buildMap((seed + attempt * 7919) >>> 0);
    if (isPlayable(map)) {
      return { ...map, seed };
    }
  }
  throw new Error(`Nao foi possivel gerar um mapa para a seed ${seed}.`);
}

let cached = null;

export function getMap(seed) {
  if (cached?.seed !== seed) {
    cached = generateMap(seed);
  }
  return cached;
}

// Na maioria das rodadas pelo menos um carrinho nasce numa ilha.
export function pickSpawnPair(map, random = Math.random) {
  const pairs = validPairs(map.spawnPoints);
  const withIsland = pairs.filter((pair) => pair.some((point) => point.kind === "island"));
  const pool = withIsland.length && random() < ISLAND_GEN.islandSpawnPreference ? withIsland : pairs;
  const pair = pool[Math.floor(random() * pool.length)];
  return random() < 0.5 ? pair : [pair[1], pair[0]];
}
