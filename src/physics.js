import {
  CART_SIZE,
  CART_X_LIMIT,
  GRAVITY,
  PLAYER_HITBOX,
  POWER_MAX_VELOCITY,
  POWER_MIN_VELOCITY,
  SEA_FLOOR_Y,
  WATER_Y,
} from "./config.js";
import { clamp, degToRad, isPointInsideRect } from "./math.js";

// Forma fechada da trajetoria: o vento e uma aceleracao horizontal constante.
export function projectileAt(origin, velocity, wind, time, gravity = GRAVITY) {
  return {
    x: origin.x + velocity.x * time + (wind * time * time) / 2,
    y: origin.y + velocity.y * time - (gravity * time * time) / 2,
  };
}

export function projectileVelocityAt(velocity, wind, time, gravity = GRAVITY) {
  return { x: velocity.x + wind * time, y: velocity.y - gravity * time };
}

export function getProjectileOrigin(player) {
  const muzzleDistance = 6.5;
  const rotation = degToRad(player.angle);

  return {
    x: player.position.x - Math.sin(rotation) * muzzleDistance,
    y: player.position.y + 3 + Math.cos(rotation) * muzzleDistance,
  };
}

export function getLaunchVelocity(angle, speed) {
  const radians = degToRad(angle + 90);
  return { x: speed * Math.cos(radians), y: speed * Math.sin(radians) };
}

export function powerToVelocity(power) {
  return POWER_MIN_VELOCITY + clamp(power, 0, 1) * (POWER_MAX_VELOCITY - POWER_MIN_VELOCITY);
}

export function velocityToPower(velocity) {
  return clamp((velocity - POWER_MIN_VELOCITY) / (POWER_MAX_VELOCITY - POWER_MIN_VELOCITY), 0, 1);
}

// Converte a mira "virada + elevacao" para o angulo legado (0 = vertical, positivo = esquerda).
export function aimToAngle(facing, elevation) {
  return facing > 0 ? elevation - 90 : 90 - elevation;
}

export function angleToAim(angle) {
  const facing = angle <= 0 ? 1 : -1;
  return { facing, elevation: facing > 0 ? angle + 90 : 90 - angle };
}

// Altura do terreno por interpolacao linear das amostras do mapa; fora dele e fundo do mar.
export function terrainHeightAt(map, x) {
  const position = (x - map.minX) / map.step;
  const index = Math.floor(position);
  if (index < 0 || index >= map.heights.length - 1) {
    return SEA_FLOOR_Y;
  }
  const fraction = position - index;
  return map.heights[index] + (map.heights[index + 1] - map.heights[index]) * fraction;
}

export function isInsideCrater(point, craters) {
  return craters.some((crater) => Math.hypot(point.x - crater.x, point.y - crater.y) <= crater.r);
}

// Terreno e predios sao solidos, menos onde as explosoes abriram crateras.
export function isSolid(point, map, craters = []) {
  const insideGround = point.y <= terrainHeightAt(map, point.x)
    || map.colliders.some((collider) => isPointInsideRect(point, collider));
  return insideGround && !isInsideCrater(point, craters);
}

export function isInWater(point) {
  return point.y <= WATER_Y;
}

export function isOutOfBounds(point) {
  return point.x < -400 || point.x > 400;
}

export function isInsidePlayerHitbox(point, player) {
  return (
    point.x >= player.position.x - PLAYER_HITBOX.halfWidth &&
    point.x <= player.position.x + PLAYER_HITBOX.halfWidth &&
    point.y >= player.position.y + PLAYER_HITBOX.minY &&
    point.y <= player.position.y + PLAYER_HITBOX.maxY
  );
}

export function getPlayerCenter(player) {
  return { x: player.position.x, y: player.position.y + 2 };
}

// O carrinho se apoia quando ha solido logo abaixo de alguma das rodas.
export function isCartSupported(position, map, craters) {
  return (
    isSolid({ x: position.x - 2.5, y: position.y - 2.5 }, map, craters) ||
    isSolid({ x: position.x + 2.5, y: position.y - 2.5 }, map, craters)
  );
}

function isCartEmbedded(position, map, craters) {
  return [-3, 0, 3].some((offset) => isSolid({ x: position.x + offset, y: position.y - 1 }, map, craters));
}

export function isCartSunk(position) {
  return position.y - 2 <= WATER_Y;
}

// Busca de cima para baixo o primeiro ponto em que o carrinho fica apoiado.
export function placeOnGround(x, map, craters = [], startY = WATER_Y + 90) {
  for (let y = startY; y > WATER_Y; y -= 0.25) {
    if (isCartSupported({ x, y }, map, craters)) {
      return isCartSunk({ x, y }) ? null : y;
    }
  }
  return null;
}

// Move o carrinho seguindo o relevo: sobe rampas ate ~55 graus, desce ladeiras e
// recusa paredes, rampas ingremes e qualquer passo que leve para dentro do mar.
export function moveCartOnGround(position, dx, map, craters) {
  const x = position.x + dx;
  if (Math.abs(x) > CART_X_LIMIT) {
    return null;
  }
  const direction = Math.sign(dx);
  const edgeX = x + direction * CART_SIZE;
  const wallAhead = map.colliders.some((collider) =>
    isPointInsideRect({ x: edgeX, y: position.y + 1 }, collider) ||
    isPointInsideRect({ x: edgeX, y: position.y + 3.5 }, collider));
  if (wallAhead && !isInsideCrater({ x: edgeX, y: position.y + 1 }, craters)) {
    return null;
  }

  const maxStep = Math.abs(dx) * 1.5 + 0.05;
  let y = position.y;
  let climbed = 0;
  while (isCartEmbedded({ x, y }, map, craters)) {
    if (climbed > maxStep) {
      return null;
    }
    y += 0.1;
    climbed += 0.1;
  }

  let descended = 0;
  while (!isCartSupported({ x, y }, map, craters) && descended <= maxStep) {
    y -= 0.1;
    descended += 0.1;
  }

  const next = { x, y };
  const supported = isCartSupported(next, map, craters);
  if (next.y - 2 < WATER_Y + 1 || (!supported && terrainHeightAt(map, x) <= WATER_Y + 1)) {
    return null;
  }
  return next;
}
