import { CITY_TRANSFORM, VIEW_BOUNDS, WATER_Y } from "./config.js";

const VIEW_WIDTH = VIEW_BOUNDS.maxX - VIEW_BOUNDS.minX;
const MAX_ZOOM = 2.4;
const MARGIN_X = 9;
const MARGIN_TOP = 7;
const STORAGE_KEY = "batalha_urbana_camera";
const WIDE_PHASES = ["roundStart", "roundOver", "matchOver"];
// Base do enquadramento: 10 unidades abaixo da agua, em coordenadas de view.
const BOTTOM_VIEW = (WATER_Y - 10 + CITY_TRANSFORM.translateY) * CITY_TRANSFORM.scaleY;

function toView(point) {
  return {
    x: point.x * CITY_TRANSFORM.scaleX + CITY_TRANSFORM.translateX,
    y: (point.y + CITY_TRANSFORM.translateY) * CITY_TRANSFORM.scaleY,
  };
}

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "fixed";
  } catch {
    return true;
  }
}

// Camera so de render: enquadra os dois carrinhos, segue os projeteis e
// sempre mantem a rua na base da tela. A logica do jogo nao depende dela.
export class CameraController {
  constructor() {
    this.enabled = readPreference();
    this.zoom = 1;
    this.centerX = 0;
    this.focus = null;
    this.focusHoldMs = 0;
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, this.enabled ? "dynamic" : "fixed");
    } catch {
      // preferencia so vale para a sessao
    }
    return this.enabled;
  }

  // Explosoes seguram o foco um instante para o jogador ver o impacto.
  handleEvent(event) {
    if (event.type === "explosion") {
      this.focus = { x: event.x, y: event.y };
      this.focusHoldMs = 900;
    }
  }

  computeTarget(state, viewHeight) {
    if (!this.enabled || WIDE_PHASES.includes(state.phase)) {
      return { zoom: 1, centerX: 0 };
    }

    const points = state.players.map((player) => ({ x: player.position.x, y: player.position.y + 12 }));
    state.projectiles.forEach((projectile) => points.push(projectile.position));
    if (this.focus) {
      points.push(this.focus);
    }

    const view = points.map(toView);
    const minX = Math.min(...view.map((point) => point.x)) - MARGIN_X;
    const maxX = Math.max(...view.map((point) => point.x)) + MARGIN_X;
    const maxY = Math.max(...view.map((point) => point.y)) + MARGIN_TOP;
    const zoomX = VIEW_WIDTH / Math.max(1, maxX - minX);
    const zoomY = viewHeight / Math.max(1, maxY - BOTTOM_VIEW);
    return {
      zoom: Math.min(MAX_ZOOM, Math.max(1, Math.min(zoomX, zoomY))),
      centerX: (minX + maxX) / 2,
    };
  }

  update(dt, state, renderer) {
    this.focusHoldMs -= dt * 1000;
    if (this.focusHoldMs <= 0 && !state.projectiles.length) {
      this.focus = null;
    }

    const target = this.computeTarget(state, renderer.viewHeight);
    const speed = state.phase === "flying" ? 5 : 2.5;
    const blend = 1 - Math.exp(-dt * speed);
    // Interpolar o zoom em escala logaritmica deixa a aproximacao uniforme.
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(target.zoom) - Math.log(this.zoom)) * blend);
    this.centerX += (target.centerX - this.centerX) * blend;
    if (Math.abs(this.zoom - target.zoom) < 0.001) {
      this.zoom = target.zoom;
    }
    if (Math.abs(this.centerX - target.centerX) < 0.01) {
      this.centerX = target.centerX;
    }

    const visibleWidth = VIEW_WIDTH / this.zoom;
    const left = Math.min(VIEW_BOUNDS.maxX - visibleWidth, Math.max(VIEW_BOUNDS.minX, this.centerX - visibleWidth / 2));
    renderer.camera = { left, bottom: BOTTOM_VIEW, zoom: this.zoom };
  }
}
