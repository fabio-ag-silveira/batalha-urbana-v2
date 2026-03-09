import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "./src/game.js";
import { GAME_MODES } from "./src/config.js";

const PORT = Number(process.env.PORT || 8000);
const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const rooms = new Map();

function createStubUi() {
  return {
    modeLabel: { textContent: "" },
    difficultyLabel: { textContent: "" },
    roundLabel: { textContent: "" },
    turnLabel: { textContent: "" },
    statusLabel: { textContent: "" },
    playerOneStats: { innerHTML: "" },
    playerTwoStats: { innerHTML: "" },
    modeButtons: [],
    difficultyButtons: [],
  };
}

function createRoomState() {
  const game = new Game(createStubUi());
  game.setMode(GAME_MODES.local);
  game.resetRound();
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    game,
    players: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function findRoom(roomId) {
  return rooms.get(String(roomId || "").toUpperCase());
}

function getRoomPlayerCount(room) {
  return room.players.size;
}

function getPlayerSlotByClient(room, clientId) {
  for (const [slot, occupantId] of room.players.entries()) {
    if (occupantId === clientId) {
      return slot;
    }
  }
  return null;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload muito grande."));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    request.on("error", reject);
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/rooms") {
    const payload = [...rooms.values()].map((room) => ({
      roomId: room.id,
      players: getRoomPlayerCount(room),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      status: room.game.status,
      turnLabel: room.game.currentPlayer.label,
      round: room.game.round + 1,
      joinable: getRoomPlayerCount(room) < 2,
    }));
    writeJson(response, 200, payload);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms/create") {
    const { clientId } = await parseBody(request);
    if (!clientId) {
      writeJson(response, 400, { error: "clientId obrigatorio." });
      return true;
    }
    const room = createRoomState();
    room.players.set(1, clientId);
    rooms.set(room.id, room);
    writeJson(response, 200, { roomId: room.id, playerId: 1 });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/rooms/join") {
    const { roomId, clientId } = await parseBody(request);
    if (!clientId) {
      writeJson(response, 400, { error: "clientId obrigatorio." });
      return true;
    }
    const room = findRoom(roomId);
    if (!room) {
      writeJson(response, 404, { error: "Sala nao encontrada." });
      return true;
    }
    const existingSlot = getPlayerSlotByClient(room, clientId);
    if (existingSlot) {
      writeJson(response, 200, { roomId: room.id, playerId: existingSlot });
      return true;
    }
    if (getRoomPlayerCount(room) >= 2) {
      writeJson(response, 409, { error: "Sala cheia." });
      return true;
    }
    room.players.set(2, clientId);
    room.updatedAt = Date.now();
    writeJson(response, 200, { roomId: room.id, playerId: 2 });
    return true;
  }

  const leaveMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/leave$/);
  if (request.method === "POST" && leaveMatch) {
    const room = findRoom(leaveMatch[1]);
    if (!room) {
      writeJson(response, 200, { ok: true });
      return true;
    }
    const { clientId } = await parseBody(request);
    const slot = getPlayerSlotByClient(room, clientId);
    if (slot) {
      room.players.delete(slot);
      room.updatedAt = Date.now();
    }
    if (room.players.size === 0) {
      rooms.delete(room.id);
    }
    writeJson(response, 200, { ok: true });
    return true;
  }

  const stateMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/state$/);
  if (request.method === "GET" && stateMatch) {
    const room = findRoom(stateMatch[1]);
    if (!room) {
      writeJson(response, 404, { error: "Sala nao encontrada." });
      return true;
    }
    writeJson(response, 200, room.game.getSnapshot());
    return true;
  }

  const actionMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/action$/);
  if (request.method === "POST" && actionMatch) {
    const room = findRoom(actionMatch[1]);
    if (!room) {
      writeJson(response, 404, { error: "Sala nao encontrada." });
      return true;
    }
    const { playerId, command } = await parseBody(request);
    const applied = room.game.applyNetworkCommand(Number(playerId), command);
    room.updatedAt = Date.now();
    writeJson(response, applied ? 200 : 409, { ok: applied });
    return true;
  }

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  pathname = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, pathname);

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
  });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    if (await handleApi(request, response)) {
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    writeJson(response, 500, { error: error.message || "Erro interno." });
  }
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, roomId) => {
    room.game.update(16);
    if (now - room.updatedAt > 1000 * 60 * 60 * 4) {
      rooms.delete(roomId);
    }
  });
}, 16);

server.listen(PORT, "0.0.0.0", async () => {
  const indexPath = join(ROOT, "index.html");
  const hasIndex = existsSync(indexPath);
  console.log(`Batalha Urbana LAN server on http://0.0.0.0:${PORT}`);
  if (!hasIndex) {
    console.warn("index.html nao encontrado.");
  }
});
