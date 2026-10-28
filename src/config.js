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
export const CART_X_LIMIT = 200;
export const PROJECTILE_SUBSTEP = 0.01;
export const PHASE_DELAYS = {
  roundStart: 1600,
  settle: 700,
  timeout: 400,
  roundOver: 2600,
  matchOver: 8000,
};

// Mar e arquipelago: o nivel da agua e o antigo nivel da rua, na base da camera.
export const WATER_Y = -16;
export const SEA_FLOOR_Y = -26;
export const MAP_GEN = {
  minX: -210,
  maxX: 210,
  usableMinX: -195,
  usableMaxX: 195,
  islandCount: [3, 4],
  islandWidth: [60, 120],
  channelWidth: [25, 45],
  baseHeight: [6, 20],
  maxHeight: 34,
  buildingsPerIsland: [1, 3],
  minSpawnDistance: 80,
};

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
  spawnY: 100,
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
    water: "rgba(38, 124, 186, 0.8)",
    waterDeep: "#174a6e",
    waterLine: "rgba(255, 255, 255, 0.6)",
    sand: "#e3c78a",
    soil: "#8b6b43",
    rock: "#5d5248",
    grass: "#5fa34a",
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
    water: "rgba(88, 66, 124, 0.82)",
    waterDeep: "#2a1f45",
    waterLine: "rgba(255, 200, 160, 0.5)",
    sand: "#d8a878",
    soil: "#6e4b3a",
    rock: "#463644",
    grass: "#5b7a46",
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
    water: "rgba(18, 34, 74, 0.86)",
    waterDeep: "#060b1c",
    waterLine: "rgba(160, 190, 255, 0.4)",
    sand: "#8c7f63",
    soil: "#3d3328",
    rock: "#2a2630",
    grass: "#2f4d33",
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
