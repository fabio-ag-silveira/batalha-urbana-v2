export const VIEW_BOUNDS = {
  minX: -40,
  maxX: 40,
  minY: -40,
  maxY: 40,
};

export const CITY_TRANSFORM = {
  scaleX: 0.2,
  scaleY: 0.3,
  translateX: 0,
  translateY: -115,
};

export const GRAVITY = 9.81;
export const TIME_SCALE = 100 / 30;
export const CART_SIZE = 3.5;
export const PLAYER_HITBOX = { halfWidth: 4, minY: -2, maxY: 6 };

export const GAME_MODES = {
  local: "local",
  ai: "ai",
};

export const AI_DIFFICULTIES = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

export const DEFAULT_GAME_MODE = GAME_MODES.ai;
export const DEFAULT_AI_DIFFICULTY = AI_DIFFICULTIES.medium;
export const AI_THINK_DELAY_MS = 700;
export const AI_PRESETS = {
  [AI_DIFFICULTIES.easy]: {
    label: "IA fácil",
    angleStep: 9,
    velocityStep: 6,
    simulationStep: 0.08,
    aimJitter: { angle: 6, velocity: 5 },
    windKnowledge: 0.3,
    specialChance: 0.2,
    candidatePool: 12,
    refinement: false,
  },
  [AI_DIFFICULTIES.medium]: {
    label: "IA média",
    angleStep: 4,
    velocityStep: 3,
    simulationStep: 0.06,
    aimJitter: { angle: 2, velocity: 2 },
    windKnowledge: 0.75,
    specialChance: 0.4,
    candidatePool: 6,
    refinement: false,
  },
  [AI_DIFFICULTIES.hard]: {
    label: "IA difícil",
    angleStep: 3,
    velocityStep: 2,
    simulationStep: 0.04,
    aimJitter: { angle: 0, velocity: 0 },
    windKnowledge: 1,
    specialChance: 0.6,
    candidatePool: 1,
    refinement: true,
  },
};

export const MAX_HP = 100;
export const ROUNDS_TO_WIN = 3;
// ammo null = infinita. "split" gera fragmentos no impacto; "bounces" quica antes de explodir.
export const WEAPONS = {
  standard: {
    id: "standard", label: "Canhão", icon: "●", ammo: null,
    radius: 14, damage: 40, directBonus: 10, crater: 7, color: "#fff7e6", size: 3.4,
  },
  cluster: {
    id: "cluster", label: "Fragmentação", icon: "✸", ammo: 2,
    radius: 10, damage: 18, directBonus: 6, crater: 5, split: 4, color: "#ffb347", size: 3.8,
  },
  bounce: {
    id: "bounce", label: "Quicante", icon: "◎", ammo: 2,
    radius: 13, damage: 34, directBonus: 10, crater: 6, bounces: 2, color: "#86efac", size: 3.4,
  },
  heavy: {
    id: "heavy", label: "Pesado", icon: "⬣", ammo: 1,
    radius: 22, damage: 55, directBonus: 10, crater: 11, color: "#fca5a5", size: 4.8,
  },
  bomblet: {
    id: "bomblet", label: "Fragmento", icon: "•", ammo: null,
    radius: 9, damage: 15, directBonus: 4, crater: 4.5, color: "#ffd166", size: 2.2,
  },
};
export const WEAPON_ORDER = ["standard", "cluster", "bounce", "heavy"];
export const BOUNCE_RESTITUTION = 0.6;
export const MAX_CRATERS = 160;
export const WIND_MAX = 1.2;
export const POWER_MIN_VELOCITY = 10;
export const POWER_MAX_VELOCITY = 75;
export const CHARGE_SECONDS = 1.2;
export const AIM_SPEED = 45;
export const ELEVATION_LIMITS = { min: -15, max: 90 };
export const MOVE_SPEED = 22;
export const FUEL_PER_TURN = 40;
export const TURN_TIME_MS = 20000;
export const CART_GRAVITY = 70;
// Velocidade do empurrao de uma explosao padrao no centro; escala com o raio da arma.
export const KNOCKBACK = 28;
export const SAFE_FALL = 10;
export const CART_X_LIMIT = 194;
export const STREET_Y = -16;
export const PROJECTILE_SUBSTEP = 0.01;
export const PHASE_DELAYS = {
  roundStart: 1600,
  settle: 700,
  timeout: 400,
  roundOver: 2600,
  matchOver: 8000,
};

// Mapa procedural: cidade no chao (visual original) e ilhas flutuando no ceu.
export const CITY_GEN = {
  minX: -195,
  maxX: 195,
  buildingWidth: 12,
  baseY: -20,
  scaleY: [0.7, 1.35],
  blockGap: [1, 3],
  alleyGap: [14, 32],
  minAlleys: 2,
  minSpawnAlley: 16,
  // Chance de abrir um beco depois de cada predio, por densidade da rodada.
  densities: {
    sparse: { label: "espaçada", alleyChance: 0.55, weight: 1 },
    normal: { label: "normal", alleyChance: 0.3, weight: 2 },
    dense: { label: "densa", alleyChance: 0.12, weight: 1 },
  },
};

export const ISLAND_GEN = {
  count: [3, 6],
  width: [25, 75],
  topY: [30, 115],
  thickness: [10, 28],
  minX: -185,
  maxX: 185,
  gapX: 12,
  gapY: 22,
  types: {
    grove: { id: "grove", label: "Bosque", weight: 3 },
    rocky: { id: "rocky", label: "Rochosa", weight: 2 },
    village: { id: "village", label: "Vila", weight: 2 },
    ruins: { id: "ruins", label: "Ruína", weight: 1.5 },
  },
  minSpawnDistance: 80,
  islandSpawnPreference: 0.7,
};

// Chao da rua e paredes laterais: fixos, ignoram crateras.
export const FIXED_COLLIDERS = [
  { x: 205, y: -7.5, halfWidth: 7, halfHeight: 1500, kind: "wall" },
  { x: -205, y: -7.5, halfWidth: 7, halfHeight: 1500, kind: "wall" },
  { x: 0, y: -28, halfWidth: 1000, halfHeight: 15.5, kind: "ground" },
];

export const ROUND_MODIFIERS = {
  normal: { id: "normal", label: "Normal", weight: 4 },
  storm: { id: "storm", label: "Tempestade", weight: 1.5, windScale: 2 },
  lowGravity: { id: "lowGravity", label: "Gravidade baixa", weight: 1.5, gravityScale: 0.6 },
  fog: { id: "fog", label: "Neblina", weight: 1.5, hideWind: true, aiWindScale: 0.5 },
  arsenal: { id: "arsenal", label: "Arsenal", weight: 1.5, ammoScale: 2 },
};

export const CRATES = {
  dropChance: 0.35,
  firstTurn: 3,
  max: 2,
  spawnY: 150,
  parachuteSpeed: 9,
  freeFallSpeed: 35,
  pickupRadius: 6,
  types: {
    hp: { id: "hp", label: "Vida", amount: 30, color: "#4ade80" },
    fuel: { id: "fuel", label: "Combustível", amount: 30, color: "#ffd166" },
    ammo: { id: "ammo", label: "Munição", amount: 1, color: "#ffb347" },
  },
};

export const SKY_THEMES = {
  day: {
    id: "day",
    sky: ["#3f8fd2", "#8cc6e6", "#d8eef2"],
    body: { kind: "sun", color: "#fff6cf", glow: "rgba(255, 240, 180, 0.45)" },
    cloud: "rgba(255, 255, 255, 0.75)",
    distant: "#8fb3c6",
    citadel: { fill: "#4d6b7c", window: "#5f7f90" },
    haze: "rgba(225, 240, 245, 0.45)",
    buildings: { large: "#7a7a7a", small: "#4a4a4a", tower: "#1c1c1c" },
    windowLit: "#f6e151",
    windowDark: "#d9dfe4",
    litChance: 0.25,
    street: "#3b3d42",
    curb: "#8d9096",
    grass: "#5fa34a",
    soil: "#8b6b43",
    rock: "#6b5d52",
    foliage: "#3f8f3a",
    trunk: "#5b3f26",
    crystal: "#7dd3fc",
    root: "#4a3a2a",
    fog: "rgba(220, 232, 238, 0.55)",
    stars: false,
  },
  dusk: {
    id: "dusk",
    sky: ["#2d2457", "#b4587a", "#f4a96a"],
    body: { kind: "sun", color: "#ffcf86", glow: "rgba(255, 170, 110, 0.5)" },
    cloud: "rgba(255, 196, 170, 0.55)",
    distant: "#7a4f74",
    citadel: { fill: "#3a2440", window: "#5a3a5e" },
    haze: "rgba(244, 169, 106, 0.35)",
    buildings: { large: "#5e5560", small: "#3a3340", tower: "#17121c" },
    windowLit: "#ffd36b",
    windowDark: "#2a2430",
    litChance: 0.55,
    street: "#2b2830",
    curb: "#7a6f7e",
    grass: "#6f8f4a",
    soil: "#6e4b3a",
    rock: "#4e3c4c",
    foliage: "#4f6f3a",
    trunk: "#3f2a24",
    crystal: "#f9a8d4",
    root: "#3b2a2a",
    fog: "rgba(240, 190, 170, 0.45)",
    stars: false,
  },
  night: {
    id: "night",
    sky: ["#04071a", "#0f1a3d", "#2a3a68"],
    body: { kind: "moon", color: "#f2efdc", glow: "rgba(200, 210, 255, 0.28)" },
    cloud: "rgba(150, 165, 210, 0.22)",
    distant: "#18223f",
    citadel: { fill: "#0a0e1e", window: "#1b2340" },
    haze: "rgba(60, 80, 140, 0.3)",
    buildings: { large: "#2b3042", small: "#1d2131", tower: "#0b0d16" },
    windowLit: "#ffe27a",
    windowDark: "#141826",
    litChance: 0.75,
    street: "#15171f",
    curb: "#3c4256",
    grass: "#2f5a3a",
    soil: "#3d3328",
    rock: "#2a2636",
    foliage: "#1f4a33",
    trunk: "#2a1f18",
    crystal: "#a5b4fc",
    root: "#221a14",
    fog: "rgba(120, 140, 190, 0.4)",
    stars: true,
  },
};

export const PLAYER_DEFAULTS = [
  {
    id: 1,
    label: "Player 1",
    color: "#00c8d7",
    shade: "#0d8e98",
  },
  {
    id: 2,
    label: "Player 2",
    color: "#ff4a4a",
    shade: "#9c2d2d",
  },
];
