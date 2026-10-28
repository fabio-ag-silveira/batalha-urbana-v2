import { CITY_GEN, ISLAND_GEN, STREET_Y } from "./config.js";
import { clamp, createRng } from "./math.js";
import { isCartSupported, placeOnGround, sampleIsland } from "./physics.js";

const ISLAND_STEP = 1;
const BUILDING_HALF_WIDTH = 6.5;
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

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Dimensoes iguais aos desenhos de scene.js: meia altura 14 * scaleY a partir da origem.
function createBuilding(type, x, baseY, scaleY) {
  const originY = baseY + 14 * scaleY;
  const top = type === "small" ? originY + 10.5 * scaleY : originY + 14 * scaleY;
  const colliders = [{ x, y: (baseY + top) / 2, halfWidth: BUILDING_HALF_WIDTH, halfHeight: (top - baseY) / 2 }];
  if (type === "tower") {
    colliders.push({ x, y: top + 3 * scaleY, halfWidth: 2.5 * scaleY, halfHeight: 3 * scaleY });
  }
  return { type, x, y: originY, scaleY, top, roofTop: type === "tower" ? top + 6 * scaleY : top, colliders };
}

function pickBuildingType(rng) {
  const roll = rng();
  return roll < 0.15 ? "tower" : roll < 0.6 ? "large" : "small";
}

// Cidade com o visual original, mas com densidade, becos e alturas sorteados a cada rodada.
function generateCity(rng) {
  const densities = Object.entries(CITY_GEN.densities).map(([id, value]) => ({ id, ...value }));
  const density = pickWeighted(rng, densities);
  const half = CITY_GEN.buildingWidth / 2;
  const buildings = [];
  const gaps = [];

  let x = CITY_GEN.minX + half + rng() * 8;
  gaps.push({ left: -198, right: x - half });
  while (x <= CITY_GEN.maxX - half) {
    const type = pickBuildingType(rng);
    const scaleY = type === "tower" ? between(rng, [0.85, 1.15]) : between(rng, CITY_GEN.scaleY);
    buildings.push(createBuilding(type, x, CITY_GEN.baseY, scaleY));
    const alley = rng() < density.alleyChance;
    const gap = alley ? between(rng, CITY_GEN.alleyGap) : between(rng, CITY_GEN.blockGap);
    gaps.push({ left: x + half, right: x + half + gap });
    x += CITY_GEN.buildingWidth + gap;
  }
  gaps[gaps.length - 1].right = Math.min(gaps[gaps.length - 1].right, 198);

  const alleys = gaps.filter((gap) => gap.right - gap.left >= CITY_GEN.minSpawnAlley);
  return { density: density.id, buildings, alleys };
}

function islandShape(rng, left, width, topY, thickness, type) {
  const samples = Math.ceil(width / ISLAND_STEP) + 1;
  const roughness = type === "rocky" ? 2.2 : 1.1;
  const waves = Array.from({ length: 2 }, () => ({
    frequency: 1 + rng() * 2,
    phase: rng() * Math.PI * 2,
  }));
  const bellyCenter = 0.35 + rng() * 0.3;
  const top = [];
  const bottom = [];

  for (let index = 0; index < samples; index += 1) {
    const u = index / (samples - 1);
    const rim = smoothstep(0, 0.12, u) * smoothstep(0, 0.12, 1 - u);
    let height = topY - (1 - rim) * 2.5;
    waves.forEach((wave) => {
      height += Math.sin(Math.PI * 2 * wave.frequency * u + wave.phase) * roughness * 0.5;
    });
    // Parte de baixo em cone irregular, mais funda perto do "umbigo" da ilha.
    const belly = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.7 + 0.3 * Math.cos((u - bellyCenter) * Math.PI));
    const depth = Math.max(1.5, thickness * belly + (rng() - 0.5) * 3);
    top.push(height);
    bottom.push(height - depth);
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
  const surfaceAt = (x) => sampleIsland(island, x).top;
  const spotsAlong = (count, margin = 3) => Array.from({ length: count }, () =>
    island.left + margin + rng() * (island.right - island.left - margin * 2));

  if (island.type === "village") {
    const wanted = island.right - island.left > 50 && rng() < 0.6 ? 2 : 1;
    for (let attempt = 0; attempt < 12 && buildings.length < wanted; attempt += 1) {
      const x = island.left + 9 + rng() * (island.right - island.left - 18);
      if (buildings.some((building) => Math.abs(building.x - x) < 15)) {
        continue;
      }
      const base = Math.min(surfaceAt(x - BUILDING_HALF_WIDTH * 0.6), surfaceAt(x), surfaceAt(x + BUILDING_HALF_WIDTH * 0.6)) - 1.5;
      const type = rng() < 0.2 ? "tower" : rng() < 0.5 ? "large" : "small";
      buildings.push(createBuilding(type, x, base, 0.45 + rng() * 0.2));
    }
  }

  if (island.type === "ruins") {
    spotsAlong(2 + Math.floor(rng() * 3), 5).forEach((x) => {
      const height = 3 + rng() * 6;
      const base = surfaceAt(x) - 1;
      buildings.push({
        type: "column",
        x,
        base,
        top: base + height,
        colliders: [{ x, y: base + height / 2, halfWidth: 1.2, halfHeight: height / 2 }],
      });
    });
  }

  const occupied = (x) => buildings.some((building) => Math.abs(building.x - x) < (building.type === "column" ? 2.5 : 8));
  const addDecor = (kind, count, size, margin = 3) => {
    spotsAlong(count, margin).filter((x) => !occupied(x)).forEach((x) => {
      decor.push({ kind, x, y: surfaceAt(x), size: between(rng, size), variant: rng() });
    });
  };

  const width = island.right - island.left;
  if (island.type === "grove") {
    addDecor("pine", Math.max(1, Math.round(width / 14)), [4, 9]);
    addDecor("tree", Math.max(1, Math.round(width / 22)), [3, 6]);
    addDecor("bush", 1 + Math.floor(rng() * 3), [1, 2]);
  } else if (island.type === "rocky") {
    addDecor("rock", 2 + Math.floor(rng() * 4), [1, 2.5]);
    addDecor("crystal", 1 + Math.floor(rng() * 3), [2.5, 5.5]);
  } else if (island.type === "village") {
    addDecor("bush", 1 + Math.floor(rng() * 3), [1, 2]);
    addDecor("tree", rng() < 0.6 ? 1 : 0, [3, 5]);
  } else {
    addDecor("rock", 1 + Math.floor(rng() * 3), [1, 2]);
    addDecor("bush", rng() < 0.5 ? 1 : 0, [1, 1.6]);
  }

  // Raizes penduradas na parte de baixo.
  const rootCount = island.type === "rocky" ? Math.floor(rng() * 2) : 2 + Math.floor(rng() * 4);
  spotsAlong(rootCount, 4).forEach((x) => {
    decor.push({ kind: "root", x, y: sampleIsland(island, x).bottom, size: 2 + rng() * 6, variant: rng() });
  });

  return { decor, buildings };
}

function generateIslands(rng, city) {
  const types = Object.values(ISLAND_GEN.types);
  const count = Math.round(between(rng, ISLAND_GEN.count));
  const islands = [];

  for (let attempt = 0; attempt < 300 && islands.length < count; attempt += 1) {
    const width = between(rng, ISLAND_GEN.width);
    const left = between(rng, [ISLAND_GEN.minX, ISLAND_GEN.maxX - width]);
    const right = left + width;
    const thickness = between(rng, ISLAND_GEN.thickness);
    let topY = between(rng, ISLAND_GEN.topY);

    // Folga acima dos telhados que ficam embaixo da ilha.
    const roofs = city.buildings
      .filter((building) => building.x + BUILDING_HALF_WIDTH > left && building.x - BUILDING_HALF_WIDTH < right)
      .map((building) => building.roofTop);
    const minBottom = Math.max(-12.5, ...roofs) + ROOF_CLEARANCE;
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
    const island = { ...candidate, type, step: ISLAND_STEP, ...islandShape(rng, left, width, topY, thickness, type) };
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
    if (Math.abs(x) <= 190) {
      points.push({ x, y: STREET_Y, kind: "street", group: "city" });
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
  const city = generateCity(rng);
  const islands = generateIslands(rng, city);
  const colliders = [
    ...city.buildings.flatMap((building) => building.colliders),
    ...islands.flatMap((island) => island.buildings.flatMap((building) => building.colliders)),
  ];
  const map = { seed, city, islands, colliders, spawnPoints: [] };
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
