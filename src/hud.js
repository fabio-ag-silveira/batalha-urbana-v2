import { GAME_MODES, MAX_HP, ROUND_MODIFIERS, ROUNDS_TO_WIN, WEAPONS } from "./config.js";

const PHASE_LABELS = {
  roundStart: "Preparando a rodada...",
  flying: "Projétil no ar!",
  settling: "Poeira baixando...",
  roundOver: "Fim da rodada",
};

function renderStats(player) {
  const hpPercent = Math.max(0, (player.hp / MAX_HP) * 100);
  const weapon = WEAPONS[player.weapon];
  const ammo = player.ammo[player.weapon];
  return `
    <div class="hp-line">
      <div class="hp-track"><span class="hp-fill" style="width: ${hpPercent}%"></span></div>
      <span class="hp-number">${player.hp}</span>
    </div>
    <div class="player-meta">
      <span>${Math.round(player.elevation)}°</span>
      <span>·</span>
      <span>${weapon.icon} ${weapon.label}${ammo === null ? "" : ` ×${ammo}`}</span>
    </div>
  `;
}

function renderRounds(won) {
  return Array.from({ length: ROUNDS_TO_WIN }, (_, index) =>
    `<span class="round-dot${index < won ? " is-won" : ""}"></span>`).join("");
}

function setPressed(button, pressed) {
  button.classList.toggle("is-active", pressed);
  button.setAttribute("aria-pressed", String(pressed));
}

// Painel lateral desenhado a partir do snapshot; so toca no DOM quando algo muda.
export class Hud {
  constructor(ui) {
    this.ui = ui;
    this.cache = new Map();
  }

  write(key, apply, value) {
    if (this.cache.get(key) === value) {
      return;
    }
    this.cache.set(key, value);
    apply(value);
  }

  render(state, { mode, aiDifficulty, soundEnabled, cameraEnabled }) {
    const { ui } = this;
    const current = state.players[state.turnIndex];
    const winner = state.players.find((player) => player.id === state.matchWinner);
    const seconds = Math.ceil(Math.max(0, state.turnTimeMs) / 1000);
    const turnText = state.phase === "aiming"
      ? `Vez de ${current.label} · ${seconds}s`
      : state.phase === "matchOver"
        ? `${winner?.label ?? "Alguém"} venceu a partida!`
        : PHASE_LABELS[state.phase] ?? "";

    const modifier = ROUND_MODIFIERS[state.modifier];
    const roundText = modifier && modifier.id !== "normal"
      ? `Rodada ${state.round + 1} · ${modifier.label}`
      : `Rodada ${state.round + 1}`;
    this.write("round", (value) => { ui.roundLabel.textContent = value; }, roundText);
    this.write("turn", (value) => { ui.turnLabel.textContent = value; }, turnText);
    this.write("status", (value) => { ui.statusLabel.textContent = value; }, state.status);
    this.write("p1", (value) => { ui.playerOneStats.innerHTML = value; }, renderStats(state.players[0]));
    this.write("p2", (value) => { ui.playerTwoStats.innerHTML = value; }, renderStats(state.players[1]));
    this.write("p1rounds", (value) => { ui.playerOneRounds.innerHTML = value; }, renderRounds(state.totalScore[0]));
    this.write("p2rounds", (value) => { ui.playerTwoRounds.innerHTML = value; }, renderRounds(state.totalScore[1]));
    this.write("active", (value) => {
      ui.playerOneCard?.classList.toggle("is-turn", value === "1");
      ui.playerTwoCard?.classList.toggle("is-turn", value === "2");
    }, state.phase === "aiming" ? String(current.id) : "");
    this.write("mode", (value) => {
      ui.modeButtons.forEach((button) => setPressed(button, button.dataset.mode === value));
    }, mode);
    this.write("difficulty", (value) => {
      ui.difficultyButtons.forEach((button) => {
        setPressed(button, mode === GAME_MODES.ai && button.dataset.difficulty === aiDifficulty);
        button.disabled = mode !== GAME_MODES.ai;
      });
    }, `${mode}:${aiDifficulty}`);
    this.write("sound", (value) => {
      setPressed(ui.soundButton, value);
    }, soundEnabled);
    this.write("camera", (value) => {
      setPressed(ui.cameraButton, value);
    }, cameraEnabled);
  }
}
