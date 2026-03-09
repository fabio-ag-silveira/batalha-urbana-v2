export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function transformPoint(point, transform = {}) {
  const rotation = degToRad(transform.rotation ?? 0);
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;

  const x = point.x * scaleX;
  const y = point.y * scaleY;

  return {
    x: x * Math.cos(rotation) - y * Math.sin(rotation) + tx,
    y: x * Math.sin(rotation) + y * Math.cos(rotation) + ty,
  };
}

export function transformPoints(points, transform) {
  return points.map((point) => transformPoint(point, transform));
}

export function createRectPoints(left, bottom, right, top) {
  return [
    { x: left, y: bottom },
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
  ];
}

export function createCirclePoints(center, radius, segments = 28) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return points;
}

export function isPointInsideRect(point, rect) {
  return (
    point.x >= rect.x - rect.halfWidth &&
    point.x <= rect.x + rect.halfWidth &&
    point.y >= rect.y - rect.halfHeight &&
    point.y <= rect.y + rect.halfHeight
  );
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
