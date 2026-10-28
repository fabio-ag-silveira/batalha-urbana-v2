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
    this.commandQueue = Promise.resolve();
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

  // Comandos vao em fila para que "soltar" nunca chegue antes de "apertar".
  sendCommand(command) {
    if (!this.connected) {
      return Promise.resolve(false);
    }

    const roomId = this.roomId;
    const playerId = this.playerId;
    const send = () => this.request(`/api/rooms/${roomId}/action`, {
      method: "POST",
      body: JSON.stringify({ playerId, command }),
    }).catch((error) => {
      // 409 = acao recusada (fora da vez); nao e erro de rede.
      if (error.status !== 409) {
        throw error;
      }
    });
    const result = this.commandQueue.then(send, send);
    this.commandQueue = result.catch(() => {});
    return result.then(() => true);
  }

  sendInput(control, pressed, cancel = false) {
    return this.sendCommand({ type: "input", control, pressed, cancel });
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
    this.refreshStatus();
  }

  async fetchRooms() {
    if (!this.serverUrl) {
      return [];
    }

    const rooms = await this.request("/api/rooms");
    this.renderRoomList(rooms);
    return rooms;
  }

  refreshStatus() {
    if (this.connected) {
      this.updateUiStatus(`Conectado como Player ${this.playerId} na sala ${this.roomId}`);
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
      const error = new Error(payload.error ?? "Falha de rede.");
      error.status = response.status;
      throw error;
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
