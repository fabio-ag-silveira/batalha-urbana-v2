import {
  CART_SIZE,
  CRATES,
  FUEL_PER_TURN,
  MAX_HP,
  ROUND_MODIFIERS,
  ROUNDS_TO_WIN,
  SEA_FLOOR_Y,
  SKY_THEMES,
  TURN_TIME_MS,
  VIEW_BOUNDS,
  WATER_Y,
  WEAPONS,
  WIND_MAX,
} from "./config.js";
import { clamp, createRectPoints, createRng, transformPoints } from "./math.js";
import { getProjectileOrigin, terrainHeightAt } from "./physics.js";
import { getMap } from "./map.js";

const FONT = "'Trebuchet MS', 'Segoe UI', sans-serif";

function drawRect(renderer, left, bottom, right, top, fill, stroke = "#000000", alpha = 1) {
  renderer.drawPolygon(createRectPoints(left, bottom, right, top), { fill, stroke, alpha });
}

function drawWindow(renderer, centerX, centerY, color) {
  drawRect(renderer, centerX - 1.5, centerY - 1, centerX + 1.5, centerY + 1, color, "#111111");
}

function drawDoor(renderer, centerX, centerY, color) {
  drawRect(renderer, centerX - 1, centerY - (CART_SIZE / 3), centerX + 1, centerY + (CART_SIZE / 3), color, "#111111");
}

function pickWindowColor(theme, rng) {
  return rng() < theme.litChance ? theme.windowLit : theme.windowDark;
}

function drawBuildingBody(renderer, origin, bottom, top, fill) {
  drawRect(renderer, origin.x - 6, bottom, origin.x + 6, top, fill);
  drawRect(renderer, origin.x + 3.2, bottom, origin.x + 6, top, "#000000", null, 0.2);
  drawRect(renderer, origin.x - 6.6, top - 0.5, origin.x + 6.6, top + 0.8, fill);
  drawRect(renderer, origin.x - 6.6, top + 0.3, origin.x + 6.6, top + 0.8, "#ffffff", null, 0.18);
}

function drawBuildingLarge(renderer, origin, scaleY, theme, rng) {
  drawBuildingBody(renderer, origin, origin.y - 14 * scaleY, origin.y + 14 * scaleY, theme.buildings.large);
  [11, 7, 3, -1, -5, -9].forEach((value) => {
    const rowY = origin.y + value * scaleY;
    drawWindow(renderer, origin.x + 3, rowY, pickWindowColor(theme, rng));
    drawWindow(renderer, origin.x - 3, rowY, pickWindowColor(theme, rng));
  });
  drawDoor(renderer, origin.x, origin.y - 10.5 * scaleY, theme.windowLit);
}

function drawBuildingSmall(renderer, origin, scaleY, theme, rng) {
  drawBuildingBody(renderer, origin, origin.y - 14 * scaleY, origin.y + 10.5 * scaleY, theme.buildings.small);
  [7.5, 3.5, -0.5, -4.5, -8.5].forEach((value) => {
    const rowY = origin.y + value * scaleY;
    drawWindow(renderer, origin.x + 3, rowY, pickWindowColor(theme, rng));
    drawWindow(renderer, origin.x - 3, rowY, pickWindowColor(theme, rng));
  });
  drawDoor(renderer, origin.x, origin.y - 10.5 * scaleY, theme.windowLit);
}

function drawTower(renderer, origin, theme) {
  drawRect(renderer, origin.x - 6, origin.y - 14, origin.x + 6, origin.y + 14, theme.buildings.tower);
  drawRect(renderer, origin.x + 3.2, origin.y - 14, origin.x + 6, origin.y + 14, "#000000", null, 0.25);
  renderer.drawEllipse({ x: origin.x, y: origin.y + 9 }, 3.75, { fill: theme.windowLit, stroke: "#111111" });
  renderer.drawLine([{ x: origin.x, y: origin.y + 9 }, { x: origin.x, y: origin.y + 11.5 }], { stroke: "#111111", lineWidth: 1.5 });
  renderer.drawLine([{ x: origin.x, y: origin.y + 9 }, { x: origin.x + 1.8, y: origin.y + 9 }], { stroke: "#111111", lineWidth: 1.5 });
  renderer.drawPolygon([
    { x: origin.x - 6.6, y: origin.y + 14 },
    { x: origin.x, y: origin.y + 20 },
    { x: origin.x + 6.6, y: origin.y + 14 },
  ], { fill: theme.buildings.tower, stroke: "#111111" });
  drawDoor(renderer, origin.x, origin.y - 12.5, theme.windowLit);
}

function drawCitadel(renderer, palette) {
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
  const drawPolygonWithTransform = (points, fill = palette.fill, stroke = palette.fill) => {
    renderer.drawPolygon(points.map(mapPoint), { fill, stroke, space: "view" });
  };
  const drawPredioMaior = (fill = palette.fill) => {
    drawPolygonWithTransform(createRectPoints(-6, -14, 6, 14), fill);
  };
  const drawJanela = (fill = palette.fill) => {
    const mapped = [
      mapPoint({ x: -1.5, y: -1 }),
      mapPoint({ x: -1.5, y: 1 }),
      mapPoint({ x: 1.5, y: 1 }),
      mapPoint({ x: 1.5, y: -1 }),
    ];
    renderer.drawPolygon(mapped, { fill, stroke: palette.fill, space: "view" });
  };
  const withTransform = ({ scaleX = 1, scaleY = 1, translateX = 0, translateY = 0 }, draw) => {
    push();
    scale(scaleX, scaleY);
    translate(translateX, translateY);
    draw();
    pop();
  };
  const drawWindowSequence = (steps) => {
    steps.forEach(({ dx, dy, fill = palette.fill }) => {
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
      { dx: 6, dy: 0, fill: palette.window },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: palette.window },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: palette.window },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: palette.window },
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
      { dx: 6, dy: 0, fill: palette.window },
      { dx: -6, dy: -2 },
      { dx: 6, dy: 0, fill: palette.window },
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

function screenEllipse(renderer, x, y, radiusX, radiusY, fill, alpha = 1) {
  const context = renderer.context;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.globalAlpha = alpha;
  context.fillStyle = fill;
  context.fill();
  context.globalAlpha = 1;
}

function drawSky(renderer, theme, time, cloudOffset) {
  const { width, height } = renderer;
  renderer.fillVerticalGradient(theme.sky, -40, height + 40);

  if (theme.stars) {
    const rng = createRng(1337);
    for (let index = 0; index < 90; index += 1) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * (1.5 + rng() * 2) + index);
      renderer.drawScreenCircle(rng() * width, rng() * height * 0.65, 0.5 + rng() * 1.1, {
        fill: "#ffffff",
        alpha: 0.25 + 0.6 * twinkle,
      });
    }
  }

  const bodyX = width * 0.8;
  const bodyY = height * 0.17;
  const bodyRadius = Math.min(width, height) * 0.045;
  renderer.drawGlow(bodyX, bodyY, bodyRadius * 4.5, theme.body.glow);
  renderer.drawScreenCircle(bodyX, bodyY, bodyRadius, { fill: theme.body.color });
  if (theme.body.kind === "moon") {
    renderer.drawScreenCircle(bodyX - bodyRadius * 0.3, bodyY - bodyRadius * 0.2, bodyRadius * 0.22, { fill: "#000000", alpha: 0.08 });
    renderer.drawScreenCircle(bodyX + bodyRadius * 0.35, bodyY + bodyRadius * 0.3, bodyRadius * 0.15, { fill: "#000000", alpha: 0.08 });
  }

  const rng = createRng(4242);
  const span = width + 360;
  for (let index = 0; index < 7; index += 1) {
    const scale = 0.6 + rng() * 0.9;
    const baseX = rng() * span;
    const y = height * (0.08 + rng() * 0.38);
    const x = ((((baseX + cloudOffset * (0.5 + scale * 0.5)) % span) + span) % span) - 180;
    screenEllipse(renderer, x, y, 42 * scale, 14 * scale, theme.cloud);
    screenEllipse(renderer, x + 26 * scale, y - 9 * scale, 30 * scale, 15 * scale, theme.cloud);
    screenEllipse(renderer, x - 28 * scale, y + 2 * scale, 26 * scale, 10 * scale, theme.cloud);
    screenEllipse(renderer, x + 52 * scale, y + 3 * scale, 24 * scale, 9 * scale, theme.cloud);
  }
}

function drawBackdrop(renderer, state, theme) {
  renderer.drawLayer("backdrop", `${state.seed}:${state.theme}`, () => {
    const rng = createRng(state.seed ^ 0x5bd1e995);
    let x = -42;
    while (x < 42) {
      const width = 2 + rng() * 4;
      const top = -35 + rng() * 15;
      renderer.drawPolygon(createRectPoints(x, -40, x + width, top), { fill: theme.distant, space: "view", alpha: 0.85 });
      if (rng() < 0.25) {
        renderer.drawLine([{ x: x + width / 2, y: top }, { x: x + width / 2, y: top + 2.5 }], {
          stroke: theme.distant,
          lineWidth: 1.5,
          space: "view",
        });
      }
      x += width + rng() * 0.8;
    }
    drawCitadel(renderer, theme.citadel);
    const context = renderer.context;
    context.globalCompositeOperation = "source-atop";
    context.globalAlpha = 0.45;
    context.fillStyle = theme.sky[1];
    context.fillRect(0, 0, renderer.width, renderer.height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    const hazeTop = renderer.toScreen({ x: 0, y: -14 }, "view").y;
    renderer.fillVerticalGradient(["rgba(0, 0, 0, 0)", theme.haze], hazeTop, renderer.height);
  });
}

function drawBuildings(renderer, map, theme, rng) {
  map.buildings.forEach((building) => {
    const origin = { x: building.x, y: building.y };
    if (building.type === "large") {
      drawBuildingLarge(renderer, origin, building.scaleY, theme, rng);
    } else if (building.type === "small") {
      drawBuildingSmall(renderer, origin, building.scaleY, theme, rng);
    } else {
      drawTower(renderer, origin, theme);
    }
  });
}

// Ilhas (terreno + predios) numa camada cacheada; crateras recortadas como antes.
function drawIslands(renderer, state, theme, map) {
  const lastCrater = state.craters[state.craters.length - 1];
  const version = `${state.seed}:${state.theme}:${state.craters.length}:${lastCrater?.x ?? ""}:${renderer.cameraKey}`;

  renderer.drawLayer("islands", version, (context) => {
    const surface = map.heights.map((height, index) => ({ x: map.minX + index * map.step, y: height }));
    const outline = [
      { x: map.minX, y: SEA_FLOOR_Y - 30 },
      ...surface,
      { x: surface[surface.length - 1].x, y: SEA_FLOOR_Y - 30 },
    ];
    const top = renderer.toScreen({ x: 0, y: WATER_Y + 32 }).y;
    const bottom = renderer.toScreen({ x: 0, y: WATER_Y - 2 }).y;
    const gradient = context.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, theme.rock);
    gradient.addColorStop(0.45, theme.soil);
    gradient.addColorStop(0.82, theme.sand);
    gradient.addColorStop(1, theme.sand);
    renderer.drawPolygon(outline, { fill: gradient, stroke: "rgba(0, 0, 0, 0.35)", lineWidth: 1 });

    // Grama so onde o terreno fica bem acima da agua.
    let run = [];
    const flushGrass = () => {
      if (run.length > 1) {
        renderer.drawLine(run, { stroke: theme.grass, lineWidth: 2.5 * renderer.camera.zoom });
      }
      run = [];
    };
    surface.forEach((point) => {
      if (point.y > WATER_Y + 3) {
        run.push(point);
      } else {
        flushGrass();
      }
    });
    flushGrass();

    drawBuildings(renderer, map, theme, createRng(state.seed));

    if (state.craters.length) {
      // Primeiro queima a borda (so onde ha solido), depois recorta o buraco.
      context.globalCompositeOperation = "source-atop";
      state.craters.forEach((crater) => renderer.drawEllipse(crater, crater.r * 1.35, { fill: "rgba(28, 16, 8, 0.6)" }));
      context.globalCompositeOperation = "destination-out";
      state.craters.forEach((crater) => renderer.drawEllipse(crater, crater.r, { fill: "#000000" }));
      context.globalCompositeOperation = "source-over";
    }
  });
}

// Mar translucido por cima das ilhas: as praias somem naturalmente sob as ondas.
function drawWater(renderer, theme, time) {
  const context = renderer.context;
  const { width, height } = renderer;
  const { left, zoom } = renderer.camera;
  const surfaceY = renderer.toScreen({ x: 0, y: WATER_Y }).y;
  const visibleWidth = (VIEW_BOUNDS.maxX - VIEW_BOUNDS.minX) / zoom;
  const amplitude = 1.5 + zoom;

  const wave = (screenX, phase) => {
    const viewX = left + (screenX / width) * visibleWidth;
    return surfaceY + Math.sin(viewX * 0.9 + time * 1.6 + phase) * amplitude
      + Math.sin(viewX * 0.37 - time * 0.9 + phase) * amplitude * 0.6;
  };
  const tracePath = (phase) => {
    context.beginPath();
    context.moveTo(-40, height + 40);
    for (let x = -40; x <= width + 40; x += 12) {
      context.lineTo(x, wave(x, phase));
    }
    context.lineTo(width + 40, height + 40);
    context.closePath();
  };

  const gradient = context.createLinearGradient(0, surfaceY, 0, height);
  gradient.addColorStop(0, theme.water);
  gradient.addColorStop(1, theme.waterDeep);
  tracePath(1.7);
  renderer.applyStyle({ fill: theme.water, alpha: 0.35 });
  tracePath(0);
  renderer.applyStyle({ fill: gradient });

  context.beginPath();
  for (let x = -40; x <= width + 40; x += 12) {
    const y = wave(x, 0);
    if (x === -40) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  renderer.applyStyle({ stroke: theme.waterLine, lineWidth: 1.5 });
}

function buildCannonPolygon(player, pivot, recoil) {
  const kick = recoil * 1.5;
  const barrel = createRectPoints(-0.7, 0.5 - kick, 0.7, 6.5 - kick);
  return transformPoints(barrel, { x: pivot.x, y: pivot.y, rotation: player.angle });
}

// Inclinacao visual pelo relevo; em telhado ou no ar o carrinho fica reto.
function cartTilt(player, map) {
  const { x, y } = player.position;
  const onBuilding = [-2.5, 2.5].some((offset) => map.colliders.some((collider) =>
    Math.abs(collider.x - (x + offset)) <= collider.halfWidth &&
    Math.abs(collider.y + collider.halfHeight - (y - 2.5)) < 1.5));
  if (player.falling || onBuilding) {
    return 0;
  }
  const slope = (terrainHeightAt(map, x + 3) - terrainHeightAt(map, x - 3)) / 6;
  return clamp((Math.atan(slope) * 180) / Math.PI, -30, 30);
}

function drawCart(renderer, player, recoil, map) {
  const sinkOffset = player.sunk ? 4 : 0;
  const base = { x: player.position.x, y: player.position.y - sinkOffset };
  const rotation = cartTilt(player, map);
  const place = (points) => transformPoints(points, { x: base.x, y: base.y, rotation });
  const placePoint = (x, y) => place([{ x, y }])[0];

  renderer.drawPolygon(buildCannonPolygon(player, placePoint(0, 3), recoil), { fill: player.color, stroke: "#111111" });
  renderer.drawPolygon(place(createRectPoints(-2, 1, 2, 4.4)), { fill: player.shade, stroke: "#000000" });
  renderer.drawPolygon(place([
    { x: -3.9, y: -1.4 },
    { x: -3.4, y: 1.6 },
    { x: 3.4, y: 1.6 },
    { x: 3.9, y: -1.4 },
  ]), { fill: player.color, stroke: "#111111" });
  renderer.drawPolygon(place(createRectPoints(-3.2, 0.9, 3.2, 1.4)), { fill: "#ffffff", alpha: 0.35 });
  renderer.drawPolygon(place(createRectPoints(-3.8, -1.4, 3.8, -0.5)), { fill: "#000000", alpha: 0.25 });

  [-1, 1].forEach((side) => {
    const center = placePoint(side * CART_SIZE, -0.5);
    const spin = base.x / 1.5;
    renderer.drawEllipse(center, 1.5, { fill: "#16181d", stroke: "#000000" });
    renderer.drawEllipse(center, 0.65, { fill: player.shade });
    renderer.drawLine([
      { x: center.x - Math.cos(spin) * 1.2, y: center.y - Math.sin(spin) * 1.2 },
      { x: center.x + Math.cos(spin) * 1.2, y: center.y + Math.sin(spin) * 1.2 },
    ], { stroke: "#6b7280", lineWidth: 1 });
  });

  renderer.drawEllipse(placePoint(0, 3), 1.6, { fill: player.color, stroke: "#111111" });
  renderer.drawEllipse(placePoint(-0.5, 3.6), 0.5, { fill: "#ffffff", alpha: 0.5 });
}

function drawCrateSymbol(renderer, crate, color) {
  const { x, y } = crate;
  if (crate.type === "hp") {
    renderer.drawPolygon(createRectPoints(x - 0.35, y - 1.1, x + 0.35, y + 1.1), { fill: color });
    renderer.drawPolygon(createRectPoints(x - 1.1, y - 0.35, x + 1.1, y + 0.35), { fill: color });
  } else if (crate.type === "fuel") {
    renderer.drawPolygon([{ x, y: y + 1.2 }, { x: x - 0.8, y: y - 0.1 }, { x: x + 0.8, y: y - 0.1 }], { fill: color });
    renderer.drawEllipse({ x, y: y - 0.3 }, 0.8, { fill: color });
  } else {
    renderer.drawPolygon(createRectPoints(x - 0.5, y - 1.1, x + 0.5, y + 0.4), { fill: color });
    renderer.drawEllipse({ x, y: y + 0.45 }, 0.5, { fill: color });
  }
}

function drawCrate(renderer, crate, time) {
  const spec = CRATES.types[crate.type];
  const { x, y } = crate;
  if (crate.parachute) {
    const sway = Math.sin(time * 2 + crate.id) * 1.2;
    const canopyY = y + 9;
    const canopy = [];
    for (let index = 0; index <= 12; index += 1) {
      const angle = Math.PI * (index / 12);
      canopy.push({ x: x + sway + Math.cos(angle) * 5, y: canopyY + Math.sin(angle) * 2.6 });
    }
    renderer.drawLine([{ x: x - 1.6, y: y + 1.6 }, { x: x + sway - 5, y: canopyY }], { stroke: "rgba(255, 255, 255, 0.7)", lineWidth: 1 });
    renderer.drawLine([{ x: x + 1.6, y: y + 1.6 }, { x: x + sway + 5, y: canopyY }], { stroke: "rgba(255, 255, 255, 0.7)", lineWidth: 1 });
    renderer.drawPolygon(canopy, { fill: "#f4f4f5", stroke: spec.color, lineWidth: 1.5 });
  }
  renderer.drawPolygon(createRectPoints(x - 1.6, y - 1.6, x + 1.6, y + 1.6), { fill: "#9a6b3c", stroke: "#3b2a17", lineWidth: 1.5 });
  renderer.drawPolygon(createRectPoints(x - 1.6, y - 0.2, x + 1.6, y + 0.2), { fill: "#000000", alpha: 0.15 });
  drawCrateSymbol(renderer, crate, spec.color);
}

// Chuva da tempestade, inclinada pelo vento.
function drawRain(renderer, wind, time) {
  const context = renderer.context;
  const { width, height } = renderer;
  const rng = createRng(911);
  const slant = clamp(wind * 6, -14, 14);
  context.beginPath();
  for (let index = 0; index < 140; index += 1) {
    const speed = 600 + rng() * 300;
    const x = ((rng() * (width + 80) + time * slant * 30) % (width + 80) + width + 80) % (width + 80) - 40;
    const y = (rng() * height + time * speed) % (height + 40) - 20;
    context.moveTo(x, y);
    context.lineTo(x + slant, y + 16);
  }
  renderer.applyStyle({ stroke: "rgba(200, 220, 255, 0.35)", lineWidth: 1 });
}

function drawFog(renderer, theme, time) {
  const surfaceY = renderer.toScreen({ x: 0, y: WATER_Y }).y;
  renderer.fillVerticalGradient(["rgba(0, 0, 0, 0)", theme.fog, theme.fog], surfaceY - renderer.height * 0.45, renderer.height + 40);
  const rng = createRng(77);
  for (let index = 0; index < 6; index += 1) {
    const span = renderer.width + 400;
    const x = ((rng() * span + time * (8 + rng() * 10)) % span) - 200;
    const y = surfaceY - rng() * renderer.height * 0.3;
    screenEllipse(renderer, x, y, 160 + rng() * 120, 26 + rng() * 20, theme.fog, 0.6);
  }
}

function drawAimGuide(renderer, player) {
  const origin = getProjectileOrigin(player);
  const radians = ((player.angle + 90) * Math.PI) / 180;
  const end = { x: origin.x + Math.cos(radians) * 10, y: origin.y + Math.sin(radians) * 10 };
  renderer.drawLine([origin, end], { stroke: "#ffffff", lineWidth: 1.5, alpha: 0.65, dash: [4, 5] });
}

function hpColor(hp) {
  if (hp > 60) {
    return "#4ade80";
  }
  return hp > 30 ? "#facc15" : "#f87171";
}

function drawPointer(renderer, x, tipY, fill) {
  const context = renderer.context;
  context.beginPath();
  context.moveTo(x, tipY);
  context.lineTo(x - 7, tipY - 9);
  context.lineTo(x + 7, tipY - 9);
  context.closePath();
  renderer.applyStyle({ fill, stroke: "rgba(0, 0, 0, 0.7)", lineWidth: 1.5 });
}

function drawPowerBar(renderer, player, charge, centerX, top) {
  const width = 84;
  const left = centerX - width / 2;
  const gradient = renderer.context.createLinearGradient(left, 0, left + width, 0);
  gradient.addColorStop(0, "#4ade80");
  gradient.addColorStop(0.55, "#facc15");
  gradient.addColorStop(1, "#ef4444");

  renderer.drawRoundedRect(left - 2, top - 2, width + 4, 14, 6, { fill: "rgba(0, 0, 0, 0.65)" });
  renderer.drawRoundedRect(left, top, Math.max(2, width * charge.power), 10, 5, { fill: gradient });
  if (player.lastPower !== null) {
    const markerX = left + width * player.lastPower;
    renderer.drawRoundedRect(markerX - 1, top - 3, 2, 16, 1, { fill: "#ffffff" });
  }
  renderer.drawText(`${Math.round(charge.power * 100)}%`, centerX, top - 10, {
    font: `700 12px ${FONT}`,
    outline: "rgba(0, 0, 0, 0.7)",
  });
}

function formatWeapon(player) {
  const weapon = WEAPONS[player.weapon];
  const ammo = player.ammo[player.weapon];
  return `${weapon.icon} ${weapon.label}${ammo === null ? "" : ` ×${ammo}`}`;
}

function drawWeaponLabel(renderer, player, centerX, y) {
  const weapon = WEAPONS[player.weapon];
  renderer.drawText(formatWeapon(player), centerX, y, {
    font: `700 11px ${FONT}`,
    fill: weapon.id === "standard" ? "rgba(255, 255, 255, 0.8)" : weapon.color,
    outline: "rgba(0, 0, 0, 0.75)",
  });
}

function drawPlayerTag(renderer, player, { isCurrent, aiming, charge, time }) {
  const anchor = renderer.toScreen({ x: player.position.x, y: player.position.y + 7 });
  const barWidth = 54;
  const top = anchor.y - 16;

  renderer.drawText(player.label, anchor.x, top - 10, {
    font: `700 11px ${FONT}`,
    fill: "#ffffff",
    outline: "rgba(0, 0, 0, 0.7)",
  });
  renderer.drawRoundedRect(anchor.x - barWidth / 2, top - 3, barWidth, 6, 3, { fill: "rgba(0, 0, 0, 0.6)" });
  renderer.drawRoundedRect(anchor.x - barWidth / 2, top - 3, Math.max(0, (barWidth * player.hp) / MAX_HP), 6, 3, {
    fill: hpColor(player.hp),
  });

  if (!isCurrent) {
    return;
  }

  if (aiming) {
    renderer.drawRoundedRect(anchor.x - barWidth / 2, top + 5, barWidth, 3, 1.5, { fill: "rgba(0, 0, 0, 0.5)" });
    renderer.drawRoundedRect(anchor.x - barWidth / 2, top + 5, (barWidth * Math.min(1, player.fuel / FUEL_PER_TURN)), 3, 1.5, {
      fill: "#ffd166",
    });
    drawWeaponLabel(renderer, player, anchor.x, top - 64);
  }

  if (aiming && charge.active) {
    drawPowerBar(renderer, player, charge, anchor.x, top - 38);
    return;
  }

  drawPointer(renderer, anchor.x, top - 22 + Math.sin(time * 6) * 3, player.color);
}

function drawProjectile(renderer, projectile) {
  const weapon = WEAPONS[projectile.weapon] ?? WEAPONS.standard;
  const screen = renderer.toScreen(projectile.position);
  if (screen.y < 0) {
    const context = renderer.context;
    context.beginPath();
    context.moveTo(screen.x, 6);
    context.lineTo(screen.x - 6, 16);
    context.lineTo(screen.x + 6, 16);
    context.closePath();
    renderer.applyStyle({ fill: weapon.color, stroke: "rgba(0, 0, 0, 0.6)" });
    return;
  }
  const size = weapon.size * Math.min(1.6, Math.sqrt(renderer.camera.zoom));
  renderer.drawGlow(screen.x, screen.y, size * 5.5, "rgba(255, 220, 150, 0.6)");
  renderer.drawScreenCircle(screen.x, screen.y, size, { fill: weapon.color, stroke: "#1a1a1a", lineWidth: 1 });
  if (weapon.id === "heavy") {
    renderer.drawScreenCircle(screen.x, screen.y, size * 0.45, { fill: "#7f1d1d" });
  }
}

function drawScoreDots(renderer, x, y, score, color, label) {
  renderer.drawText(label, x, y - 9, { font: `700 10px ${FONT}`, fill: color });
  for (let index = 0; index < ROUNDS_TO_WIN; index += 1) {
    const dotX = x + (index - (ROUNDS_TO_WIN - 1) / 2) * 14;
    renderer.drawScreenCircle(dotX, y + 7, 5, {
      fill: index < score ? color : "rgba(255, 255, 255, 0.1)",
      stroke: "rgba(255, 255, 255, 0.25)",
    });
  }
}

function drawWindIndicator(renderer, wind, centerX, top, hidden) {
  renderer.drawText("VENTO", centerX, top + 14, { font: `700 9px ${FONT}`, fill: "rgba(255, 255, 255, 0.6)" });
  if (hidden) {
    renderer.drawText("?", centerX, top + 34, { font: `800 20px ${FONT}`, fill: "rgba(255, 255, 255, 0.85)" });
    return;
  }
  if (Math.abs(wind) < 0.05) {
    renderer.drawText("calmo", centerX, top + 35, { font: `700 13px ${FONT}` });
    return;
  }

  const direction = Math.sign(wind);
  const length = 10 + Math.min(1, Math.abs(wind) / WIND_MAX) * 38;
  const arrowY = top + 30;
  const startX = centerX - (direction * length) / 2;
  const endX = centerX + (direction * length) / 2;
  const context = renderer.context;
  context.beginPath();
  context.moveTo(startX, arrowY);
  context.lineTo(endX, arrowY);
  renderer.applyStyle({ stroke: "#e0f2fe", lineWidth: 3 });
  context.beginPath();
  context.moveTo(endX + direction * 6, arrowY);
  context.lineTo(endX - direction * 2, arrowY - 6);
  context.lineTo(endX - direction * 2, arrowY + 6);
  context.closePath();
  renderer.applyStyle({ fill: "#e0f2fe" });
  renderer.drawText(Math.abs(wind).toFixed(1), centerX, top + 45, {
    font: `700 10px ${FONT}`,
    fill: "rgba(255, 255, 255, 0.75)",
  });
}

function drawTurnTimer(renderer, state, x, y, time) {
  const aiming = state.phase === "aiming";
  const fraction = aiming ? Math.max(0, state.turnTimeMs) / TURN_TIME_MS : 1;
  const seconds = Math.ceil(Math.max(0, state.turnTimeMs) / 1000);
  const urgent = aiming && seconds <= 5;
  const context = renderer.context;

  context.beginPath();
  context.arc(x, y, 17, 0, Math.PI * 2);
  renderer.applyStyle({ stroke: "rgba(255, 255, 255, 0.14)", lineWidth: 4 });
  context.beginPath();
  context.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
  renderer.applyStyle({
    stroke: urgent ? "#f87171" : state.players[state.turnIndex].color,
    lineWidth: 4,
    alpha: aiming ? 1 : 0.35,
  });

  const pulse = urgent ? 1 + 0.12 * Math.sin(time * 14) : 1;
  renderer.drawText(aiming ? String(seconds) : "–", x, y + 1, {
    font: `700 ${Math.round(14 * pulse)}px ${FONT}`,
    fill: urgent ? "#fca5a5" : "#ffffff",
  });
}

function drawOverlay(renderer, state, time) {
  const panelWidth = 340;
  const left = renderer.width / 2 - panelWidth / 2;
  const top = 12;
  const [playerOne, playerTwo] = state.players;

  renderer.drawRoundedRect(left, top, panelWidth, 54, 16, {
    fill: "rgba(10, 12, 18, 0.62)",
    stroke: "rgba(255, 255, 255, 0.1)",
  });
  drawScoreDots(renderer, left + 42, top + 24, state.totalScore[0], playerOne.color, "P1");
  drawScoreDots(renderer, left + panelWidth - 42, top + 24, state.totalScore[1], playerTwo.color, "P2");
  const modifier = ROUND_MODIFIERS[state.modifier] ?? ROUND_MODIFIERS.normal;
  drawWindIndicator(renderer, state.wind, left + 138, top, Boolean(modifier.hideWind));
  drawTurnTimer(renderer, state, left + 218, top + 27, time);

  if (modifier.id !== "normal") {
    const label = modifier.label.toUpperCase();
    renderer.context.font = `800 10px ${FONT}`;
    const badgeWidth = renderer.context.measureText(label).width + 22;
    renderer.drawRoundedRect(renderer.width / 2 - badgeWidth / 2, top + 60, badgeWidth, 20, 10, {
      fill: "rgba(250, 204, 21, 0.9)",
    });
    renderer.drawText(label, renderer.width / 2, top + 70.5, { font: `800 10px ${FONT}`, fill: "#1f1a05" });
  }
}

export function drawScene(renderer, state, effects, time) {
  const theme = SKY_THEMES[state.theme] ?? SKY_THEMES.day;
  const map = getMap(state.seed);
  const context = renderer.context;
  const current = state.players[state.turnIndex];
  const aiming = state.phase === "aiming";
  const shake = effects.shakeOffset;

  drawSky(renderer, theme, time, effects.cloudOffset);
  if (state.modifier === "storm") {
    renderer.fillVerticalGradient(["rgba(15, 18, 30, 0.45)", "rgba(15, 18, 30, 0.2)"]);
  }

  context.save();
  context.translate(shake.x, shake.y);
  drawBackdrop(renderer, state, theme);
  drawIslands(renderer, state, theme, map);
  state.crates.forEach((crate) => drawCrate(renderer, crate, time));
  state.players.forEach((player) => drawCart(renderer, player, effects.getRecoil(player.id), map));
  drawWater(renderer, theme, time);
  if (state.modifier === "fog") {
    drawFog(renderer, theme, time);
  }
  if (aiming) {
    drawAimGuide(renderer, current);
  }

  effects.drawTrails(renderer);
  state.projectiles.forEach((projectile) => drawProjectile(renderer, projectile));
  effects.drawWorld(renderer);

  state.players.filter((player) => !player.sunk).forEach((player) => drawPlayerTag(renderer, player, {
    isCurrent: player.id === current.id && (aiming || state.phase === "flying"),
    aiming,
    charge: state.charge,
    time,
  }));
  context.restore();

  if (state.modifier === "storm") {
    drawRain(renderer, state.wind, time);
  }
  drawOverlay(renderer, state, time);
  effects.drawOverlay(renderer);
}
