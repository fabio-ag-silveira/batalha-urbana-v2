import { Game } from "./game.js";
import { CanvasRenderer } from "./renderer.js";
import { GAME_MODES } from "./config.js";
import { drawScene } from "./scene.js";
import { Effects } from "./effects.js";
import { SoundBoard } from "./audio.js";
import { Hud } from "./hud.js";
import { InputController } from "./input.js";
import { CameraController } from "./camera.js";

const canvas = document.getElementById("gameCanvas");
const renderer = new CanvasRenderer(canvas);

const ui = {
  roundLabel: document.getElementById("roundLabel"),
  turnLabel: document.getElementById("turnLabel"),
  statusLabel: document.getElementById("statusLabel"),
  playerOneStats: document.getElementById("playerOneStats"),
  playerTwoStats: document.getElementById("playerTwoStats"),
  playerOneRounds: document.getElementById("playerOneRounds"),
  playerTwoRounds: document.getElementById("playerTwoRounds"),
  playerOneCard: document.querySelector(".player-one"),
  playerTwoCard: document.querySelector(".player-two"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
  soundButton: document.getElementById("soundButton"),
  cameraButton: document.getElementById("cameraButton"),
  resetButton: document.getElementById("resetButton"),
  menuButton: document.getElementById("menuButton"),
  menuClose: document.getElementById("menuClose"),
  hudBackdrop: document.getElementById("hudBackdrop"),
  fullscreenButton: document.getElementById("fullscreenButton"),
  rotateDismiss: document.getElementById("rotateDismiss"),
  touchButtons: Array.from(document.querySelectorAll("[data-control]")),
};

const game = new Game();
const hud = new Hud(ui);
const effects = new Effects();
const sound = new SoundBoard();
const camera = new CameraController();

function resetMatch() {
  game.resetGame();
  effects.reset();
}

const input = new InputController({
  resolveTarget(binding) {
    return binding.player === "current" ? game.currentPlayer.id : binding.player;
  },
  dispatch(target, control, pressed, options) {
    game.setInput(target, control, pressed, options);
  },
  onShortcut(key) {
    if (key === "b") {
      resetMatch();
    } else if (key === "u") {
      sound.toggle();
    } else if (key === "c") {
      camera.toggle();
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

ui.cameraButton.addEventListener("click", () => {
  camera.toggle();
  ui.cameraButton.blur();
});

ui.resetButton.addEventListener("click", () => {
  resetMatch();
  setMenuOpen(false);
  ui.resetButton.blur();
});

// Botoes de toque: segurar = tecla apertada; usam o mesmo caminho do teclado.
ui.touchButtons.forEach((button) => {
  const id = `touch:${button.dataset.control}`;
  const release = (options) => {
    button.classList.remove("is-pressed");
    input.release(id, options);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-pressed");
    sound.unlock();
    input.press(id, { player: "current", control: button.dataset.control });
  });
  button.addEventListener("pointerup", () => release());
  button.addEventListener("pointercancel", () => release({ cancel: true }));
  button.addEventListener("lostpointercapture", () => release());
  button.addEventListener("contextmenu", (event) => event.preventDefault());
});

window.addEventListener("touchstart", () => document.body.classList.add("touch"), { once: true, passive: true });

function setMenuOpen(open) {
  document.body.classList.toggle("menu-open", open);
}

ui.menuButton.addEventListener("click", () => setMenuOpen(true));
ui.menuClose.addEventListener("click", () => setMenuOpen(false));
ui.hudBackdrop.addEventListener("click", () => setMenuOpen(false));
ui.rotateDismiss.addEventListener("click", () => document.body.classList.add("rotate-dismissed"));

if (document.fullscreenEnabled) {
  ui.fullscreenButton.hidden = false;
  ui.fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      // Navegadores que suportam travam na horizontal; os demais ignoram.
      await screen.orientation?.lock?.("landscape").catch(() => {});
    } catch {
      // tela cheia recusada pelo navegador
    }
    ui.fullscreenButton.blur();
  });
}

let lastEventId = 0;
let lastTickSecond = null;

function consumeEvents(state) {
  state.events.forEach((event) => {
    if (event.id > lastEventId) {
      effects.handleEvent(event, state, sound);
      camera.handleEvent(event);
      lastEventId = event.id;
      if (event.type === "explosion" && document.body.classList.contains("touch")) {
        navigator.vibrate?.(35);
      }
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
  camera.update(deltaMs / 1000, state, renderer);
  drawScene(renderer, state, effects, timestamp / 1000);
  hud.render(state, {
    mode: game.mode,
    aiDifficulty: game.aiDifficulty,
    soundEnabled: sound.enabled,
    cameraEnabled: camera.enabled,
  });

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
