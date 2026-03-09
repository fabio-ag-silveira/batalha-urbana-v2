import { CART_SIZE, CITY_LAYOUT } from "./config.js";
import { createCirclePoints, createRectPoints, degToRad, transformPoints } from "./math.js";

function drawRect(renderer, left, bottom, right, top, fill, stroke = "#000000") {
  renderer.drawPolygon(createRectPoints(left, bottom, right, top), { fill, stroke });
}

function drawWindow(renderer, centerX, centerY, color) {
  drawRect(renderer, centerX - 1.5, centerY - 1, centerX + 1.5, centerY + 1, color, "#111111");
}

function drawWindowWithOptions(renderer, centerX, centerY, color, options = {}) {
  renderer.drawPolygon(
    createRectPoints(centerX - 1.5, centerY - 1, centerX + 1.5, centerY + 1),
    { fill: color, stroke: "#111111", ...options },
  );
}

function drawDoor(renderer, centerX, centerY, color) {
  drawRect(renderer, centerX - 1, centerY - (CART_SIZE / 3), centerX + 1, centerY + (CART_SIZE / 3), color, "#111111");
}

function drawBuildingLarge(renderer, origin, scaleY = 1) {
  drawRect(
    renderer,
    origin.x - 6,
    origin.y - 14 * scaleY,
    origin.x + 6,
    origin.y + 14 * scaleY,
    "#7a7a7a",
  );

  const rows = [11, 7, 3, -1, -5, -9].map((value) => origin.y + value * scaleY);
  rows.forEach((rowY, index) => {
    drawWindow(renderer, origin.x + 3, rowY, index % 2 === 0 ? "#f6e151" : "#f5f5ef");
    drawWindow(renderer, origin.x - 3, rowY, index % 3 === 0 ? "#f6e151" : "#f5f5ef");
  });
  drawDoor(renderer, origin.x, origin.y - 10.5 * scaleY, "#f6e151");
}

function drawBuildingSmall(renderer, origin, scaleY = 1) {
  drawRect(
    renderer,
    origin.x - 6,
    origin.y - 14 * scaleY,
    origin.x + 6,
    origin.y + 10.5 * scaleY,
    "#373737",
  );

  const rows = [7.5, 3.5, -0.5, -4.5, -8.5].map((value) => origin.y + value * scaleY);
  rows.forEach((rowY, index) => {
    drawWindow(renderer, origin.x + 3, rowY, index % 2 === 0 ? "#f5f5ef" : "#f6e151");
    drawWindow(renderer, origin.x - 3, rowY, index % 3 === 0 ? "#f6e151" : "#f5f5ef");
  });
  drawDoor(renderer, origin.x, origin.y - 10.5 * scaleY, "#f6e151");
}

function drawTower(renderer, origin) {
  drawRect(renderer, origin.x - 6, origin.y - 14, origin.x + 6, origin.y + 14, "#0f0f0f");
  renderer.drawPolygon(createCirclePoints({ x: origin.x, y: origin.y + 9 }, 3.75), {
    fill: "#f6e151",
    stroke: "#111111",
  });
  renderer.drawPolygon([
    { x: origin.x - 6, y: origin.y + 14 },
    { x: origin.x, y: origin.y + 20 },
    { x: origin.x + 6, y: origin.y + 14 },
  ], { fill: "#161616", stroke: "#111111" });
  drawDoor(renderer, origin.x, origin.y - 12.5, "#f6e151");
}

function drawCitadel(renderer) {
  const stack = [{ sx: 0.5, sy: 2.5, tx: 0, ty: -5 }];

  const current = () => stack[stack.length - 1];
  const push = () => stack.push({ ...current() });
  const pop = () => stack.pop();
  const translate = (x, y) => {
    const transform = current();
    transform.tx += transform.sx * x;
    transform.ty += transform.sy * y;
  };
  const scale = (x, y) => {
    const transform = current();
    transform.sx *= x;
    transform.sy *= y;
  };
  const mapPoint = (point) => {
    const transform = current();
    return {
      x: transform.tx + transform.sx * point.x,
      y: transform.ty + transform.sy * point.y,
    };
  };
  const drawPolygonWithTransform = (points, fill = "#090909", stroke = "#090909") => {
    renderer.drawPolygon(points.map(mapPoint), { fill, stroke, space: "view" });
  };
  const drawPredioMaior = (fill = "#090909") => {
    drawPolygonWithTransform(createRectPoints(-6, -14, 6, 14), fill);
  };
  const drawJanela = (fill = "#090909") => {
    const mapped = [
      mapPoint({ x: -1.5, y: -1 }),
      mapPoint({ x: -1.5, y: 1 }),
      mapPoint({ x: 1.5, y: 1 }),
      mapPoint({ x: 1.5, y: -1 }),
    ];
    renderer.drawPolygon(mapped, { fill, stroke: "#090909", space: "view" });
  };
  const withTransform = ({ scaleX = 1, scaleY = 1, translateX = 0, translateY = 0 }, draw) => {
    push();
    scale(scaleX, scaleY);
    translate(translateX, translateY);
    draw();
    pop();
  };
  const drawWindowSequence = (steps) => {
    steps.forEach(({ dx, dy, fill = "#090909" }) => {
      translate(dx, dy);
      drawJanela(fill);
    });
  };

  [
    { scaleX: 1, scaleY: 0.5, translateX: 0, translateY: 14 },
    { scaleX: 1, scaleY: 0.321, translateX: 0, translateY: -29.6 },
    { scaleX: 0.69, scaleY: 0.32, translateX: -2.7, translateY: -5.6 },
    { scaleX: 0.2, scaleY: 0.1, translateX: 31.7, translateY: 2 },
  ].forEach((transform) => withTransform(transform, () => drawPredioMaior()));

  withTransform({ scaleX: 0.03, scaleY: 0.12, translateX: 225, translateY: -8 }, () => {
    drawPredioMaior();
    translate(-25, 5);
    drawPredioMaior();
  });

  withTransform({ translateX: 6, translateY: 11 }, () => {
    drawWindowSequence([
      { dx: 0, dy: 0 },
      { dx: -6, dy: 0 },
      { dx: 0, dy: -2 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0 },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0 },
    ]);
  });

  translate(-1, -2);
  drawJanela();
  translate(6, 0);

  withTransform({ translateX: -0.5, translateY: 0, scaleX: 0.7, scaleY: 1 }, () => {});

  translate(-6, -2);
  drawJanela();
  translate(6, 0);
  translate(-5, -2);
  drawJanela();
  translate(6, 0);
  drawJanela();

  withTransform({ translateX: -5, translateY: -2 }, () => {
    drawWindowSequence([
      { dx: 0, dy: 0 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: "#1a1a1a" },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0 },
      { dx: 0, dy: -1 },
    ]);
  });

  translate(-10, 20);
  withTransform({ scaleX: 0.8, scaleY: 0.6 }, () => {
    drawPolygonWithTransform([
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 6, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  withTransform({ scaleX: 0.03, scaleY: 0.2, translateX: -70, translateY: 0 }, () => {
    drawPredioMaior();
    [
      { dx: 400, dy: 7 },
      { dx: 35, dy: -15 },
      { dx: -105, dy: -2 },
    ].forEach(({ dx, dy }) => {
      translate(dx, dy);
      drawPredioMaior();
    });
  });
}

function drawWheel(renderer, center, color) {
  renderer.drawPolygon(createCirclePoints(center, 1.5), { fill: color, stroke: "#111111" });
}

function buildCannonPolygon(player) {
  const localBarrel = createRectPoints(-0.7, -3, 0.7, 3);
  const pivot = { x: 0, y: 3 };
  const translated = localBarrel.map((point) => ({ x: point.x, y: point.y + CART_SIZE }));
  return transformPoints(translated, { x: player.position.x, y: player.position.y + pivot.y, rotation: player.angle });
}

export function getProjectileOrigin(player) {
  const muzzleDistance = 6.5;
  const rotation = degToRad(player.angle);

  return {
    x: player.position.x + Math.cos(rotation) * 0 - Math.sin(rotation) * muzzleDistance,
    y: player.position.y + 3 + Math.sin(rotation) * 0 + Math.cos(rotation) * muzzleDistance,
  };
}

function buildProjectileTrajectory(player) {
  const speedY = player.velocity * Math.sin(degToRad(player.angle + 90));
  const speedX = player.velocity * Math.cos(degToRad(player.angle + 90));
  const origin = getProjectileOrigin(player);
  const points = [];
  const duration = Math.max(0.1, 4 * ((speedY * 2) / 9.81));

  for (let time = 0; time <= duration; time += 0.1) {
    points.push({
      x: origin.x + speedX * time,
      y: origin.y + speedY * time - (9.81 * time * time) / 2,
    });
  }

  return points;
}

export function drawScene(renderer, gameState) {
  drawCitadel(renderer);

  CITY_LAYOUT.forEach((building) => {
    const origin = { x: building.x, y: building.y };
    if (building.type === "large") {
      drawBuildingLarge(renderer, origin, building.scaleY ?? 1);
      return;
    }
    if (building.type === "small") {
      drawBuildingSmall(renderer, origin, building.scaleY ?? 1);
      return;
    }
    drawTower(renderer, origin);
  });

  gameState.players.forEach((player) => {
    const bodyColor = player.hitTint[player.damage];

    drawRect(
      renderer,
      player.position.x - CART_SIZE,
      player.position.y - 1.5,
      player.position.x + CART_SIZE,
      player.position.y + 1.5,
      bodyColor,
    );

    drawWheel(renderer, { x: player.position.x - CART_SIZE, y: player.position.y - 0.5 }, player.wheel);
    drawWheel(renderer, { x: player.position.x + CART_SIZE, y: player.position.y - 0.5 }, player.wheel);

    drawRect(renderer, player.position.x - 2, player.position.y + 1, player.position.x + 2, player.position.y + 5, bodyColor);
    renderer.drawPolygon(buildCannonPolygon(player), { fill: player.accent, stroke: "#111111" });
    renderer.drawPolygon(createCirclePoints({ x: player.position.x, y: player.position.y + 3 }, 1.5), {
      fill: player.accent,
      stroke: "#111111",
    });

    if (gameState.activeProjectile?.ownerId === player.id) {
      renderer.drawLine(buildProjectileTrajectory(player), { stroke: player.accent, lineWidth: 1.25 });
    }
  });

  if (gameState.activeProjectile) {
    renderer.drawPolygon(createCirclePoints(gameState.activeProjectile.position, 1.5), {
      fill: "#f5efe4",
      stroke: "#111111",
    });
  }
}
