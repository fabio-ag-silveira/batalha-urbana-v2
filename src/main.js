import { Game } from "./game.js";
import { CanvasRenderer } from "./renderer.js";
import { GAME_MODES, TIME_SCALE } from "./config.js";
import { LanClient } from "./lanClient.js";
import { drawScene } from "./scene.js";
import { Effects } from "./effects.js";
import { SoundBoard } from "./audio.js";
import { Hud } from "./hud.js";
import { InputController } from "./input.js";
import { projectileAt } from "./physics.js";

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
  serverUrlInput: document.getElementById("serverUrlInput"),
  createRoomButton: document.getElementById("createRoomButton"),
  refreshRoomsButton: document.getElementById("refreshRoomsButton"),
  leaveRoomButton: document.getElementById("leaveRoomButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  roomList: document.getElementById("roomList"),
};

const game = new Game();
const hud = new Hud(ui);
const effects = new Effects();
const sound = new SoundBoard();
ui.serverUrlInput.value = window.location.origin;

let lanSnapshot = null;
let lanReceivedAt = 0;
const lanClient = new LanClient(ui, (snapshot) => {
  lanSnapshot = snapshot;
  lanReceivedAt = performance.now();
});

function isLanActive() {
  return game.mode === GAME_MODES.lan && lanClient.connected;
}

function reportLanError(error) {
  ui.connectionStatus.textContent = error.message;
}

function resetMatch() {
  if (isLanActive()) {
    lanClient.sendCommand("reset").catch(reportLanError);
    return;
  }
  game.resetGame();
  effects.reset();
}

const input = new InputController({
  resolveTarget(binding) {
    if (isLanActive()) {
      return "lan";
    }
    if (binding.player === "current") {
      return game.currentPlayer.id;
    }
    return binding.player;
  },
  dispatch(target, control, pressed, options) {
    if (target === "lan") {
      lanClient.sendInput(control, pressed, options?.cancel).catch(reportLanError);
      return;
    }
    game.setInput(target, control, pressed, options);
  },
  onShortcut(key) {
    if (key === "b") {
      resetMatch();
    } else if (key === "u") {
      sound.toggle();
    } else if (isLanActive()) {
      return;
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
    if (button.dataset.mode === GAME_MODES.lan) {
      lanClient.startRoomDiscovery(ui.serverUrlInput.value);
    } else {
      lanClient.stopRoomDiscovery();
      lanClient.leaveRoom().catch(() => {});
    }
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

ui.createRoomButton.addEventListener("click", async () => {
  try {
    game.setMode(GAME_MODES.lan);
    lanClient.startRoomDiscovery(ui.serverUrlInput.value);
    await lanClient.createRoom(ui.serverUrlInput.value);
  } catch (error) {
    reportLanError(error);
  }
});

ui.refreshRoomsButton.addEventListener("click", () => {
  game.setMode(GAME_MODES.lan);
  lanClient.startRoomDiscovery(ui.serverUrlInput.value);
});

ui.leaveRoomButton.addEventListener("click", () => {
  lanClient.leaveRoom().catch(() => {});
  lanClient.stopRoomDiscovery();
  game.setMode(GAME_MODES.ai);
});

window.addEventListener("beforeunload", () => {
  if (lanClient.connected && lanClient.roomId) {
    navigator.sendBeacon(
      `${lanClient.serverUrl}/api/rooms/${lanClient.roomId}/leave`,
      JSON.stringify({ clientId: lanClient.clientId }),
    );
  }
});

// Entre um polling e outro, o voo do projetil e extrapolado localmente.
function extrapolateLanSnapshot(snapshot, now) {
  const projectile = snapshot.projectile;
  if (!projectile) {
    return snapshot;
  }
  const ahead = (Math.min(now - lanReceivedAt, 250) / 1000) * TIME_SCALE;
  const elapsed = projectile.elapsed + ahead;
  return {
    ...snapshot,
    projectile: {
      ...projectile,
      elapsed,
      position: projectileAt(projectile.origin, projectile.velocity, projectile.wind, elapsed),
    },
  };
}

let lastInstanceId = null;
let lastEventId = 0;
let lastTickSecond = null;

function consumeEvents(state) {
  const newestId = state.events.reduce((max, event) => Math.max(max, event.id), 0);
  if (lastInstanceId !== null && state.instanceId !== lastInstanceId) {
    // Trocou de partida (ex.: entrou numa sala LAN): ignora o historico antigo.
    lastInstanceId = state.instanceId;
    lastEventId = newestId;
    effects.reset();
    return;
  }
  lastInstanceId = state.instanceId;
  if (newestId < lastEventId) {
    lastEventId = 0;
  }
  state.events.forEach((event) => {
    if (event.id > lastEventId) {
      effects.handleEvent(event, state, sound);
    }
  });
  lastEventId = Math.max(lastEventId, newestId);
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

  let state;
  if (isLanActive() && lanSnapshot) {
    state = extrapolateLanSnapshot(lanSnapshot, timestamp);
  } else {
    game.update(deltaMs);
    state = game.getSnapshot();
  }

  consumeEvents(state);
  updateTimerTicks(state);
  effects.update(deltaMs / 1000, state);
  sound.setCharge(state.phase === "aiming" && state.charge.active ? state.charge.power : null);

  renderer.beginFrame();
  drawScene(renderer, state, effects, timestamp / 1000);
  hud.render(state, {
    mode: isLanActive() ? GAME_MODES.lan : game.mode,
    aiDifficulty: game.aiDifficulty,
    soundEnabled: sound.enabled,
  });

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
