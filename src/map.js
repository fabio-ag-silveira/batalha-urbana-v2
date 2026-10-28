import { MAP_GEN, SEA_FLOOR_Y, WATER_Y } from "./config.js";
import { clamp, createRng } from "./math.js";
import { isCartSupported, placeOnGround, terrainHeightAt } from "./physics.js";

const STEP = 1;
const BEACH = 0.18;
const BUILDING_HALF_WIDTH = 6.5;

function between(rng, [min, max]) {
  return min + rng() * (max - min);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Distribui as ilhas na largura util: larguras e canais sorteados, depois escalados para caber.
function layoutIslands(rng) {
  const count = Math.round(between(rng, MAP_GEN.islandCount));
  const widths = Array.from({ length: count }, () => between(rng, MAP_GEN.islandWidth));
  const channels = Array.from({ length: count - 1 }, () => between(rng, MAP_GEN.channelWidth));
  const usable = MAP_GEN.usableMaxX - MAP_GEN.usableMinX;
  const channelTotal = channels.reduce((sum, value) => sum + value, 0);
  const scale = Math.min(1, (usable - channelTotal) / widths.reduce((sum, value) => sum + value, 0));
  const totalWidth = widths.reduce((sum, value) => sum + value * scale, 0) + channelTotal;

  let left = MAP_GEN.usableMinX + (usable - totalWidth) * rng();
  return widths.map((width, index) => {
    const island = { left, right: left + width * scale };
    left = island.right + (channels[index] ?? 0);
    return island;
  });
}

function islandProfile(rng, island) {
  const base = between(rng, MAP_GEN.baseHeight);
  const waves = Array.from({ length: 2 + Math.floor(rng() * 2) }, () => ({
    amplitude: 1 + rng() * 3,
    frequency: 1 + rng() * 2.5,
    phase: rng() * Math.PI * 2,
  }));
  const hill = rng() < 0.6
    ? { center: 0.25 + rng() * 0.5, height: 4 + rng() * 10, width: 0.08 + rng() * 0.1 }
    : null;

  return (x) => {
    const u = (x - island.left) / (island.right - island.left);
    if (u <= 0 || u >= 1) {
      return null;
    }
    const edge = smoothstep(0, BEACH, u) * smoothstep(0, BEACH, 1 - u);
    let height = base + 6;
    waves.forEach((wave) => {
      height += wave.amplitude * Math.sin(Math.PI * 2 * wave.frequency * u + wave.phase);
    });
    if (hill) {
      height += hill.height * Math.exp(-((u - hill.center) ** 2) / (2 * hill.width ** 2));
    }
    return WATER_Y - 6 + Math.min(MAP_GEN.maxHeight + 6, Math.max(2, height)) * edge;
  };
}

// Dimensoes dos predios iguais aos desenhos de scene.js (meia altura 14 * scaleY).
function createBuilding(rng, x, base) {
  const roll = rng();
  const type = roll < 0.4 ? "small" : roll < 0.8 ? "large" : "tower";
  const scaleY = type === "tower" ? 1 : 0.6 + rng() * 0.5;
  const originY = base + 14 * scaleY;
  const top = type === "small" ? originY + 10.5 * scaleY : originY + 14 * scaleY;
  const colliders = [{ x, y: (base + top) / 2, halfWidth: BUILDING_HALF_WIDTH, halfHeight: (top - base) / 2 }];
  if (type === "tower") {
    colliders.push({ x, y: top + 3, halfWidth: 2.5, halfHeight: 3, roof: true });
  }
  return { type, x, y: originY, scaleY, top, colliders };
}

function placeBuildings(rng, map, island) {
  const candidates = [];
  for (let x = island.left + 12; x <= island.right - 12; x += 2) {
    const samples = [-BUILDING_HALF_WIDTH, -3, 0, 3, BUILDING_HALF_WIDTH].map((dx) => terrainHeightAt(map, x + dx));
    const low = Math.min(...samples);
    if (Math.max(...samples) - low < 3 && low >= WATER_Y + 3) {
      candidates.push({ x, base: low - 3 });
    }
  }

  const wanted = Math.round(between(rng, MAP_GEN.buildingsPerIsland));
  const buildings = [];
  while (buildings.length < wanted && candidates.length) {
    const [pick] = candidates.splice(Math.floor(rng() * candidates.length), 1);
    if (buildings.every((building) => Math.abs(building.x - pick.x) >= 15)) {
      buildings.push(createBuilding(rng, pick.x, pick.base));
    }
  }
  return buildings;
}

function findSpawnPoints(map) {
  const points = [];
  map.islands.forEach((island, islandIndex) => {
    for (let x = island.left + 8; x <= island.right - 8; x += 3) {
      const y = placeOnGround(x, map);
      if (y === null || y - 2 < WATER_Y + 2) {
        continue;
      }
      const onTower = map.buildings.some((building) => building.type === "tower" && Math.abs(building.x - x) <= 10);
      if (onTower) {
        continue;
      }
      const onRoof = map.colliders.some((collider) => Math.abs(collider.x - x) <= collider.halfWidth + 3);
      const slope = Math.abs(terrainHeightAt(map, x + 3) - terrainHeightAt(map, x - 3));
      if ((onRoof || slope < 3) && isCartSupported({ x, y }, map, [])) {
        points.push({ x, y, island: islandIndex });
      }
    }
  });
  return points;
}

function hasValidPair(points) {
  return points.some((first) => points.some((second) =>
    second.island !== first.island && Math.abs(second.x - first.x) >= MAP_GEN.minSpawnDistance));
}

function buildMap(seed) {
  const rng = createRng(seed);
  const islands = layoutIslands(rng);
  const profiles = islands.map((island) => islandProfile(rng, island));
  const heights = [];
  for (let x = MAP_GEN.minX; x <= MAP_GEN.maxX; x += STEP) {
    const height = profiles.reduce((best, profile) => {
      const value = profile(x);
      return value === null ? best : Math.max(best, value);
    }, SEA_FLOOR_Y);
    heights.push(height);
  }

  const map = { seed, minX: MAP_GEN.minX, step: STEP, heights, islands, buildings: [], colliders: [] };
  islands.forEach((island) => {
    placeBuildings(rng, map, island).forEach((building) => {
      map.buildings.push(building);
      map.colliders.push(...building.colliders);
    });
  });
  map.spawnPoints = findSpawnPoints(map);
  return map;
}

// O mapa inteiro sai da seed; se ela gerar algo injogavel, tenta seeds vizinhas.
export function generateMap(seed) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const map = buildMap((seed + attempt * 7919) >>> 0);
    if (map.islands.length >= 2 && hasValidPair(map.spawnPoints)) {
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

export function pickSpawnPair(map, random = Math.random) {
  const pairs = [];
  map.spawnPoints.forEach((first) => map.spawnPoints.forEach((second) => {
    if (second.island !== first.island && Math.abs(second.x - first.x) >= MAP_GEN.minSpawnDistance) {
      pairs.push([first, second]);
    }
  }));
  return pairs[Math.floor(random() * pairs.length)];
}
