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

export const BACKGROUND_COLORS = [
  "#5da3a3",
  "#8f92c9",
  "#9d9650",
];

export const GAME_MODES = {
  local: "local",
  ai: "ai",
  lan: "lan",
};

export const AI_DIFFICULTIES = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

export const DEFAULT_GAME_MODE = GAME_MODES.ai;
export const DEFAULT_AI_DIFFICULTY = AI_DIFFICULTIES.medium;
export const AI_THINK_DELAY_MS = 700;
export const AI_ANGLE_STEP = 3;
export const AI_VELOCITY_STEP = 2;
export const AI_PRESETS = {
  [AI_DIFFICULTIES.easy]: {
    label: "IA facil",
    angleStep: 9,
    velocityStep: 8,
    simulationStep: 0.08,
    aimJitter: { angle: 6, velocity: 12 },
    candidatePool: 12,
    refinement: false,
  },
  [AI_DIFFICULTIES.medium]: {
    label: "IA media",
    angleStep: 4,
    velocityStep: 3,
    simulationStep: 0.06,
    aimJitter: { angle: 2, velocity: 4 },
    candidatePool: 6,
    refinement: false,
  },
  [AI_DIFFICULTIES.hard]: {
    label: "IA dificil",
    angleStep: 3,
    velocityStep: 2,
    simulationStep: 0.03,
    aimJitter: { angle: 0, velocity: 0 },
    candidatePool: 1,
    refinement: true,
  },
};

export const PLAYER_DEFAULTS = [
  {
    id: 1,
    label: "Player 1",
    statsColor: "#0d8e98",
    controls: { up: "w", down: "s", left: "a", right: "d", fire: "f" },
    velocity: 30,
    angle: 85,
    hitTint: ["#ffffff", "#7fcfd4", "#050505"],
    accent: "#00c8d7",
    wheel: "#00c8d7",
    spawns: [
      { x: -123, y: -16 },
      { x: -90, y: 7 },
      { x: -17, y: -16 },
      { x: 150, y: 11 },
    ],
  },
  {
    id: 2,
    label: "Player 2",
    statsColor: "#9c2d2d",
    controls: { up: "i", down: "k", left: "j", right: "l", fire: "h" },
    velocity: 30,
    angle: 85,
    hitTint: ["#ff8080", "#c55c5c", "#050505"],
    accent: "#dd3232",
    wheel: "#dd3232",
    spawns: [
      { x: -180, y: 7.7 },
      { x: 60, y: 7.7 },
      { x: 120, y: -16 },
      { x: 180, y: 7.7 },
    ],
  },
];

export const CITY_LAYOUT = [
  { type: "large", x: -30, y: -5 },
  { type: "small", x: -45, y: -2, scaleY: 1.25 },
  { type: "small", x: -60, y: -5 },
  { type: "large", x: -75, y: -5 },
  { type: "small", x: -90, y: -5 },
  { type: "small", x: -105, y: -7, scaleY: 0.8 },
  { type: "large", x: -135, y: -5 },
  { type: "small", x: -150, y: -5 },
  { type: "large", x: -165, y: -5 },
  { type: "small", x: -180, y: -5 },
  { type: "tower", x: -195, y: -5 },
  { type: "large", x: 15, y: -5 },
  { type: "large", x: 30, y: -7, scaleY: 0.85 },
  { type: "tower", x: 45, y: -5 },
  { type: "small", x: 60, y: -5 },
  { type: "large", x: 75, y: -5 },
  { type: "tower", x: 90, y: -5 },
  { type: "small", x: 105, y: -5 },
  { type: "small", x: 135, y: -5 },
  { type: "large", x: 150, y: -5 },
  { type: "large", x: 165, y: -5 },
  { type: "small", x: 180, y: -5 },
];

export const STATIC_COLLIDERS = [
  { x: -30, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: -45, y: -3, halfWidth: 7, halfHeight: 15 },
  { x: -60, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: -75, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: -90, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: -105, y: -12, halfWidth: 7, halfHeight: 15 },
  { x: -135, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: -150, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: -165, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: -180, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: -195, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: -195, y: 12, halfWidth: 7, halfHeight: 3.5 },
  { x: 15, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 30, y: -8.5, halfWidth: 7, halfHeight: 15 },
  { x: 45, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 45, y: 12, halfWidth: 7, halfHeight: 3.5 },
  { x: 60, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: 75, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 90, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 90, y: 12, halfWidth: 7, halfHeight: 3.5 },
  { x: 105, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: 135, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: 150, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 165, y: -5, halfWidth: 7, halfHeight: 15 },
  { x: 180, y: -7.5, halfWidth: 7, halfHeight: 15 },
  { x: 205, y: -7.5, halfWidth: 7, halfHeight: 1500 },
  { x: -205, y: -7.5, halfWidth: 7, halfHeight: 1500 },
  { x: 0, y: -28, halfWidth: 1000, halfHeight: 15.5 },
];
