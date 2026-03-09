import {
  AI_DIFFICULTIES,
  AI_PRESETS,
  AI_THINK_DELAY_MS,
  BACKGROUND_COLORS,
  DEFAULT_AI_DIFFICULTY,
  DEFAULT_GAME_MODE,
  GAME_MODES,
  GRAVITY,
  PLAYER_DEFAULTS,
  PLAYER_HITBOX,
  STATIC_COLLIDERS,
  TIME_SCALE,
} from "./config.js";
import { clamp, degToRad, isPointInsideRect, randomItem } from "./math.js";
import { getProjectileOrigin } from "./scene.js";

function createPlayers() {
  return PLAYER_DEFAULTS.map((template) => ({
    ...template,
    position: { ...randomItem(template.spawns) },
    damage: 0,
    roundHits: 0,
  }));
}

function createProjectile(player) {
  const angle = degToRad(player.angle + 90);
  const origin = getProjectileOrigin(player);
  return {
    ownerId: player.id,
    elapsed: 0,
    position: origin,
    origin,
    velocity: {
      x: player.velocity * Math.cos(angle),
      y: player.velocity * Math.sin(angle),
    },
  };
}

export class Game {
  constructor(ui = null) {
    this.ui = ui;
    this.round = -1;
    this.turnIndex = 0;
    this.totalScore = [0, 0];
    this.status = "Ajuste angulo e velocidade antes de atirar.";
    this.background = randomItem(BACKGROUND_COLORS);
    this.players = createPlayers();
    this.activeProjectile = null;
    this.pendingRoundResetMs = 0;
    this.pendingAiShotMs = 0;
    this.mode = DEFAULT_GAME_MODE;
    this.aiDifficulty = DEFAULT_AI_DIFFICULTY;
    this.aiMissMemory = new Map();
    this.lastAiDecision = null;
    this.syncUi();
  }

  get currentPlayer() {
    return this.players[this.turnIndex];
  }

  get waitingForProjectile() {
    return Boolean(this.activeProjectile || this.pendingRoundResetMs > 0);
  }

  get isAiTurn() {
    return this.mode === GAME_MODES.ai && this.currentPlayer.id === 2;
  }

  resetRound() {
    this.round += 1;
    this.turnIndex = 0;
    this.background = randomItem(BACKGROUND_COLORS);
    this.players = createPlayers().map((player) => {
      const previous = this.players?.find((entry) => entry.id === player.id);
      return {
        ...player,
        velocity: previous?.velocity ?? player.velocity,
        angle: previous?.angle ?? player.angle,
      };
    });
    this.activeProjectile = null;
    this.pendingRoundResetMs = 0;
    this.pendingAiShotMs = 0;
    this.aiMissMemory.clear();
    this.lastAiDecision = null;
    this.status = "Nova rodada iniciada.";
    this.syncUi();
  }

  resetGame() {
    this.round = -1;
    this.totalScore = [0, 0];
    this.players = createPlayers();
    this.players.forEach((player, index) => {
      player.velocity = PLAYER_DEFAULTS[index].velocity;
      player.angle = PLAYER_DEFAULTS[index].angle;
    });
    this.resetRound();
    this.status = "Jogo reiniciado.";
    this.syncUi();
  }

  setMode(mode) {
    if (!Object.values(GAME_MODES).includes(mode) || this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.pendingAiShotMs = this.isAiTurn ? AI_THINK_DELAY_MS : 0;
    this.status = this.mode === GAME_MODES.ai
      ? "Modo versus IA ativado."
      : this.mode === GAME_MODES.lan
        ? "Modo LAN ativado."
        : "Modo versus local ativado.";
    this.syncUi();
  }

  setAiDifficulty(difficulty) {
    if (!Object.values(AI_DIFFICULTIES).includes(difficulty) || this.aiDifficulty === difficulty) {
      return;
    }

    this.aiDifficulty = difficulty;
    if (this.isAiTurn && !this.activeProjectile) {
      this.pendingAiShotMs = Math.min(this.pendingAiShotMs, 180);
    }
    this.status = `Dificuldade alterada para ${AI_PRESETS[this.aiDifficulty].label}.`;
    this.syncUi();
  }

  handleKey(key) {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "b") {
      this.resetGame();
      return;
    }

    if (normalizedKey === "m") {
      this.setMode(this.mode === GAME_MODES.ai ? GAME_MODES.local : GAME_MODES.ai);
      return;
    }

    if (normalizedKey === "n") {
      this.cycleAiDifficulty();
      return;
    }

    if (normalizedKey === "q") {
      this.status = "Tecla Q recebida. O navegador continua aberto; use a aba para sair.";
      this.syncUi();
      return;
    }

    if (this.waitingForProjectile || this.isAiTurn) {
      return;
    }

    const player = this.currentPlayer;
    const { controls } = player;

    if (normalizedKey === controls.left) {
      player.angle = clamp(player.angle + 3, -87, 87);
      this.status = `${player.label} ajustou o angulo.`;
    } else if (normalizedKey === controls.right) {
      player.angle = clamp(player.angle - 3, -87, 87);
      this.status = `${player.label} ajustou o angulo.`;
    } else if (normalizedKey === controls.up) {
      player.velocity = clamp(player.velocity + 1, 1, 199);
      this.status = `${player.label} aumentou a velocidade.`;
    } else if (normalizedKey === controls.down) {
      player.velocity = clamp(player.velocity - 1, 1, 199);
      this.status = `${player.label} reduziu a velocidade.`;
    } else if (normalizedKey === controls.fire) {
      this.activeProjectile = createProjectile(player);
      this.status = `${player.label} disparou.`;
    }

    this.syncUi();
  }

  update(deltaMs) {
    if (this.pendingRoundResetMs > 0) {
      this.pendingRoundResetMs -= deltaMs;
      if (this.pendingRoundResetMs <= 0) {
        this.resetRound();
      }
      return;
    }

    if (!this.activeProjectile) {
      if (this.isAiTurn) {
        this.updateAiTurn(deltaMs);
      }
      return;
    }

    const projectile = this.activeProjectile;
    projectile.elapsed += (deltaMs / 1000) * TIME_SCALE;
    projectile.position = {
      x: projectile.origin.x + projectile.velocity.x * projectile.elapsed,
      y: projectile.origin.y + projectile.velocity.y * projectile.elapsed - (GRAVITY * projectile.elapsed * projectile.elapsed) / 2,
    };

    if (this.checkPlayerHit(projectile)) {
      return;
    }

    if (this.checkStaticCollision(projectile.position) || this.isProjectileOutsideBounds(projectile.position)) {
      this.finishTurn("Tiro encerrado por colisao com o cenario.");
    }
  }

  checkPlayerHit(projectile) {
    const attacker = this.currentPlayer;
    const target = this.players.find((player) => player.id !== attacker.id);
    const hit =
      projectile.position.x >= target.position.x - PLAYER_HITBOX.halfWidth &&
      projectile.position.x <= target.position.x + PLAYER_HITBOX.halfWidth &&
      projectile.position.y >= target.position.y + PLAYER_HITBOX.minY &&
      projectile.position.y <= target.position.y + PLAYER_HITBOX.maxY;

    if (!hit) {
      return false;
    }

    target.damage = clamp(target.damage + 1, 0, 2);
    attacker.roundHits += 1;
    this.totalScore[attacker.id - 1] += 1;
    this.activeProjectile = null;

    if (attacker.roundHits >= 3) {
      this.status = `${attacker.label} venceu a rodada.`;
      this.pendingRoundResetMs = 1000;
    } else {
      this.randomizeSpawns();
      this.advanceTurn();
      this.status = `${attacker.label} acertou o alvo.`;
    }

    this.syncUi();
    return true;
  }

  checkStaticCollision(point) {
    return STATIC_COLLIDERS.some((collider) => isPointInsideRect(point, collider));
  }

  isProjectileOutsideBounds(point) {
    return point.x < -400 || point.x > 400 || point.y < -50;
  }

  randomizeSpawns() {
    this.players = this.players.map((player) => ({
      ...player,
      position: { ...randomItem(player.spawns) },
    }));
  }

  advanceTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.activeProjectile = null;
    this.lastAiDecision = null;
    this.pendingAiShotMs = this.isAiTurn ? AI_THINK_DELAY_MS : 0;
    this.syncUi();
  }

  finishTurn(message) {
    if (this.currentPlayer.id === 2 && this.lastAiDecision) {
      const key = this.lastAiDecision.stateKey;
      const misses = this.aiMissMemory.get(key) ?? [];
      misses.push({ angle: this.lastAiDecision.angle, velocity: this.lastAiDecision.velocity });
      this.aiMissMemory.set(key, misses.slice(-8));
    }
    this.activeProjectile = null;
    this.advanceTurn();
    this.status = message;
    this.syncUi();
  }

  syncUi() {
    if (!this.ui) {
      return;
    }

    const [playerOne, playerTwo] = this.players;
    const renderStats = (player, points) => `
      <div class="stat-chip">
        <span class="stat-label">Velocidade</span>
        <span class="stat-value">${player.velocity} m/s</span>
      </div>
      <div class="stat-chip">
        <span class="stat-label">Angulo</span>
        <span class="stat-value">${player.angle + 90}</span>
      </div>
      <div class="stat-chip">
        <span class="stat-label">Pontos</span>
        <span class="stat-value">${points}</span>
      </div>
    `;
    this.ui.roundLabel.textContent = `Rodada ${this.round + 1}`;
    this.ui.turnLabel.textContent = this.pendingRoundResetMs > 0
      ? "Fechando rodada..."
      : `Vez de ${this.currentPlayer.label}`;
    this.ui.statusLabel.textContent = this.status;
    this.ui.playerOneStats.innerHTML = renderStats(playerOne, this.totalScore[0]);
    this.ui.playerTwoStats.innerHTML = renderStats(playerTwo, this.totalScore[1]);
    this.ui.modeButtons?.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === this.mode);
    });
    this.ui.difficultyButtons?.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.difficulty === this.aiDifficulty);
      button.disabled = this.mode !== GAME_MODES.ai;
    });
  }

  getState() {
    return {
      background: this.background,
      activeProjectile: this.activeProjectile,
      mode: this.mode,
      players: this.players,
    };
  }

  updateAiTurn(deltaMs) {
    if (this.pendingAiShotMs > 0) {
      this.pendingAiShotMs -= deltaMs;
      if (this.pendingAiShotMs > 0) {
        return;
      }
    }

    const shot = this.findBestAiShot();
    this.currentPlayer.angle = shot.angle;
    this.currentPlayer.velocity = shot.velocity;
    this.lastAiDecision = shot;
    this.activeProjectile = createProjectile(this.currentPlayer);
    this.status = `${this.currentPlayer.label} calculou e disparou.`;
    this.syncUi();
  }

  findBestAiShot() {
    const attacker = this.currentPlayer;
    const target = this.players.find((player) => player.id !== attacker.id);
    const preset = AI_PRESETS[this.aiDifficulty];
    const stateKey = this.buildAiStateKey(attacker, target);
    const previousMisses = this.aiMissMemory.get(stateKey) ?? [];
    const candidates = [];

    for (let angle = -87; angle <= 87; angle += preset.angleStep) {
      for (let velocity = 15; velocity <= 199; velocity += preset.velocityStep) {
        const result = this.simulateShot(attacker, target, angle, velocity, preset.simulationStep);
        if (result.hitTarget) {
          return {
            ...this.applyAiImprecision({ angle, velocity }, preset),
            stateKey,
          };
        }
        const repeatedMissPenalty = previousMisses.some((shot) => shot.angle === angle && shot.velocity === velocity)
          ? 250
          : 0;
        candidates.push({ angle, velocity, score: result.score + repeatedMissPenalty });
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    let bestShot = candidates[0] ?? {
      angle: attacker.angle,
      velocity: attacker.velocity,
      score: Number.POSITIVE_INFINITY,
    };

    if (preset.refinement) {
      bestShot = this.refineAiShot(attacker, target, bestShot);
    }

    const pool = candidates.slice(0, Math.max(1, preset.candidatePool));
    const selected = preset.refinement
      ? bestShot
      : pool[Math.floor(Math.random() * pool.length)] ?? bestShot;

    return {
      ...this.applyAiImprecision(selected, preset),
      stateKey,
    };
  }

  simulateShot(attacker, target, angle, velocity, simulationStep = 0.05) {
    const simulatedPlayer = { ...attacker, angle, velocity };
    const origin = getProjectileOrigin(simulatedPlayer);
    const radians = degToRad(angle + 90);
    const speedX = velocity * Math.cos(radians);
    const speedY = velocity * Math.sin(radians);
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let elapsed = 0; elapsed <= 8; elapsed += simulationStep) {
      const point = {
        x: origin.x + speedX * elapsed,
        y: origin.y + speedY * elapsed - (GRAVITY * elapsed * elapsed) / 2,
      };

      const dx = point.x - target.position.x;
      const dy = point.y - (target.position.y + 2);
      bestDistance = Math.min(bestDistance, Math.hypot(dx, dy));

      const hitTarget =
        point.x >= target.position.x - PLAYER_HITBOX.halfWidth &&
        point.x <= target.position.x + PLAYER_HITBOX.halfWidth &&
        point.y >= target.position.y + PLAYER_HITBOX.minY &&
        point.y <= target.position.y + PLAYER_HITBOX.maxY;

      if (hitTarget) {
        return { hitTarget: true, score: 0 };
      }

      if (this.checkStaticCollision(point) || this.isProjectileOutsideBounds(point)) {
        return { hitTarget: false, score: bestDistance };
      }
    }

    return { hitTarget: false, score: bestDistance };
  }

  refineAiShot(attacker, target, seedShot) {
    let bestShot = { ...seedShot };

    for (let angle = seedShot.angle - 6; angle <= seedShot.angle + 6; angle += 1) {
      for (let velocity = seedShot.velocity - 6; velocity <= seedShot.velocity + 6; velocity += 1) {
        const clampedAngle = clamp(angle, -87, 87);
        const clampedVelocity = clamp(velocity, 15, 199);
        const result = this.simulateShot(attacker, target, clampedAngle, clampedVelocity, 0.02);
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
    const angleOffset = preset.aimJitter.angle === 0
      ? 0
      : Math.round((Math.random() * 2 - 1) * preset.aimJitter.angle);
    const velocityOffset = preset.aimJitter.velocity === 0
      ? 0
      : Math.round((Math.random() * 2 - 1) * preset.aimJitter.velocity);

    return {
      angle: clamp(shot.angle + angleOffset, -87, 87),
      velocity: clamp(shot.velocity + velocityOffset, 15, 199),
    };
  }

  cycleAiDifficulty() {
    const order = [AI_DIFFICULTIES.easy, AI_DIFFICULTIES.medium, AI_DIFFICULTIES.hard];
    const currentIndex = order.indexOf(this.aiDifficulty);
    this.setAiDifficulty(order[(currentIndex + 1) % order.length]);
  }

  buildAiStateKey(attacker, target) {
    return [
      attacker.position.x,
      attacker.position.y,
      target.position.x,
      target.position.y,
      this.aiDifficulty,
    ].join(":");
  }

  getSnapshot() {
    return {
      round: this.round,
      turnIndex: this.turnIndex,
      totalScore: [...this.totalScore],
      status: this.status,
      background: this.background,
      activeProjectile: this.activeProjectile ? {
        ownerId: this.activeProjectile.ownerId,
        elapsed: this.activeProjectile.elapsed,
        position: { ...this.activeProjectile.position },
        origin: { ...this.activeProjectile.origin },
        velocity: { ...this.activeProjectile.velocity },
      } : null,
      pendingRoundResetMs: this.pendingRoundResetMs,
      players: this.players.map((player) => ({
        id: player.id,
        label: player.label,
        velocity: player.velocity,
        angle: player.angle,
        hitTint: [...player.hitTint],
        accent: player.accent,
        wheel: player.wheel,
        damage: player.damage,
        roundHits: player.roundHits,
        position: { ...player.position },
      })),
    };
  }

  applyNetworkCommand(playerId, command) {
    if (command === "reset") {
      this.resetGame();
      return true;
    }

    if (![1, 2].includes(playerId)) {
      return false;
    }

    if (this.waitingForProjectile || this.currentPlayer.id !== playerId) {
      return false;
    }

    const controlMap = {
      up: "up",
      down: "down",
      left: "left",
      right: "right",
      fire: "fire",
    };

    const controlKey = controlMap[command];
    if (!controlKey) {
      return false;
    }

    const key = this.currentPlayer.controls[controlKey];
    if (!key) {
      return false;
    }

    this.handleKey(key);
    return true;
  }
}
