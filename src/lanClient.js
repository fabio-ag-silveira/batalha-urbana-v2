import { GAME_MODES } from "./config.js";

function createClientId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class LanClient {
  constructor(ui, onState) {
    this.ui = ui;
    this.onState = onState;
    this.serverUrl = "";
    this.roomId = "";
    this.playerId = null;
    this.connected = false;
    this.snapshot = null;
    this.pollTimer = null;
    this.roomListTimer = null;
    this.clientId = window.sessionStorage.getItem("batalha_urbana_client_id") ?? createClientId();
    window.sessionStorage.setItem("batalha_urbana_client_id", this.clientId);
  }

  async createRoom(serverUrl) {
    this.serverUrl = this.normalizeServerUrl(serverUrl);
    const response = await this.request("/api/rooms/create", {
      method: "POST",
      body: JSON.stringify({ clientId: this.clientId }),
    });
    this.roomId = response.roomId;
    this.playerId = response.playerId;
    this.connected = true;
    this.updateUiStatus(`Sala ${this.roomId} criada. Voce e o Player ${this.playerId}.`);
    await this.fetchRooms();
    this.startPolling();
    return response;
  }

  async joinRoom(serverUrl, roomId) {
    this.serverUrl = this.normalizeServerUrl(serverUrl);
    const response = await this.request("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ roomId, clientId: this.clientId }),
    });
    this.roomId = response.roomId;
    this.playerId = response.playerId;
    this.connected = true;
    this.updateUiStatus(`Conectado na sala ${this.roomId} como Player ${this.playerId}.`);
    await this.fetchRooms();
    this.startPolling();
    return response;
  }

  async leaveRoom() {
    if (this.connected && this.roomId) {
      try {
        await this.request(`/api/rooms/${this.roomId}/leave`, {
          method: "POST",
          body: JSON.stringify({ clientId: this.clientId }),
        });
      } catch {
        // best effort
      }
    }
    this.stopPolling();
    this.connected = false;
    this.snapshot = null;
    this.playerId = null;
    this.roomId = "";
    this.onState(null);
    this.updateUiStatus("Desconectado do modo LAN.");
    this.fetchRooms().catch(() => {});
  }

  async sendCommand(command) {
    if (!this.connected) {
      return false;
    }

    await this.request(`/api/rooms/${this.roomId}/action`, {
      method: "POST",
      body: JSON.stringify({ playerId: this.playerId, command }),
    });
    return true;
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => {
      this.pollState().catch((error) => {
        this.updateUiStatus(error.message);
      });
    }, 150);
    this.pollState().catch((error) => {
      this.updateUiStatus(error.message);
    });
  }

  stopPolling() {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  startRoomDiscovery(serverUrl) {
    this.serverUrl = this.normalizeServerUrl(serverUrl);
    this.stopRoomDiscovery();
    this.roomListTimer = window.setInterval(() => {
      this.fetchRooms().catch((error) => {
        this.updateUiStatus(error.message);
      });
    }, 2000);
    this.fetchRooms().catch((error) => {
      this.updateUiStatus(error.message);
    });
  }

  stopRoomDiscovery() {
    if (this.roomListTimer) {
      window.clearInterval(this.roomListTimer);
      this.roomListTimer = null;
    }
  }

  async pollState() {
    if (!this.connected) {
      return;
    }

    const snapshot = await this.request(`/api/rooms/${this.roomId}/state`);
    this.snapshot = snapshot;
    this.onState(snapshot);
  }

  async fetchRooms() {
    if (!this.serverUrl) {
      return [];
    }

    const rooms = await this.request("/api/rooms");
    this.renderRoomList(rooms);
    return rooms;
  }

  renderNetworkHud(snapshot) {
    if (!snapshot) {
      return;
    }

    const [playerOne, playerTwo] = snapshot.players;
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

    this.ui.roundLabel.textContent = `Rodada ${snapshot.round + 1}`;
    this.ui.turnLabel.textContent = snapshot.pendingRoundResetMs > 0
      ? "Fechando rodada..."
      : `Vez de ${snapshot.players[snapshot.turnIndex].label}`;
    this.ui.statusLabel.textContent = snapshot.status;
    this.ui.playerOneStats.innerHTML = renderStats(playerOne, snapshot.totalScore[0]);
    this.ui.playerTwoStats.innerHTML = renderStats(playerTwo, snapshot.totalScore[1]);
    this.ui.modeButtons?.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === GAME_MODES.lan);
    });
    this.ui.difficultyButtons?.forEach((button) => {
      button.classList.remove("is-active");
      button.disabled = true;
    });
    if (this.ui.connectionStatus) {
      this.ui.connectionStatus.textContent = this.connected
        ? `Conectado como Player ${this.playerId} na sala ${this.roomId}`
        : "Nao conectado";
    }
    this.updateLanActionState();
  }

  updateUiStatus(message) {
    if (this.ui.connectionStatus) {
      this.ui.connectionStatus.textContent = message;
    }
  }

  renderRoomList(rooms) {
    if (!this.ui.roomList) {
      return;
    }

    if (!rooms.length) {
      this.ui.roomList.innerHTML = '<p class="room-empty">Nenhuma sala aberta no servidor atual.</p>';
      this.updateLanActionState();
      return;
    }

    this.ui.roomList.innerHTML = rooms.map((room) => `
      <button type="button" class="room-item ${room.joinable ? "" : "is-full"} ${room.roomId === this.roomId ? "is-own-room" : ""}" data-room-id="${room.roomId}" ${room.joinable || room.roomId === this.roomId ? "" : "disabled"}>
        <span class="room-item-title">Sala ${room.roomId}</span>
        <span class="room-item-meta">Rodada ${room.round} • ${room.turnLabel}</span>
        <span class="room-item-meta">${room.players}/2 jogadores • ${room.roomId === this.roomId ? "Sua sala" : room.joinable ? "Entrar" : "Cheia"}</span>
      </button>
    `).join("");

    this.ui.roomList.querySelectorAll("[data-room-id]").forEach((button) => {
      button.addEventListener("click", () => {
        if (this.connected && button.dataset.roomId === this.roomId) {
          return;
        }
        this.joinRoom(this.serverUrl, button.dataset.roomId).catch((error) => {
          this.updateUiStatus(error.message);
        });
      });
    });
    this.updateLanActionState();
  }

  normalizeServerUrl(serverUrl) {
    return (serverUrl || window.location.origin).replace(/\/+$/, "");
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.serverUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(payload.error ?? "Falha de rede.");
    }

    return response.json();
  }

  updateLanActionState() {
    if (!this.ui.createRoomButton || !this.ui.leaveRoomButton || !this.ui.refreshRoomsButton) {
      return;
    }

    this.ui.createRoomButton.disabled = this.connected;
    this.ui.leaveRoomButton.disabled = !this.connected;
    this.ui.refreshRoomsButton.disabled = false;
  }
}
