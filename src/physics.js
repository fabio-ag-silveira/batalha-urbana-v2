import {
  CART_SIZE,
  CART_X_LIMIT,
  GRAVITY,
  PLAYER_HITBOX,
  POWER_MAX_VELOCITY,
  POWER_MIN_VELOCITY,
  FIXED_COLLIDERS,
  STREET_Y,
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

// Topo e fundo de uma ilha em x (curvas amostradas a cada island.step); null fora dela.
export function sampleIsland(island, x) {
  if (x < island.left || x > island.right) {
    return null;
  }
  const position = (x - island.left) / island.step;
  const index = Math.min(Math.floor(position), island.top.length - 2);
  const fraction = position - index;
  return {
    top: island.top[index] + (island.top[index + 1] - island.top[index]) * fraction,
    bottom: island.bottom[index] + (island.bottom[index + 1] - island.bottom[index]) * fraction,
  };
}

export function findIslandAt(map, x) {
  return map.islands.find((island) => x >= island.left && x <= island.right) ?? null;
}

export function isInsideCrater(point, craters) {
  return craters.some((crater) => Math.hypot(point.x - crater.x, point.y - crater.y) <= crater.r);
}

function isInsideIsland(point, map) {
  return map.islands.some((island) => {
    const sample = sampleIsland(island, point.x);
    return sample !== null && point.y <= sample.top && point.y >= sample.bottom;
  });
}

// Solidos destrutiveis: predios da cidade, ilhas e o que ha sobre elas (menos crateras).
export function isCartSolid(point, map, craters = []) {
  const inside = map.colliders.some((collider) => isPointInsideRect(point, collider)) || isInsideIsland(point, map);
  return inside && !isInsideCrater(point, craters);
}

// Para projeteis: tambem o chao da rua e as paredes laterais, que ignoram crateras.
export function isSolid(point, map, craters = []) {
  return FIXED_COLLIDERS.some((collider) => isPointInsideRect(point, collider)) || isCartSolid(point, map, craters);
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

// O carrinho se apoia na rua ou quando ha solido logo abaixo de alguma das rodas.
export function isCartSupported(position, map, craters) {
  if (position.y <= STREET_Y + 0.001) {
    return true;
  }
  return (
    isCartSolid({ x: position.x - 2.5, y: position.y - 2.5 }, map, craters) ||
    isCartSolid({ x: position.x + 2.5, y: position.y - 2.5 }, map, craters)
  );
}

function isCartEmbedded(position, map, craters) {
  return [-3, 0, 3].some((offset) => isCartSolid({ x: position.x + offset, y: position.y - 1 }, map, craters));
}

// Busca de cima para baixo o primeiro ponto em que o carrinho fica apoiado (no pior caso, a rua).
export function placeOnGround(x, map, craters = [], startY = 140) {
  for (let y = startY; y > STREET_Y; y -= 0.25) {
    if (isCartSupported({ x, y }, map, craters) && !isCartEmbedded({ x, y }, map, craters)) {
      return y;
    }
  }
  return STREET_Y;
}

// Move o carrinho seguindo o relevo: sobe rampas ate ~55 graus, desce ladeiras e
// para em paredes. Sair da borda de uma ilha e permitido: o carrinho cai.
export function moveCartOnGround(position, dx, map, craters) {
  const x = position.x + dx;
  if (Math.abs(x) > CART_X_LIMIT) {
    return null;
  }
  const direction = Math.sign(dx);
  const edgeX = x + direction * CART_SIZE;
  const wallAhead = [position.y + 1, position.y + 3.5].some((y) =>
    map.colliders.some((collider) => isPointInsideRect({ x: edgeX, y }, collider)) &&
    !isInsideCrater({ x: edgeX, y }, craters));
  if (wallAhead) {
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
    y = Math.max(STREET_Y, y - 0.1);
    descended += 0.1;
  }
  return { x, y };
}
