import { Game } from "./game.js";
import { CanvasRenderer } from "./renderer.js";
import { GAME_MODES } from "./config.js";
import { LanClient } from "./lanClient.js";
import { drawScene } from "./scene.js";

const canvas = document.getElementById("gameCanvas");
const renderer = new CanvasRenderer(canvas);

const ui = {
  roundLabel: document.getElementById("roundLabel"),
  turnLabel: document.getElementById("turnLabel"),
  statusLabel: document.getElementById("statusLabel"),
  playerOneStats: document.getElementById("playerOneStats"),
  playerTwoStats: document.getElementById("playerTwoStats"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
  serverUrlInput: document.getElementById("serverUrlInput"),
  createRoomButton: document.getElementById("createRoomButton"),
  refreshRoomsButton: document.getElementById("refreshRoomsButton"),
  leaveRoomButton: document.getElementById("leaveRoomButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  roomList: document.getElementById("roomList"),
};

const game = new Game(ui);
game.resetRound();
ui.serverUrlInput.value = window.location.origin;

let lanSnapshot = null;
const lanClient = new LanClient(ui, (snapshot) => {
  lanSnapshot = snapshot;
  if (game.mode === GAME_MODES.lan && snapshot) {
    lanClient.renderNetworkHud(snapshot);
  }
});

ui.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    game.setMode(button.dataset.mode);
    if (button.dataset.mode === GAME_MODES.lan) {
      lanClient.startRoomDiscovery(ui.serverUrlInput.value);
    } else {
      lanClient.stopRoomDiscovery();
      lanClient.leaveRoom().catch(() => {});
      game.syncUi();
    }
  });
});

ui.difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    game.setAiDifficulty(button.dataset.difficulty);
  });
});

ui.createRoomButton.addEventListener("click", async () => {
  try {
    game.setMode(GAME_MODES.lan);
    lanClient.startRoomDiscovery(ui.serverUrlInput.value);
    const result = await lanClient.createRoom(ui.serverUrlInput.value);
  } catch (error) {
    ui.connectionStatus.textContent = error.message;
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

window.addEventListener("resize", () => renderer.resize());
window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  if (game.mode === GAME_MODES.lan && lanClient.connected) {
    const key = event.key.toLowerCase();
    const keyMap = {
      w: "up",
      s: "down",
      a: "left",
      d: "right",
      f: "fire",
      i: "up",
      k: "down",
      j: "left",
      l: "right",
      h: "fire",
      b: "reset",
    };
    if (keyMap[key]) {
      lanClient.sendCommand(keyMap[key]).catch((error) => {
        ui.connectionStatus.textContent = error.message;
      });
      return;
    }
  }
  game.handleKey(event.key);
});

let previousTimestamp = performance.now();

function frame(timestamp) {
  const deltaMs = timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  renderer.resize();
  if (game.mode === GAME_MODES.lan && lanSnapshot) {
    renderer.clear(lanSnapshot.background);
    drawScene(renderer, lanSnapshot);
  } else {
    game.update(deltaMs);
    renderer.clear(game.getState().background);
    drawScene(renderer, game.getState());
  }

  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
