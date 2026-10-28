import {
  AI_DIFFICULTIES,
  AI_PRESETS,
  AI_THINK_DELAY_MS,
  AIM_SPEED,
  CART_GRAVITY,
  CART_SIZE,
  CART_X_LIMIT,
  CHARGE_SECONDS,
  CRATES,
  BOUNCE_RESTITUTION,
  DEFAULT_AI_DIFFICULTY,
  DEFAULT_GAME_MODE,
  ELEVATION_LIMITS,
  FUEL_PER_TURN,
  GAME_MODES,
  KNOCKBACK,
  GRAVITY,
  MAX_CRATERS,
  MAX_HP,
  MOVE_SPEED,
  PHASE_DELAYS,
  PLAYER_DEFAULTS,
  POWER_MAX_VELOCITY,
  POWER_MIN_VELOCITY,
  PROJECTILE_SUBSTEP,
  ROUND_MODIFIERS,
  ROUNDS_TO_WIN,
  SAFE_FALL,
  SKY_THEMES,
  TIME_SCALE,
  TURN_TIME_MS,
  STREET_Y,
  WEAPON_ORDER,
  WEAPONS,
  WIND_MAX,
} from "./config.js";
import { clamp, randomItem, randomRange } from "./math.js";
import {
  aimToAngle,
  angleToAim,
  getLaunchVelocity,
  getPlayerCenter,
  getProjectileOrigin,
  isCartSolid,
  isCartSupported,
  isInsidePlayerHitbox,
  isOutOfBounds,
  isSolid,
  moveCartOnGround,
  powerToVelocity,
  projectileAt,
  projectileVelocityAt,
  velocityToPower,
} from "./physics.js";
import { getMap, pickSpawnPair } from "./map.js";

const CONTROLS = ["up", "down", "left", "right", "fire", "weapon"];
const STANDARD = WEAPONS.standard;

function createAmmo(scale = 1) {
  return Object.fromEntries(WEAPON_ORDER.map((id) => [id, WEAPONS[id].ammo === null ? null : WEAPONS[id].ammo * scale]));
}

function pickModifier() {
  const options = Object.values(ROUND_MODIFIERS);
  let roll = Math.random() * options.reduce((sum, option) => sum + option.weight, 0);
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      return option;
    }
  }
  return ROUND_MODIFIERS.normal;
}
const MAX_EVENTS = 30;

function createInputState() {
  return Object.fromEntries(CONTROLS.map((control) => [control, false]));
}

function createPlayers(map, modifier) {
  const spawns = pickSpawnPair(map);
  return PLAYER_DEFAULTS.map((template, index) => {
    const position = { x: spawns[index].x, y: spawns[index].y };
    const other = spawns[1 - index];
    const facing = other.x >= position.x ? 1 : -1;
    return {
      id: template.id,
      label: template.label,
      color: template.color,
      shade: template.shade,
      position,
      facing,
      elevation: 45,
      angle: aimToAngle(facing, 45),
      hp: MAX_HP,
      fuel: FUEL_PER_TURN,
      bonusFuel: 0,
      lastPower: null,
      weapon: STANDARD.id,
      ammo: createAmmo(modifier.ammoScale ?? 1),
      fall: null,
    };
  });
}

function setAim(player, facing, elevation) {
  player.facing = facing;
  player.elevation = clamp(elevation, ELEVATION_LIMITS.min, ELEVATION_LIMITS.max);
  player.angle = aimToAngle(player.facing, player.elevation);
}

export class Game {
  constructor() {
    this.mode = DEFAULT_GAME_MODE;
    this.aiDifficulty = DEFAULT_AI_DIFFICULTY;
    this.events = [];
    this.eventSeq = 0;
    this.inputs = { 1: createInputState(), 2: createInputState() };
    this.aiMissMemory = new Map();
    this.resetGame();
  }

  get currentPlayer() {
    return this.players[this.turnIndex];
  }

  get opponent() {
    return this.players[1 - this.turnIndex];
  }

  get isAiTurn() {
    return this.mode === GAME_MODES.ai && this.currentPlayer.id === 2;
  }

  emit(type, data = {}) {
    this.eventSeq += 1;
    this.events.push({ id: this.eventSeq, type, ...data });
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  setPhase(phase, durationMs = 0) {
    this.phase = phase;
    this.phaseMs = durationMs;
  }

  resetGame() {
    this.round = -1;
    this.totalScore = [0, 0];
    this.matchWinner = null;
    this.resetRound();
    this.status = "Nova partida. Primeiro a vencer 3 rodadas leva!";
  }

  resetRound() {
    this.round += 1;
    this.turnIndex = this.round % 2;
    this.turnsInRound = 0;
    this.theme = randomItem(Object.keys(SKY_THEMES));
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.map = getMap(this.seed);
    this.modifier = pickModifier();
    this.gravity = GRAVITY * (this.modifier.gravityScale ?? 1);
    this.crates = [];
    this.craters = [];
    this.projectiles = [];
    this.shotStats = null;
    this.charge = { active: false, power: 0, direction: 1 };
    this.wind = 0;
    this.turnTimeMs = TURN_TIME_MS;
    this.players = createPlayers(this.map, this.modifier);
    this.aiPlan = null;
    this.aiThinkMs = 0;
    this.aiMissMemory.clear();
    this.setPhase("roundStart", PHASE_DELAYS.roundStart);
    const modifierText = this.modifier.id === "normal" ? "" : ` Condição: ${this.modifier.label}.`;
    this.status = `Rodada ${this.round + 1}. Preparem-se!${modifierText}`;
    this.emit("roundStart", { round: this.round + 1, modifier: this.modifier.id, modifierLabel: this.modifier.label });
  }

  setMode(mode) {
    if (!Object.values(GAME_MODES).includes(mode) || this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.aiPlan = null;
    this.aiThinkMs = AI_THINK_DELAY_MS;
    this.status = this.mode === GAME_MODES.ai
      ? "Modo versus IA ativado."
      : "Modo versus local ativado.";
  }

  setAiDifficulty(difficulty) {
    if (!Object.values(AI_DIFFICULTIES).includes(difficulty) || this.aiDifficulty === difficulty) {
      return;
    }

    this.aiDifficulty = difficulty;
    this.status = `Dificuldade alterada para ${AI_PRESETS[this.aiDifficulty].label}.`;
  }

  cycleAiDifficulty() {
    const order = [AI_DIFFICULTIES.easy, AI_DIFFICULTIES.medium, AI_DIFFICULTIES.hard];
    const currentIndex = order.indexOf(this.aiDifficulty);
    this.setAiDifficulty(order[(currentIndex + 1) % order.length]);
  }

  setInput(playerId, control, pressed, { cancel = false } = {}) {
    const input = this.inputs[playerId];
    if (!input || !CONTROLS.includes(control)) {
      return false;
    }
    if (this.mode === GAME_MODES.ai && playerId === 2) {
      return false;
    }

    const wasPressed = input[control];
    input[control] = pressed;

    const isTurnOwner = this.phase === "aiming" && this.currentPlayer.id === playerId;
    if (control === "weapon" && pressed && !wasPressed && isTurnOwner && !this.charge.active) {
      this.cycleWeapon(this.currentPlayer);
    }
    if (control === "fire" && pressed !== wasPressed && isTurnOwner) {
      if (pressed) {
        this.startCharge();
      } else if (this.charge.active) {
        if (cancel) {
          this.charge.active = false;
        } else {
          this.fire();
        }
      }
    }
    return true;
  }

  update(deltaMs) {
    const dt = Math.min(deltaMs, 50);
    this.phaseMs -= dt;

    switch (this.phase) {
      case "roundStart":
        if (this.phaseMs <= 0) {
          this.beginTurn();
        }
        break;
      case "aiming":
        this.updateFalling(dt);
        this.updateCrates(dt);
        this.updateAiming(dt);
        break;
      case "flying":
        this.updateFalling(dt);
        this.updateCrates(dt);
        this.updateProjectiles(dt);
        break;
      case "settling":
        this.updateCrates(dt);
        if (!this.updateFalling(dt) && this.phaseMs <= 0) {
          this.resolveTurn();
        }
        break;
      case "roundOver":
        if (this.phaseMs <= 0) {
          this.resetRound();
        }
        break;
      case "matchOver":
        if (this.phaseMs <= 0) {
          this.resetGame();
        }
        break;
      default:
        break;
    }
  }

  beginTurn() {
    this.turnsInRound += 1;
    const growth = 0.6 + 0.4 * Math.min(1, this.turnsInRound / 6);
    const windMax = WIND_MAX * (this.modifier.windScale ?? 1);
    this.wind = Math.round(randomRange(-windMax, windMax) * growth * 10) / 10;
    this.turnTimeMs = TURN_TIME_MS;
    this.charge = { active: false, power: 0, direction: 1 };
    this.aiPlan = null;
    this.aiThinkMs = AI_THINK_DELAY_MS;

    const player = this.currentPlayer;
    player.fuel = FUEL_PER_TURN + player.bonusFuel;
    player.bonusFuel = 0;
    this.setPhase("aiming");
    this.status = `Vez de ${player.label}. Mire, ajuste a força e atire!`;
    this.emit("turn", { playerId: player.id, label: player.label, wind: this.wind });
    this.maybeDropCrate();
  }

  updateAiming(dt) {
    this.turnTimeMs -= dt;
    const player = this.currentPlayer;
    const seconds = dt / 1000;
    if (this.players.some((entry) => entry.hp <= 0)) {
      this.charge.active = false;
      this.setPhase("settling", PHASE_DELAYS.settle);
      return;
    }

    if (this.isAiTurn) {
      this.updateAi(dt);
    } else if (!player.fall) {
      const input = this.inputs[player.id];
      const aimDirection = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      if (aimDirection) {
        setAim(player, player.facing, player.elevation + aimDirection * AIM_SPEED * seconds);
      }
      const moveDirection = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (moveDirection && !this.charge.active) {
        this.moveCart(player, moveDirection, seconds);
      }
    }

    if (this.phase !== "aiming") {
      return;
    }

    if (this.charge.active) {
      let power = this.charge.power + (this.charge.direction * seconds) / CHARGE_SECONDS;
      if (power >= 1) {
        power = 1;
        this.charge.direction = -1;
      } else if (power <= 0) {
        power = 0;
        this.charge.direction = 1;
      }
      this.charge.power = power;
    }

    if (this.turnTimeMs <= 0) {
      this.turnTimeMs = 0;
      if (this.charge.active) {
        this.fire("Tempo esgotado! O disparo saiu com a força atual.");
      } else {
        this.status = `Tempo esgotado! ${player.label} perdeu a vez.`;
        this.emit("timeout", { playerId: player.id });
        this.setPhase("settling", PHASE_DELAYS.timeout);
      }
    }
  }

  moveCart(player, direction, seconds) {
    if (player.facing !== direction) {
      setAim(player, direction, player.elevation);
    }
    if (player.fuel <= 0) {
      return;
    }

    const distance = Math.min(MOVE_SPEED * seconds, player.fuel);
    const next = moveCartOnGround(player.position, direction * distance, this.map, this.craters);
    if (!next) {
      return;
    }
    player.fuel = Math.max(0, player.fuel - distance);
    player.position = next;
  }

  startCharge() {
    this.charge = { active: true, power: 0, direction: 1 };
  }

  cycleWeapon(player) {
    const start = WEAPON_ORDER.indexOf(player.weapon);
    for (let step = 1; step <= WEAPON_ORDER.length; step += 1) {
      const candidate = WEAPON_ORDER[(start + step) % WEAPON_ORDER.length];
      if (player.ammo[candidate] === null || player.ammo[candidate] > 0) {
        this.selectWeapon(player, candidate);
        return;
      }
    }
  }

  selectWeapon(player, weaponId) {
    if (player.weapon === weaponId) {
      return;
    }
    player.weapon = weaponId;
    const weapon = WEAPONS[weaponId];
    const ammo = player.ammo[weaponId];
    const remaining = ammo === null ? "" : ` (${ammo} restante${ammo === 1 ? "" : "s"})`;
    this.status = `${player.label} escolheu ${weapon.label}${remaining}.`;
    this.emit("weapon", { playerId: player.id, weapon: weaponId });
  }

  fire(message) {
    const player = this.currentPlayer;
    const power = this.charge.power;
    const weapon = WEAPONS[player.weapon];
    this.charge = { active: false, power, direction: 1 };
    player.lastPower = power;
    if (weapon.ammo !== null) {
      player.ammo[weapon.id] -= 1;
    }

    const origin = getProjectileOrigin(player);
    this.emit("shot", { playerId: player.id, x: origin.x, y: origin.y, power, weapon: weapon.id });
    const velocity = getLaunchVelocity(player.angle, powerToVelocity(power));
    this.projectiles = [this.createProjectile(player.id, weapon.id, origin, velocity)];
    this.shotStats = { dealt: 0, selfDamage: 0, directTarget: null, explosions: 0 };
    if (weapon.ammo !== null && player.ammo[weapon.id] <= 0) {
      player.weapon = STANDARD.id;
    }
    this.setPhase("flying");
    this.status = message ?? `${player.label} disparou (${weapon.label}) com ${Math.round(power * 100)}% de força.`;
  }

  createProjectile(ownerId, weaponId, origin, velocity) {
    this.eventSeq += 1;
    return {
      id: this.eventSeq,
      ownerId,
      weapon: weaponId,
      origin: { ...origin },
      velocity,
      wind: this.wind,
      gravity: this.gravity,
      elapsed: 0,
      position: { ...origin },
      bounces: 0,
    };
  }

  updateProjectiles(dt) {
    let remaining = (dt / 1000) * TIME_SCALE;

    while (remaining > 0 && this.projectiles.length) {
      const step = Math.min(PROJECTILE_SUBSTEP, remaining);
      remaining -= step;
      [...this.projectiles].forEach((projectile) => this.stepProjectile(projectile, step));
    }

    if (!this.projectiles.length) {
      this.finishShot();
    }
  }

  stepProjectile(projectile, step) {
    const weapon = WEAPONS[projectile.weapon];
    const previous = projectile.position;
    projectile.elapsed += step;
    projectile.position = projectileAt(projectile.origin, projectile.velocity, projectile.wind, projectile.elapsed, projectile.gravity);

    // Fragmentos podem atingir o proprio dono; o tiro principal so depois de sair do cano.
    const ownerGrace = projectile.weapon === "bomblet" ? 0.15 : 0.5;
    const target = this.players.find((player) =>
      isInsidePlayerHitbox(projectile.position, player) &&
      (player.id !== projectile.ownerId || projectile.elapsed > ownerGrace));
    if (target) {
      this.detonate(projectile, target, previous);
      return;
    }

    // Atravessar uma caixa entrega o suprimento para quem atirou.
    const crate = this.crates.find((entry) =>
      Math.abs(entry.x - projectile.position.x) < 3.5 && Math.abs(entry.y - projectile.position.y) < 3.5);
    if (crate) {
      this.collectCrate(this.players.find((player) => player.id === projectile.ownerId), crate);
    }

    if (isSolid(projectile.position, this.map, this.craters)) {
      if (weapon.bounces && projectile.bounces < weapon.bounces && this.bounce(projectile, previous)) {
        return;
      }
      this.detonate(projectile, null, previous);
      return;
    }

    if (isOutOfBounds(projectile.position)) {
      this.removeProjectile(projectile);
      this.emit("miss", { playerId: projectile.ownerId });
    }
  }

  removeProjectile(projectile) {
    this.projectiles = this.projectiles.filter((entry) => entry !== projectile);
  }

  // Reflete a velocidade na parede (eixo x) ou no piso/teto (eixo y) e reinicia a trajetoria.
  bounce(projectile, previous) {
    const velocity = projectileVelocityAt(projectile.velocity, projectile.wind, projectile.elapsed, projectile.gravity);
    const hitWall = !isSolid({ x: previous.x, y: projectile.position.y }, this.map, this.craters);
    const reflected = hitWall
      ? { x: -velocity.x * BOUNCE_RESTITUTION, y: velocity.y * BOUNCE_RESTITUTION }
      : { x: velocity.x * BOUNCE_RESTITUTION, y: -velocity.y * BOUNCE_RESTITUTION };
    if (Math.hypot(reflected.x, reflected.y) < 6) {
      return false;
    }
    projectile.origin = { ...previous };
    projectile.position = { ...previous };
    projectile.velocity = reflected;
    projectile.elapsed = 0;
    projectile.bounces += 1;
    this.emit("bounce", { x: previous.x, y: previous.y });
    return true;
  }

  detonate(projectile, directTarget, previous) {
    const weapon = WEAPONS[projectile.weapon];
    this.removeProjectile(projectile);
    this.explode(projectile.position, directTarget, weapon, projectile.ownerId);

    if (weapon.split) {
      this.emit("split", { x: previous.x, y: previous.y });
      const spreads = [-1, -0.35, 0.35, 1];
      for (let index = 0; index < weapon.split; index += 1) {
        const velocity = {
          x: spreads[index % spreads.length] * 14 + randomRange(-2, 2),
          y: 18 + Math.random() * 8,
        };
        this.projectiles.push(this.createProjectile(projectile.ownerId, "bomblet", previous, velocity));
      }
    }
  }

  explode(point, directTarget, weapon, ownerId) {
    const attacker = this.players.find((player) => player.id === ownerId);
    this.craters.push({ x: point.x, y: point.y, r: weapon.crater });
    if (this.craters.length > MAX_CRATERS) {
      this.craters.shift();
    }
    this.emit("explosion", { x: point.x, y: point.y, radius: weapon.radius, playerId: ownerId, weapon: weapon.id });

    this.crates
      .filter((crate) => Math.hypot(crate.x - point.x, crate.y - point.y) < weapon.radius * 0.8)
      .forEach((crate) => this.loseCrate(crate, "destroyed"));

    const stats = this.shotStats;
    stats.explosions += 1;
    this.players.forEach((player) => {
      const center = getPlayerCenter(player);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      let damage = distance < weapon.radius ? weapon.damage * (1 - distance / weapon.radius) : 0;
      if (player === directTarget) {
        damage += weapon.directBonus;
      }
      damage = Math.round(damage);
      if (damage <= 0) {
        return;
      }
      this.applyDamage(player, damage);
      this.knockBack(player, point, (1 - Math.min(1, distance / weapon.radius)) * (weapon.radius / WEAPONS.standard.radius));
      if (player === attacker) {
        stats.selfDamage += damage;
      } else {
        stats.dealt += damage;
      }
    });
    if (directTarget && directTarget !== attacker) {
      stats.directTarget = directTarget;
    }
  }

  finishShot() {
    const attacker = this.currentPlayer;
    const { dealt, selfDamage, directTarget, explosions } = this.shotStats;

    if (directTarget) {
      this.status = `Acerto direto! ${directTarget.label} perdeu ${dealt} de HP.`;
    } else if (dealt > 0) {
      this.status = `${attacker.label} causou ${dealt} de dano.`;
    } else if (selfDamage > 0) {
      this.status = `Fogo amigo! ${attacker.label} se feriu (${selfDamage}).`;
    } else if (explosions > 0) {
      this.status = "Errou! O tiro atingiu o cenário.";
    } else {
      this.status = "O tiro saiu do mapa.";
    }

    if (dealt === 0) {
      this.rememberAiMiss();
    }
    this.setPhase("settling", PHASE_DELAYS.settle);
  }

  knockBack(player, point, strength) {
    if (strength <= 0.05) {
      return;
    }
    const direction = Math.sign(player.position.x - point.x) || (Math.random() < 0.5 ? -1 : 1);
    const speed = KNOCKBACK * strength;
    player.fall = {
      vx: direction * speed,
      vy: speed * 0.6,
      peakY: Math.max(player.position.y, player.fall?.peakY ?? player.position.y),
    };
  }

  applyDamage(player, amount) {
    player.hp = Math.max(0, player.hp - amount);
    this.emit("damage", {
      playerId: player.id,
      amount,
      x: player.position.x,
      y: player.position.y,
    });
  }

  updateFalling(dt) {
    const seconds = dt / 1000;
    let anyFalling = false;

    this.players.forEach((player) => {
      const supported = isCartSupported(player.position, this.map, this.craters);
      if (supported && (!player.fall || player.fall.vy <= 0)) {
        if (player.fall) {
          this.land(player);
        }
        return;
      }

      if (!player.fall) {
        player.fall = { vx: 0, vy: 0, peakY: player.position.y };
      }
      const fall = player.fall;
      fall.vy = Math.max(fall.vy - CART_GRAVITY * seconds, -120);

      // Deslocamento horizontal para ao bater em parede ou encosta.
      if (fall.vx) {
        const nextX = player.position.x + fall.vx * seconds;
        const edge = { x: nextX + Math.sign(fall.vx) * CART_SIZE, y: player.position.y + 1 };
        if (isCartSolid(edge, this.map, this.craters) || Math.abs(nextX) > CART_X_LIMIT) {
          fall.vx = 0;
        } else {
          player.position.x = nextX;
        }
      }

      let remaining = Math.abs(fall.vy) * seconds;
      const direction = Math.sign(fall.vy);
      while (remaining > 0) {
        const step = Math.min(0.25, remaining);
        remaining -= step;
        if (direction > 0 && isCartSolid({ x: player.position.x, y: player.position.y + 5 }, this.map, this.craters)) {
          fall.vy = 0;
          break;
        }
        player.position.y = Math.max(STREET_Y, player.position.y + direction * step);
        if (direction < 0 && isCartSupported(player.position, this.map, this.craters)) {
          break;
        }
      }
      fall.peakY = Math.max(fall.peakY, player.position.y);

      if (fall.vy <= 0 && isCartSupported(player.position, this.map, this.craters)) {
        this.land(player);
      } else {
        anyFalling = true;
      }
    });

    return anyFalling;
  }

  maybeDropCrate() {
    if (this.turnsInRound < CRATES.firstTurn || this.crates.length >= CRATES.max || Math.random() >= CRATES.dropChance) {
      return;
    }
    const type = randomItem(Object.keys(CRATES.types));
    this.eventSeq += 1;
    const crate = {
      id: this.eventSeq,
      type,
      x: randomRange(-185, 185),
      y: CRATES.spawnY,
      landed: false,
      parachute: true,
    };
    this.crates.push(crate);
    this.emit("crateDrop", { crateId: crate.id, crateType: type, x: crate.x });
  }

  // Caixas descem de paraquedas e pousam no que estiver solido: ilha, telhado ou rua.
  updateCrates(dt) {
    const seconds = dt / 1000;
    [...this.crates].forEach((crate) => {
      if (isSolid({ x: crate.x, y: crate.y - 1.6 }, this.map, this.craters)) {
        if (!crate.landed) {
          crate.landed = true;
          crate.parachute = false;
        }
      } else {
        crate.landed = false;
        crate.y -= (crate.parachute ? CRATES.parachuteSpeed : CRATES.freeFallSpeed) * seconds;
      }

      const collector = this.players.find((player) =>
        player.hp > 0 &&
        Math.abs(player.position.x - crate.x) < CRATES.pickupRadius &&
        Math.abs(player.position.y + 1 - crate.y) < CRATES.pickupRadius);
      if (collector) {
        this.collectCrate(collector, crate);
      }
    });
  }

  loseCrate(crate, reason) {
    this.crates = this.crates.filter((entry) => entry !== crate);
    this.emit("crateLost", { crateId: crate.id, reason, x: crate.x, y: crate.y });
  }

  collectCrate(player, crate) {
    if (!player) {
      return;
    }
    this.crates = this.crates.filter((entry) => entry !== crate);
    const spec = CRATES.types[crate.type];
    let text;
    if (crate.type === "hp") {
      const before = player.hp;
      player.hp = Math.min(MAX_HP, player.hp + spec.amount);
      text = `+${player.hp - before} HP`;
    } else if (crate.type === "fuel") {
      if (this.phase === "aiming" && player === this.currentPlayer) {
        player.fuel += spec.amount;
      } else {
        player.bonusFuel += spec.amount;
      }
      text = `+${spec.amount} combustível`;
    } else {
      const weaponId = randomItem(WEAPON_ORDER.filter((id) => WEAPONS[id].ammo !== null));
      player.ammo[weaponId] += spec.amount;
      text = `+${spec.amount} ${WEAPONS[weaponId].label}`;
    }
    this.status = `${player.label} pegou a caixa de ${spec.label.toLowerCase()}: ${text}.`;
    this.emit("cratePickup", { playerId: player.id, crateType: crate.type, text, x: crate.x, y: crate.y });
  }

  land(player) {
    const distance = player.fall.peakY - player.position.y;
    player.fall = null;
    const damage = distance > SAFE_FALL ? Math.min(40, Math.round((distance - SAFE_FALL) * 1.2)) : 0;
    this.emit("land", { playerId: player.id, x: player.position.x, y: player.position.y, distance });
    if (damage > 0) {
      this.applyDamage(player, damage);
    }
  }

  resolveTurn() {
    const defeated = this.players.filter((player) => player.hp <= 0);
    if (defeated.length) {
      this.finishRound(defeated);
      return;
    }
    this.turnIndex = 1 - this.turnIndex;
    this.beginTurn();
  }

  finishRound(defeated) {
    if (defeated.length === this.players.length) {
      this.status = "Empate! Os dois carrinhos foram destruídos.";
      this.emit("roundEnd", { winnerId: null, label: null });
      this.setPhase("roundOver", PHASE_DELAYS.roundOver);
      return;
    }

    const winner = this.players.find((player) => player.hp > 0);
    this.totalScore[winner.id - 1] += 1;

    if (this.totalScore[winner.id - 1] >= ROUNDS_TO_WIN) {
      this.matchWinner = winner.id;
      this.status = `${winner.label} venceu a partida! Nova partida em instantes (B reinicia).`;
      this.emit("matchEnd", { winnerId: winner.id, label: winner.label });
      this.setPhase("matchOver", PHASE_DELAYS.matchOver);
      return;
    }

    this.status = `${winner.label} venceu a rodada.`;
    this.emit("roundEnd", { winnerId: winner.id, label: winner.label });
    this.setPhase("roundOver", PHASE_DELAYS.roundOver);
  }

  updateAi(dt) {
    const player = this.currentPlayer;
    if (!this.aiPlan) {
      this.aiThinkMs -= dt;
      if (this.aiThinkMs <= 0) {
        this.aiPlan = this.planAiShot();
        this.status = `${player.label} está mirando...`;
      }
      return;
    }

    const plan = this.aiPlan;
    this.selectWeapon(player, plan.weapon);
    if (player.facing !== plan.facing) {
      setAim(player, plan.facing, player.elevation);
    }

    const difference = plan.elevation - player.elevation;
    if (Math.abs(difference) > 0.01) {
      const step = (AIM_SPEED * 1.4 * dt) / 1000;
      setAim(player, player.facing, player.elevation + clamp(difference, -step, step));
      return;
    }

    if (!this.charge.active) {
      this.startCharge();
      return;
    }

    if (this.charge.power >= plan.power || this.charge.direction < 0) {
      this.charge.power = plan.power;
      this.fire();
    }
  }

  planAiShot() {
    const attacker = this.currentPlayer;
    const target = this.opponent;
    const preset = AI_PRESETS[this.aiDifficulty];
    const wind = this.wind * preset.windKnowledge * (this.modifier.aiWindScale ?? 1);
    const stateKey = this.buildAiStateKey(attacker, target);
    const previousMisses = this.aiMissMemory.get(stateKey) ?? [];
    const candidates = [];
    let selected = null;

    search:
    for (let angle = -87; angle <= 87; angle += preset.angleStep) {
      for (let velocity = POWER_MIN_VELOCITY; velocity <= POWER_MAX_VELOCITY; velocity += preset.velocityStep) {
        const result = this.simulateShot(attacker, target, angle, velocity, wind, preset.simulationStep);
        if (result.hitTarget) {
          selected = { angle, velocity, score: 0 };
          break search;
        }
        const repeatedMissPenalty = previousMisses.some((shot) => shot.angle === angle && shot.velocity === velocity)
          ? 250
          : 0;
        candidates.push({ angle, velocity, score: result.score + repeatedMissPenalty });
      }
    }

    if (!selected) {
      candidates.sort((a, b) => a.score - b.score);
      let bestShot = candidates[0] ?? { angle: attacker.angle, velocity: 40, score: Number.POSITIVE_INFINITY };
      if (preset.refinement) {
        bestShot = this.refineAiShot(attacker, target, bestShot, wind);
      }
      const pool = candidates.slice(0, Math.max(1, preset.candidatePool));
      selected = preset.refinement ? bestShot : pool[Math.floor(Math.random() * pool.length)] ?? bestShot;
    }

    const shot = this.applyAiImprecision(selected, preset);
    const aim = angleToAim(shot.angle);
    return {
      ...shot,
      weapon: this.chooseAiWeapon(attacker, selected, preset),
      facing: aim.facing,
      elevation: clamp(aim.elevation, ELEVATION_LIMITS.min, ELEVATION_LIMITS.max),
      power: velocityToPower(shot.velocity),
      stateKey,
    };
  }

  // Pesado quando o tiro calculado acerta; fragmentacao quando passa perto.
  chooseAiWeapon(attacker, shot, preset) {
    if (Math.random() >= preset.specialChance) {
      return STANDARD.id;
    }
    if (shot.score === 0 && attacker.ammo.heavy > 0) {
      return "heavy";
    }
    if (shot.score > 0 && shot.score < 30 && attacker.ammo.cluster > 0) {
      return "cluster";
    }
    return STANDARD.id;
  }

  simulateShot(attacker, target, angle, velocity, wind, simulationStep = 0.05) {
    const origin = getProjectileOrigin({ position: attacker.position, angle });
    const launch = getLaunchVelocity(angle, velocity);
    const targetCenter = getPlayerCenter(target);
    const selfCenter = getPlayerCenter(attacker);
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let elapsed = simulationStep; elapsed <= 20; elapsed += simulationStep) {
      const point = projectileAt(origin, launch, wind, elapsed, this.gravity);
      const distance = Math.hypot(point.x - targetCenter.x, point.y - targetCenter.y);
      bestDistance = Math.min(bestDistance, distance);

      if (isInsidePlayerHitbox(point, target)) {
        return { hitTarget: true, score: 0 };
      }

      if (isSolid(point, this.map, this.craters) || (elapsed > 0.5 && isInsidePlayerHitbox(point, attacker))) {
        const selfDistance = Math.hypot(point.x - selfCenter.x, point.y - selfCenter.y);
        if (selfDistance < STANDARD.radius) {
          return { hitTarget: false, score: 300 + distance };
        }
        return { hitTarget: distance < STANDARD.radius * 0.45, score: distance };
      }

      if (isOutOfBounds(point)) {
        break;
      }
    }

    return { hitTarget: false, score: bestDistance + 40 };
  }

  refineAiShot(attacker, target, seedShot, wind) {
    let bestShot = { ...seedShot };

    for (let angle = seedShot.angle - 6; angle <= seedShot.angle + 6; angle += 1) {
      for (let velocity = seedShot.velocity - 4; velocity <= seedShot.velocity + 4; velocity += 0.5) {
        const clampedAngle = clamp(angle, -87, 87);
        const clampedVelocity = clamp(velocity, POWER_MIN_VELOCITY, POWER_MAX_VELOCITY);
        const result = this.simulateShot(attacker, target, clampedAngle, clampedVelocity, wind, 0.02);
        if (result.hitTarget) {
          return { angle: clampedAngle, velocity: clampedVelocity, score: 0 };
        }
        if (result.score < bestShot.score) {
          bestShot = { angle: clampedAngle, velocity: clampedVelocity, score: result.score };
        }
      }
    }

    return bestShot;
  }

  applyAiImprecision(shot, preset) {
    const angleOffset = (Math.random() * 2 - 1) * preset.aimJitter.angle;
    const velocityOffset = (Math.random() * 2 - 1) * preset.aimJitter.velocity;

    return {
      angle: clamp(shot.angle + angleOffset, -87, 87),
      velocity: clamp(shot.velocity + velocityOffset, POWER_MIN_VELOCITY, POWER_MAX_VELOCITY),
      sourceAngle: shot.angle,
      sourceVelocity: shot.velocity,
    };
  }

  rememberAiMiss() {
    if (!this.isAiTurn || !this.aiPlan) {
      return;
    }
    const { stateKey, sourceAngle, sourceVelocity } = this.aiPlan;
    const misses = this.aiMissMemory.get(stateKey) ?? [];
    misses.push({ angle: sourceAngle, velocity: sourceVelocity });
    this.aiMissMemory.set(stateKey, misses.slice(-8));
  }

  buildAiStateKey(attacker, target) {
    return [
      Math.round(attacker.position.x),
      Math.round(attacker.position.y),
      Math.round(target.position.x),
      Math.round(target.position.y),
      this.wind,
      this.aiDifficulty,
    ].join(":");
  }

  getSnapshot() {
    return {
      mode: this.mode,
      aiDifficulty: this.aiDifficulty,
      phase: this.phase,
      phaseMs: this.phaseMs,
      round: this.round,
      turnIndex: this.turnIndex,
      totalScore: [...this.totalScore],
      matchWinner: this.matchWinner,
      status: this.status,
      theme: this.theme,
      seed: this.seed,
      modifier: this.modifier.id,
      crates: this.crates.map((crate) => ({ ...crate })),
      wind: this.wind,
      turnTimeMs: this.turnTimeMs,
      craters: this.craters.map((crater) => ({ ...crater })),
      projectiles: this.projectiles.map((projectile) => ({
        id: projectile.id,
        ownerId: projectile.ownerId,
        weapon: projectile.weapon,
        origin: { ...projectile.origin },
        velocity: { ...projectile.velocity },
        wind: projectile.wind,
        gravity: projectile.gravity,
        elapsed: projectile.elapsed,
        position: { ...projectile.position },
      })),
      charge: { active: this.charge.active, power: this.charge.power },
      events: this.events.map((event) => ({ ...event })),
      players: this.players.map((player) => ({
        id: player.id,
        label: player.label,
        color: player.color,
        shade: player.shade,
        position: { ...player.position },
        facing: player.facing,
        elevation: player.elevation,
        angle: player.angle,
        hp: player.hp,
        fuel: player.fuel,
        lastPower: player.lastPower,
        weapon: player.weapon,
        ammo: { ...player.ammo },
        falling: Boolean(player.fall),
      })),
    };
  }
}
