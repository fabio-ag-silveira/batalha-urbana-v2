import {
  CART_SIZE,
  CART_X_LIMIT,
  GRAVITY,
  PLAYER_HITBOX,
  POWER_MAX_VELOCITY,
  POWER_MIN_VELOCITY,
  STATIC_COLLIDERS,
  STREET_Y,
} from "./config.js";
import { clamp, degToRad, isPointInsideRect } from "./math.js";

const BUILDING_COLLIDERS = STATIC_COLLIDERS.filter((collider) => !collider.kind);
const FIXED_COLLIDERS = STATIC_COLLIDERS.filter((collider) => collider.kind);

// Forma fechada da trajetoria: o vento e uma aceleracao horizontal constante.
export function projectileAt(origin, velocity, wind, time) {
  return {
    x: origin.x + velocity.x * time + (wind * time * time) / 2,
    y: origin.y + velocity.y * time - (GRAVITY * time * time) / 2,
  };
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

export function isInsideCrater(point, craters) {
  return craters.some((crater) => Math.hypot(point.x - crater.x, point.y - crater.y) <= crater.r);
}

export function isBuildingSolid(point, craters = []) {
  return BUILDING_COLLIDERS.some((collider) => isPointInsideRect(point, collider)) && !isInsideCrater(point, craters);
}

export function isSolid(point, craters = []) {
  return FIXED_COLLIDERS.some((collider) => isPointInsideRect(point, collider)) || isBuildingSolid(point, craters);
}

export function isOutOfBounds(point) {
  return point.x < -400 || point.x > 400 || point.y < -50;
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

export function isCartSupported(position, craters) {
  if (position.y <= STREET_Y + 0.001) {
    return true;
  }
  return (
    isBuildingSolid({ x: position.x - 2.5, y: position.y - 2.5 }, craters) ||
    isBuildingSolid({ x: position.x + 2.5, y: position.y - 2.5 }, craters)
  );
}

export function isCartBlocked(x, y, direction, craters) {
  if (Math.abs(x) > CART_X_LIMIT) {
    return true;
  }
  const edgeX = x + direction * CART_SIZE;
  return isBuildingSolid({ x: edgeX, y: y + 1 }, craters) || isBuildingSolid({ x: edgeX, y: y + 3.5 }, craters);
}
