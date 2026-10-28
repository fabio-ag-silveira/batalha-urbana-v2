import { CITY_TRANSFORM, VIEW_BOUNDS } from "./config.js";

const VIEW_WIDTH = VIEW_BOUNDS.maxX - VIEW_BOUNDS.minX;
const VIEW_HEIGHT = VIEW_BOUNDS.maxY - VIEW_BOUNDS.minY;
// Proporcao em que o enquadramento legado [-40, 40] nao distorce a cena.
const REFERENCE_ASPECT = 1.5;

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.mainContext = canvas.getContext("2d");
    this.context = this.mainContext;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.viewHeight = VIEW_HEIGHT;
    // Camera em coordenadas de view; so afeta o espaco "gameplay".
    this.camera = { left: VIEW_BOUNDS.minX, bottom: VIEW_BOUNDS.minY, zoom: 1 };
    this.layers = new Map();
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    if (width !== this.width || height !== this.height || ratio !== this.pixelRatio) {
      this.width = width;
      this.height = height;
      this.pixelRatio = ratio;
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      // A largura visivel e fixa; a altura acompanha a tela, ancorada na rua,
      // para a cena nao achatar em telas largas (ex.: celular deitado).
      const aspect = width / height;
      this.viewHeight = Math.min(200, Math.max(30, (VIEW_HEIGHT * REFERENCE_ASPECT) / aspect));
    }
  }

  beginFrame() {
    this.resize();
    this.context = this.mainContext;
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";
  }

  toScreen(point, space = "gameplay") {
    const isGameplay = space === "gameplay";
    const viewX = isGameplay
      ? point.x * CITY_TRANSFORM.scaleX + CITY_TRANSFORM.translateX
      : point.x;
    const viewY = isGameplay
      ? (point.y + CITY_TRANSFORM.translateY) * CITY_TRANSFORM.scaleY
      : point.y;
    const zoom = isGameplay ? this.camera.zoom : 1;
    const left = isGameplay ? this.camera.left : VIEW_BOUNDS.minX;
    const bottom = isGameplay ? this.camera.bottom : VIEW_BOUNDS.minY;
    const normalizedX = ((viewX - left) * zoom) / VIEW_WIDTH;
    const normalizedY = ((viewY - bottom) * zoom) / this.viewHeight;

    return {
      x: normalizedX * this.width,
      y: this.height - normalizedY * this.height,
    };
  }

  get cameraKey() {
    const { left, zoom } = this.camera;
    return `${left.toFixed(2)}:${zoom.toFixed(3)}`;
  }

  unitsToPixels(units, space = "gameplay") {
    const isGameplay = space === "gameplay";
    const zoom = isGameplay ? this.camera.zoom : 1;
    const scaleX = (isGameplay ? CITY_TRANSFORM.scaleX : 1) * zoom;
    const scaleY = (isGameplay ? CITY_TRANSFORM.scaleY : 1) * zoom;
    return {
      x: (units * scaleX * this.width) / VIEW_WIDTH,
      y: (units * scaleY * this.height) / this.viewHeight,
    };
  }

  applyStyle(options) {
    const context = this.context;
    context.globalAlpha = options.alpha ?? 1;
    if (options.fill) {
      context.fillStyle = options.fill;
      context.fill();
    }
    if (options.stroke) {
      context.lineWidth = options.lineWidth ?? 1;
      context.strokeStyle = options.stroke;
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  fillVerticalGradient(stops, top = 0, bottom = this.height) {
    const gradient = this.context.createLinearGradient(0, top, 0, bottom);
    stops.forEach((color, index) => gradient.addColorStop(index / Math.max(1, stops.length - 1), color));
    this.context.fillStyle = gradient;
    this.context.fillRect(-40, top, this.width + 80, bottom - top);
  }

  drawPolygon(points, options = {}) {
    if (!points.length) {
      return;
    }

    const screenPoints = points.map((point) => this.toScreen(point, options.space));
    const context = this.context;

    context.beginPath();
    context.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let index = 1; index < screenPoints.length; index += 1) {
      context.lineTo(screenPoints[index].x, screenPoints[index].y);
    }
    context.closePath();
    this.applyStyle(options);
  }

  drawLine(points, options = {}) {
    if (points.length < 2) {
      return;
    }

    const screenPoints = points.map((point) => this.toScreen(point, options.space));
    const context = this.context;

    context.beginPath();
    context.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let index = 1; index < screenPoints.length; index += 1) {
      context.lineTo(screenPoints[index].x, screenPoints[index].y);
    }

    context.setLineDash(options.dash ?? []);
    context.lineCap = options.cap ?? "round";
    this.applyStyle({ ...options, fill: null, stroke: options.stroke ?? "#000000", lineWidth: options.lineWidth ?? 1.5 });
    context.setLineDash([]);
  }

  drawEllipse(center, radius, options = {}) {
    const screen = this.toScreen(center, options.space);
    const size = this.unitsToPixels(radius, options.space);
    this.context.beginPath();
    this.context.ellipse(screen.x, screen.y, Math.max(0.1, size.x), Math.max(0.1, size.y), 0, 0, Math.PI * 2);
    this.applyStyle(options);
  }

  drawScreenCircle(x, y, radius, options = {}) {
    this.context.beginPath();
    this.context.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2);
    this.applyStyle(options);
  }

  drawGlow(x, y, radius, color) {
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    this.context.fillStyle = gradient;
    this.context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  drawRoundedRect(x, y, width, height, radius, options = {}) {
    this.context.beginPath();
    this.context.roundRect(x, y, width, height, radius);
    this.applyStyle(options);
  }

  drawText(text, x, y, options = {}) {
    const context = this.context;
    context.font = options.font ?? "700 12px 'Trebuchet MS', 'Segoe UI', sans-serif";
    context.textAlign = options.align ?? "center";
    context.textBaseline = options.baseline ?? "middle";
    context.globalAlpha = options.alpha ?? 1;
    if (options.outline) {
      context.lineWidth = options.outlineWidth ?? 3;
      context.strokeStyle = options.outline;
      context.lineJoin = "round";
      context.strokeText(text, x, y);
    }
    context.fillStyle = options.fill ?? "#ffffff";
    context.fillText(text, x, y);
    context.globalAlpha = 1;
  }

  // Desenha uma camada cacheada em canvas offscreen; so redesenha quando a versao muda.
  drawLayer(key, version, draw) {
    let layer = this.layers.get(key);
    if (!layer) {
      layer = { canvas: document.createElement("canvas"), version: null };
      this.layers.set(key, layer);
    }

    if (layer.canvas.width !== this.canvas.width || layer.canvas.height !== this.canvas.height) {
      layer.canvas.width = this.canvas.width;
      layer.canvas.height = this.canvas.height;
      layer.version = null;
    }

    if (layer.version !== version) {
      const layerContext = layer.canvas.getContext("2d");
      layerContext.setTransform(1, 0, 0, 1, 0, 0);
      layerContext.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layerContext.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      const previous = this.context;
      this.context = layerContext;
      try {
        draw(layerContext);
      } finally {
        this.context = previous;
      }
      layer.version = version;
    }

    this.context.drawImage(layer.canvas, 0, 0, this.width, this.height);
  }
}
