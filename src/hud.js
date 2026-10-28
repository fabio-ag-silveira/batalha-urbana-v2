import { GAME_MODES, MAX_HP, ROUNDS_TO_WIN } from "./config.js";

const PHASE_LABELS = {
  roundStart: "Preparando a rodada...",
  flying: "Projétil no ar!",
  settling: "Poeira baixando...",
  roundOver: "Fim da rodada",
};

function renderStats(player, roundsWon) {
  const hpPercent = Math.max(0, (player.hp / MAX_HP) * 100);
  const lastPower = player.lastPower === null ? "–" : `${Math.round(player.lastPower * 100)}%`;
  return `
    <div class="hp-row">
      <div class="hp-bar"><span class="hp-fill" style="width: ${hpPercent}%"></span></div>
      <span class="hp-value">${player.hp} HP</span>
    </div>
    <div class="stat-chip">
      <span class="stat-label">Rodadas</span>
      <span class="stat-value">${roundsWon}/${ROUNDS_TO_WIN}</span>
    </div>
    <div class="stat-chip">
      <span class="stat-label">Ângulo</span>
      <span class="stat-value">${Math.round(player.elevation)}°</span>
    </div>
    <div class="stat-chip">
      <span class="stat-label">Últ. força</span>
      <span class="stat-value">${lastPower}</span>
    </div>
  `;
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

  render(state, { mode, aiDifficulty, soundEnabled }) {
    const { ui } = this;
    const current = state.players[state.turnIndex];
    const winner = state.players.find((player) => player.id === state.matchWinner);
    const seconds = Math.ceil(Math.max(0, state.turnTimeMs) / 1000);
    const turnText = state.phase === "aiming"
      ? `Vez de ${current.label} · ${seconds}s`
      : state.phase === "matchOver"
        ? `${winner?.label ?? "Alguém"} venceu a partida!`
        : PHASE_LABELS[state.phase] ?? "";

    this.write("round", (value) => { ui.roundLabel.textContent = value; }, `Rodada ${state.round + 1}`);
    this.write("turn", (value) => { ui.turnLabel.textContent = value; }, turnText);
    this.write("status", (value) => { ui.statusLabel.textContent = value; }, state.status);
    this.write("p1", (value) => { ui.playerOneStats.innerHTML = value; }, renderStats(state.players[0], state.totalScore[0]));
    this.write("p2", (value) => { ui.playerTwoStats.innerHTML = value; }, renderStats(state.players[1], state.totalScore[1]));
    this.write("active", (value) => {
      ui.playerOneCard?.classList.toggle("is-turn", value === "1");
      ui.playerTwoCard?.classList.toggle("is-turn", value === "2");
    }, state.phase === "aiming" ? String(current.id) : "");
    this.write("mode", (value) => {
      ui.modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === value));
    }, mode);
    this.write("difficulty", (value) => {
      ui.difficultyButtons.forEach((button) => {
        button.classList.toggle("is-active", mode === GAME_MODES.ai && button.dataset.difficulty === aiDifficulty);
        button.disabled = mode !== GAME_MODES.ai;
      });
    }, `${mode}:${aiDifficulty}`);
    this.write("sound", (value) => {
      if (ui.soundButton) {
        ui.soundButton.textContent = value ? "Som: ligado" : "Som: desligado";
        ui.soundButton.classList.toggle("is-active", value);
      }
    }, soundEnabled);
  }
}
