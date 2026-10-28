import {
  AI_DIFFICULTIES,
  AI_PRESETS,
  AI_THINK_DELAY_MS,
  AIM_SPEED,
  CART_GRAVITY,
  CHARGE_SECONDS,
  CRATER_RADIUS,
  DEFAULT_AI_DIFFICULTY,
  DEFAULT_GAME_MODE,
  DIRECT_HIT_BONUS,
  ELEVATION_LIMITS,
  EXPLOSION_DAMAGE,
  EXPLOSION_RADIUS,
  FUEL_PER_TURN,
  GAME_MODES,
  MAX_CRATERS,
  MAX_HP,
  MOVE_SPEED,
  PHASE_DELAYS,
  PLAYER_DEFAULTS,
  POWER_MAX_VELOCITY,
  POWER_MIN_VELOCITY,
  PROJECTILE_SUBSTEP,
  ROUNDS_TO_WIN,
  SAFE_FALL,
  SKY_THEMES,
  STREET_Y,
  TIME_SCALE,
  TURN_TIME_MS,
  WIND_MAX,
} from "./config.js";
import { clamp, randomItem, randomRange } from "./math.js";
import {
  aimToAngle,
  angleToAim,
  getLaunchVelocity,
  getPlayerCenter,
  getProjectileOrigin,
  isCartBlocked,
  isCartSupported,
  isInsidePlayerHitbox,
  isOutOfBounds,
  isSolid,
  powerToVelocity,
  projectileAt,
  velocityToPower,
} from "./physics.js";

const CONTROLS = ["up", "down", "left", "right", "fire"];
const MAX_EVENTS = 30;

function createInputState() {
  return Object.fromEntries(CONTROLS.map((control) => [control, false]));
}

function pickSpawns() {
  const first = randomItem(PLAYER_DEFAULTS[0].spawns);
  const options = PLAYER_DEFAULTS[1].spawns.filter((spawn) => Math.abs(spawn.x - first.x) > 40);
  return [first, randomItem(options)];
}

function createPlayers() {
  const spawns = pickSpawns();
  return PLAYER_DEFAULTS.map((template, index) => {
    const position = { ...spawns[index] };
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
      lastPower: null,
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
    this.instanceId = Math.random().toString(36).slice(2, 10);
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
    this.craters = [];
    this.projectile = null;
    this.charge = { active: false, power: 0, direction: 1 };
    this.wind = 0;
    this.turnTimeMs = TURN_TIME_MS;
    this.players = createPlayers();
    this.aiPlan = null;
    this.aiThinkMs = 0;
    this.aiMissMemory.clear();
    this.setPhase("roundStart", PHASE_DELAYS.roundStart);
    this.status = `Rodada ${this.round + 1}. Preparem-se!`;
    this.emit("roundStart", { round: this.round + 1 });
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
      : this.mode === GAME_MODES.lan
        ? "Modo LAN ativado."
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
        this.updateAiming(dt);
        break;
      case "flying":
        this.updateFalling(dt);
        this.updateProjectile(dt);
        break;
      case "settling":
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
    this.wind = Math.round(randomRange(-WIND_MAX, WIND_MAX) * growth * 10) / 10;
    this.turnTimeMs = TURN_TIME_MS;
    this.charge = { active: false, power: 0, direction: 1 };
    this.aiPlan = null;
    this.aiThinkMs = AI_THINK_DELAY_MS;

    const player = this.currentPlayer;
    player.fuel = FUEL_PER_TURN;
    this.setPhase("aiming");
    this.status = `Vez de ${player.label}. Mire, ajuste a força e atire!`;
    this.emit("turn", { playerId: player.id, label: player.label, wind: this.wind });
  }

  updateAiming(dt) {
    this.turnTimeMs -= dt;
    const player = this.currentPlayer;
    const seconds = dt / 1000;

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
    const nextX = player.position.x + direction * distance;
    if (isCartBlocked(nextX, player.position.y, direction, this.craters)) {
      return;
    }
    player.fuel = Math.max(0, player.fuel - distance);
    player.position.x = nextX;
  }

  startCharge() {
    this.charge = { active: true, power: 0, direction: 1 };
  }

  fire(message) {
    const player = this.currentPlayer;
    const power = this.charge.power;
    this.charge = { active: false, power, direction: 1 };
    player.lastPower = power;

    const origin = getProjectileOrigin(player);
    this.emit("shot", { playerId: player.id, x: origin.x, y: origin.y, power });
    this.projectile = {
      id: this.eventSeq,
      ownerId: player.id,
      origin,
      velocity: getLaunchVelocity(player.angle, powerToVelocity(power)),
      wind: this.wind,
      elapsed: 0,
      position: { ...origin },
    };
    this.setPhase("flying");
    this.status = message ?? `${player.label} disparou com ${Math.round(power * 100)}% de força.`;
  }

  updateProjectile(dt) {
    const projectile = this.projectile;
    let remaining = (dt / 1000) * TIME_SCALE;

    while (remaining > 0) {
      const step = Math.min(PROJECTILE_SUBSTEP, remaining);
      remaining -= step;
      projectile.elapsed += step;
      projectile.position = projectileAt(projectile.origin, projectile.velocity, projectile.wind, projectile.elapsed);

      const target = this.players.find((player) =>
        isInsidePlayerHitbox(projectile.position, player) &&
        (player.id !== projectile.ownerId || projectile.elapsed > 0.5));
      if (target) {
        this.explode(projectile.position, target);
        return;
      }

      if (isSolid(projectile.position, this.craters)) {
        this.explode(projectile.position, null);
        return;
      }

      if (isOutOfBounds(projectile.position)) {
        this.projectile = null;
        this.rememberAiMiss();
        this.status = "O tiro saiu do mapa.";
        this.emit("miss", { playerId: this.currentPlayer.id });
        this.setPhase("settling", PHASE_DELAYS.settle);
        return;
      }
    }
  }

  explode(point, directTarget) {
    const attacker = this.currentPlayer;
    this.projectile = null;
    this.craters.push({ x: point.x, y: point.y, r: CRATER_RADIUS });
    if (this.craters.length > MAX_CRATERS) {
      this.craters.shift();
    }
    this.emit("explosion", { x: point.x, y: point.y, radius: EXPLOSION_RADIUS, playerId: attacker.id });

    let dealt = 0;
    let selfDamage = 0;
    this.players.forEach((player) => {
      const center = getPlayerCenter(player);
      const distance = Math.hypot(center.x - point.x, center.y - point.y);
      let damage = distance < EXPLOSION_RADIUS ? EXPLOSION_DAMAGE * (1 - distance / EXPLOSION_RADIUS) : 0;
      if (player === directTarget) {
        damage += DIRECT_HIT_BONUS;
      }
      damage = Math.round(damage);
      if (damage <= 0) {
        return;
      }
      this.applyDamage(player, damage);
      if (player === attacker) {
        selfDamage += damage;
      } else {
        dealt += damage;
      }
    });

    if (directTarget && directTarget !== attacker) {
      this.status = `Acerto direto! ${directTarget.label} perdeu ${dealt} de HP.`;
    } else if (dealt > 0) {
      this.status = `${attacker.label} causou ${dealt} de dano.`;
    } else if (selfDamage > 0) {
      this.status = `Fogo amigo! ${attacker.label} se feriu (${selfDamage}).`;
    } else {
      this.status = "Errou! O tiro atingiu o cenário.";
    }

    if (dealt === 0) {
      this.rememberAiMiss();
    }
    this.setPhase("settling", PHASE_DELAYS.settle);
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
      if (isCartSupported(player.position, this.craters)) {
        if (player.fall) {
          this.land(player);
        }
        return;
      }

      if (!player.fall) {
        player.fall = { velocity: 0, startY: player.position.y };
      }
      player.fall.velocity = Math.min(player.fall.velocity + CART_GRAVITY * seconds, 120);
      let remaining = player.fall.velocity * seconds;
      while (remaining > 0) {
        const step = Math.min(0.25, remaining);
        remaining -= step;
        player.position.y = Math.max(STREET_Y, player.position.y - step);
        if (isCartSupported(player.position, this.craters)) {
          break;
        }
      }

      if (isCartSupported(player.position, this.craters)) {
        this.land(player);
      } else {
        anyFalling = true;
      }
    });

    return anyFalling;
  }

  land(player) {
    const distance = player.fall.startY - player.position.y;
    player.fall = null;
    const damage = distance > SAFE_FALL ? Math.min(30, Math.round((distance - SAFE_FALL) * 1.2)) : 0;
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
    const wind = this.wind * preset.windKnowledge;
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
      facing: aim.facing,
      elevation: clamp(aim.elevation, ELEVATION_LIMITS.min, ELEVATION_LIMITS.max),
      power: velocityToPower(shot.velocity),
      stateKey,
    };
  }

  simulateShot(attacker, target, angle, velocity, wind, simulationStep = 0.05) {
    const origin = getProjectileOrigin({ position: attacker.position, angle });
    const launch = getLaunchVelocity(angle, velocity);
    const targetCenter = getPlayerCenter(target);
    const selfCenter = getPlayerCenter(attacker);
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let elapsed = simulationStep; elapsed <= 20; elapsed += simulationStep) {
      const point = projectileAt(origin, launch, wind, elapsed);
      const distance = Math.hypot(point.x - targetCenter.x, point.y - targetCenter.y);
      bestDistance = Math.min(bestDistance, distance);

      if (isInsidePlayerHitbox(point, target)) {
        return { hitTarget: true, score: 0 };
      }

      if (isSolid(point, this.craters) || (elapsed > 0.5 && isInsidePlayerHitbox(point, attacker))) {
        const selfDistance = Math.hypot(point.x - selfCenter.x, point.y - selfCenter.y);
        if (selfDistance < EXPLOSION_RADIUS) {
          return { hitTarget: false, score: 300 + distance };
        }
        return { hitTarget: distance < EXPLOSION_RADIUS * 0.45, score: distance };
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
    const projectile = this.projectile;
    return {
      instanceId: this.instanceId,
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
      wind: this.wind,
      turnTimeMs: this.turnTimeMs,
      craters: this.craters.map((crater) => ({ ...crater })),
      projectile: projectile ? {
        id: projectile.id,
        ownerId: projectile.ownerId,
        origin: { ...projectile.origin },
        velocity: { ...projectile.velocity },
        wind: projectile.wind,
        elapsed: projectile.elapsed,
        position: { ...projectile.position },
      } : null,
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
        falling: Boolean(player.fall),
      })),
    };
  }

  applyNetworkCommand(playerId, command) {
    if (command === "reset") {
      this.resetGame();
      return true;
    }

    if (![1, 2].includes(playerId) || command?.type !== "input") {
      return false;
    }

    return this.setInput(playerId, command.control, Boolean(command.pressed), { cancel: Boolean(command.cancel) });
  }
}
