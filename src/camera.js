import { CITY_TRANSFORM, VIEW_BOUNDS } from "./config.js";
import { getMap } from "./map.js";

const VIEW_WIDTH = VIEW_BOUNDS.maxX - VIEW_BOUNDS.minX;
const MAX_ZOOM = 2.4;
// Abaixo de 1 a camera se afasta para caber ilhas altas em telas largas e baixas.
const MIN_ZOOM = 0.55;
const MARGIN_X = 9;
// Espaco acima do ponto mais alto para nome, barra de HP e seta do carrinho.
const MARGIN_TOP = 12;
const STORAGE_KEY = "batalha_urbana_camera";
const WIDE_PHASES = ["roundStart", "roundOver", "matchOver"];

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

  frame(points, viewHeight, maxZoom) {
    const view = points.map(toView);
    const minX = Math.min(...view.map((point) => point.x)) - MARGIN_X;
    const maxX = Math.max(...view.map((point) => point.x)) + MARGIN_X;
    const maxY = Math.max(...view.map((point) => point.y)) + MARGIN_TOP;
    const zoomX = VIEW_WIDTH / Math.max(1, maxX - minX);
    const zoomY = viewHeight / Math.max(1, maxY - VIEW_BOUNDS.minY);
    return {
      zoom: Math.min(maxZoom, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY))),
      centerX: (minX + maxX) / 2,
    };
  }

  // Visao geral: o mapa inteiro, com todas as ilhas e os dois carrinhos.
  overview(state, viewHeight) {
    const points = [{ x: -200, y: 0 }, { x: 200, y: 0 }];
    getMap(state.seed).islands.forEach((island) => points.push({ x: island.left, y: island.topY + 8 }));
    state.players.forEach((player) => points.push({ x: player.position.x, y: player.position.y + 12 }));
    return this.frame(points, viewHeight, 1);
  }

  computeTarget(state, viewHeight) {
    if (!this.enabled || WIDE_PHASES.includes(state.phase)) {
      return this.overview(state, viewHeight);
    }

    const points = state.players.map((player) => ({ x: player.position.x, y: player.position.y + 12 }));
    state.projectiles.forEach((projectile) => points.push(projectile.position));
    if (this.focus) {
      points.push(this.focus);
    }
    return this.frame(points, viewHeight, MAX_ZOOM);
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

    // Com zoom menor que 1 a vista e mais larga que o mapa: centraliza.
    const visibleWidth = VIEW_WIDTH / this.zoom;
    const left = visibleWidth >= VIEW_WIDTH
      ? -visibleWidth / 2
      : Math.min(VIEW_BOUNDS.maxX - visibleWidth, Math.max(VIEW_BOUNDS.minX, this.centerX - visibleWidth / 2));
    renderer.camera = { left, bottom: VIEW_BOUNDS.minY, zoom: this.zoom };
  }
}
