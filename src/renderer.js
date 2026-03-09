import { CITY_TRANSFORM, VIEW_BOUNDS } from "./config.js";

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  clear(color) {
    this.context.fillStyle = color;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toScreen(point, space = "gameplay") {
    const isGameplay = space === "gameplay";
    const viewX = isGameplay
      ? point.x * CITY_TRANSFORM.scaleX + CITY_TRANSFORM.translateX
      : point.x;
    const viewY = isGameplay
      ? (point.y + CITY_TRANSFORM.translateY) * CITY_TRANSFORM.scaleY
      : point.y;
    const normalizedX = (viewX - VIEW_BOUNDS.minX) / (VIEW_BOUNDS.maxX - VIEW_BOUNDS.minX);
    const normalizedY = (viewY - VIEW_BOUNDS.minY) / (VIEW_BOUNDS.maxY - VIEW_BOUNDS.minY);

    return {
      x: normalizedX * this.canvas.width,
      y: this.canvas.height - normalizedY * this.canvas.height,
    };
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

    if (options.fill) {
      context.fillStyle = options.fill;
      context.fill();
    }

    if (options.stroke) {
      context.lineWidth = options.lineWidth ?? 1;
      context.strokeStyle = options.stroke;
      context.stroke();
    }
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

    context.lineWidth = options.lineWidth ?? 1.5;
    context.strokeStyle = options.stroke ?? "#000000";
    context.stroke();
  }
}
