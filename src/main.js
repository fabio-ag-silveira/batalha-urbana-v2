import { Game } from "./game.js";
import { CanvasRenderer } from "./renderer.js";
import { GAME_MODES } from "./config.js";
import { drawScene } from "./scene.js";
import { Effects } from "./effects.js";
import { SoundBoard } from "./audio.js";
import { Hud } from "./hud.js";
import { InputController } from "./input.js";

const canvas = document.getElementById("gameCanvas");
const renderer = new CanvasRenderer(canvas);

const ui = {
  roundLabel: document.getElementById("roundLabel"),
  turnLabel: document.getElementById("turnLabel"),
  statusLabel: document.getElementById("statusLabel"),
  playerOneStats: document.getElementById("playerOneStats"),
  playerTwoStats: document.getElementById("playerTwoStats"),
  playerOneCard: document.querySelector(".player-one"),
  playerTwoCard: document.querySelector(".player-two"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
  soundButton: document.getElementById("soundButton"),
};

const game = new Game();
const hud = new Hud(ui);
const effects = new Effects();
const sound = new SoundBoard();

const input = new InputController({
  resolveTarget(binding) {
    return binding.player === "current" ? game.currentPlayer.id : binding.player;
  },
  dispatch(target, control, pressed, options) {
    game.setInput(target, control, pressed, options);
  },
  onShortcut(key) {
    if (key === "b") {
      game.resetGame();
      effects.reset();
    } else if (key === "u") {
      sound.toggle();
    } else if (key === "m") {
      game.setMode(game.mode === GAME_MODES.ai ? GAME_MODES.local : GAME_MODES.ai);
    } else if (key === "n") {
      game.cycleAiDifficulty();
    }
  },
  onActivity() {
    sound.unlock();
  },
});
input.attach(window);
window.addEventListener("pointerdown", () => sound.unlock());

ui.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    game.setMode(button.dataset.mode);
    button.blur();
  });
});

ui.difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    game.setAiDifficulty(button.dataset.difficulty);
    button.blur();
  });
});

ui.soundButton.addEventListener("click", () => {
  sound.unlock();
  sound.toggle();
  ui.soundButton.blur();
});

let lastEventId = 0;
let lastTickSecond = null;

function consumeEvents(state) {
  state.events.forEach((event) => {
    if (event.id > lastEventId) {
      effects.handleEvent(event, state, sound);
      lastEventId = event.id;
    }
  });
}

function updateTimerTicks(state) {
  const seconds = Math.ceil(Math.max(0, state.turnTimeMs) / 1000);
  if (state.phase === "aiming" && seconds <= 5 && seconds > 0 && seconds !== lastTickSecond) {
    sound.tick(seconds <= 2);
  }
  lastTickSecond = state.phase === "aiming" ? seconds : null;
}

let previousTimestamp = performance.now();

function frame(timestamp) {
  const deltaMs = Math.min(timestamp - previousTimestamp, 100);
  previousTimestamp = timestamp;

  game.update(deltaMs);
  const state = game.getSnapshot();

  consumeEvents(state);
  updateTimerTicks(state);
  effects.update(deltaMs / 1000, state);
  sound.setCharge(state.phase === "aiming" && state.charge.active ? state.charge.power : null);

  renderer.beginFrame();
  drawScene(renderer, state, effects, timestamp / 1000);
  hud.render(state, {
    mode: game.mode,
    aiDifficulty: game.aiDifficulty,
    soundEnabled: sound.enabled,
  });

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
