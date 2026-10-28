import { WEAPONS } from "./config.js";

const FONT = "'Trebuchet MS', 'Segoe UI', sans-serif";
const MAX_PARTICLES = 450;
const MAX_TRAIL_POINTS = 90;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Efeitos puramente visuais do cliente, disparados pelos eventos do Game.
export class Effects {
  constructor() {
    this.cloudOffset = 0;
    this.reset();
  }

  reset() {
    this.particles = [];
    this.rings = [];
    this.flashes = [];
    this.texts = [];
    this.banner = null;
    this.shake = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.trails = new Map();
    this.recoil = new Map();
    this.smokeClock = new Map();
  }

  getRecoil(playerId) {
    return this.recoil.get(playerId) ?? 0;
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  showBanner(text, { color = "#ffffff", duration = 1.6, small = false, subtitle = "" } = {}) {
    this.banner = { text, color, duration, life: duration, small, subtitle };
  }

  burst(origin, { count, colors, speed, life, size, gravity = 0, grow = 0, drag = 0, lift = 0, alpha = 1 }) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * randomBetween(0.3, 1);
      const particleLife = life * randomBetween(0.6, 1);
      this.particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity + lift,
        life: particleLife,
        maxLife: particleLife,
        size: size * randomBetween(0.6, 1.2),
        color: colors[index % colors.length],
        gravity,
        grow,
        drag,
        alpha,
      });
    }
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
  }

  handleEvent(event, state, sound) {
    const player = state.players.find((entry) => entry.id === event.playerId);
    const color = player?.color ?? "#ffffff";

    switch (event.type) {
      case "shot":
        this.recoil.set(event.playerId, 1);
        this.flashes.push({ x: event.x, y: event.y, life: 0.12, maxLife: 0.12, radius: 22 });
        this.burst(event, { count: 8, colors: ["#fff3c4", "#ffb347"], speed: 30, life: 0.25, size: 0.7 });
        this.addShake(2);
        sound?.shot(event.power);
        break;
      case "explosion": {
        // Tudo escala com o raio: fragmentos sao estalos, o pesado sacode a tela.
        const scale = event.radius / WEAPONS.standard.radius;
        this.rings.push({ x: event.x, y: event.y, radius: event.radius, life: 0.45, maxLife: 0.45 });
        this.flashes.push({ x: event.x, y: event.y, life: 0.2, maxLife: 0.2, radius: 70 * scale });
        this.burst(event, {
          count: Math.round(24 * scale), colors: ["#fff1a8", "#ffb347", "#ff6b35"], speed: 70 * scale, life: 0.55, size: 1.3 * scale, gravity: 40, drag: 1.5,
        });
        this.burst(event, {
          count: Math.round(14 * scale), colors: ["#6b6b6b", "#3d3d3d", "#8a7f72"], speed: 55 * scale, life: 1.3, size: 1, gravity: 130, lift: 25,
        });
        this.burst(event, {
          count: Math.round(10 * scale), colors: ["#5b5b5b", "#7a7a7a", "#444444"], speed: 12, life: 1.8, size: 3 * scale, gravity: -8, grow: 3, drag: 1, alpha: 0.5,
        });
        this.addShake(9 * scale * scale);
        sound?.explosion(scale);
        break;
      }
      case "bounce":
        this.burst(event, { count: 6, colors: ["#86efac", "#ffffff"], speed: 25, life: 0.3, size: 0.7, gravity: 30 });
        sound?.bounce();
        break;
      case "split":
        this.flashes.push({ x: event.x, y: event.y, life: 0.12, maxLife: 0.12, radius: 30 });
        sound?.split();
        break;
      case "weapon":
        sound?.select();
        break;
      case "damage":
        this.texts.push({
          x: event.x,
          y: event.y + 10,
          text: `-${event.amount}`,
          color: "#ff6b6b",
          size: Math.round(14 + Math.min(event.amount, 45) / 3),
          life: 1.3,
          maxLife: 1.3,
        });
        this.addShake(event.amount * 0.25);
        sound?.hit();
        break;
      case "land":
        if (event.distance > 3) {
          this.burst({ x: event.x, y: event.y - 1.5 }, {
            count: 10, colors: ["#b9a58a", "#8f8170"], speed: 20, life: 0.7, size: 1.4, gravity: -4, grow: 1.5, drag: 2, alpha: 0.6,
          });
          this.addShake(3);
          sound?.land();
        }
        break;
      case "miss":
        sound?.miss();
        break;
      case "timeout":
        this.showBanner("Tempo esgotado!", { color: "#ffd166", duration: 1.3 });
        sound?.timeout();
        break;
      case "turn":
        this.showBanner(`Vez de ${event.label}`, { color, duration: 1.1, small: true });
        sound?.turn();
        break;
      case "roundStart":
        this.showBanner(`Rodada ${event.round}`, { duration: 1.5 });
        break;
      case "roundEnd":
        this.showBanner(event.label ? `${event.label} venceu a rodada!` : "Empate!", { color, duration: 2.4 });
        sound?.win();
        break;
      case "matchEnd":
        this.showBanner(`${event.label} venceu a partida!`, {
          color,
          duration: 7,
          subtitle: "Nova partida em instantes. B reinicia agora.",
        });
        sound?.fanfare();
        break;
      default:
        break;
    }
  }

  update(dt, state) {
    this.cloudOffset += (6 + (state?.wind ?? 0) * 35) * dt;

    this.particles.forEach((particle) => {
      const damping = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= damping;
      particle.vy = particle.vy * damping - particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.size += particle.grow * dt;
      particle.life -= dt;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);

    [this.rings, this.flashes, this.texts].forEach((list) => list.forEach((item) => {
      item.life -= dt;
    }));
    this.rings = this.rings.filter((ring) => ring.life > 0);
    this.flashes = this.flashes.filter((flash) => flash.life > 0);
    this.texts = this.texts.filter((text) => text.life > 0);
    this.texts.forEach((text) => {
      text.y += 8 * dt;
    });

    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) {
        this.banner = null;
      }
    }

    this.recoil.forEach((value, playerId) => {
      this.recoil.set(playerId, Math.max(0, value - dt * 4));
    });

    this.shake *= Math.pow(0.015, dt);
    if (this.shake < 0.2) {
      this.shake = 0;
    }
    this.shakeOffset = {
      x: (Math.random() * 2 - 1) * this.shake,
      y: (Math.random() * 2 - 1) * this.shake,
    };

    if (!state) {
      return;
    }

    this.emitDamageSmoke(dt, state);
    this.updateTrails(dt, state);
  }

  emitDamageSmoke(dt, state) {
    state.players.forEach((player) => {
      if (player.hp >= 50) {
        return;
      }
      const interval = player.hp <= 0 ? 0.06 : player.hp < 25 ? 0.12 : 0.25;
      const clock = (this.smokeClock.get(player.id) ?? 0) + dt;
      if (clock < interval) {
        this.smokeClock.set(player.id, clock);
        return;
      }
      this.smokeClock.set(player.id, 0);
      const origin = { x: player.position.x + randomBetween(-1.5, 1.5), y: player.position.y + 4 };
      this.burst(origin, {
        count: 1, colors: ["#3a3a3a", "#555555"], speed: 3, life: 1.6, size: 1.2, gravity: -10, grow: 2, alpha: 0.55,
      });
      if (player.hp <= 0 || player.hp < 25) {
        this.burst(origin, { count: 1, colors: ["#ff8c42", "#ffd166"], speed: 6, life: 0.4, size: 0.7, gravity: -15 });
      }
    });
  }

  updateTrails(dt, state) {
    const live = new Set();
    state.projectiles.forEach((projectile) => {
      live.add(projectile.id);
      let trail = this.trails.get(projectile.id);
      if (!trail) {
        const owner = state.players.find((player) => player.id === projectile.ownerId);
        const color = projectile.weapon === "standard" ? owner?.color : WEAPONS[projectile.weapon]?.color;
        trail = { points: [], color: color ?? "#ffffff", fade: 1, width: projectile.weapon === "bomblet" ? 0.5 : 1 };
        this.trails.set(projectile.id, trail);
      }
      const last = trail.points[trail.points.length - 1];
      if (!last || Math.hypot(last.x - projectile.position.x, last.y - projectile.position.y) > 0.8) {
        trail.points.push({ ...projectile.position });
        if (trail.points.length > MAX_TRAIL_POINTS) {
          trail.points.shift();
        }
      }
    });

    this.trails.forEach((trail, id) => {
      if (live.has(id)) {
        return;
      }
      trail.fade -= dt * 2.5;
      if (trail.fade <= 0) {
        this.trails.delete(id);
      }
    });
  }

  drawTrails(renderer) {
    this.trails.forEach((trail) => {
      const count = trail.points.length;
      for (let index = 1; index < count; index += 1) {
        const progress = index / count;
        renderer.drawLine([trail.points[index - 1], trail.points[index]], {
          stroke: trail.color,
          lineWidth: (1 + progress * 3) * trail.width,
          alpha: progress * 0.85 * trail.fade,
        });
      }
    });
  }

  drawWorld(renderer) {
    this.flashes.forEach((flash) => {
      const screen = renderer.toScreen(flash);
      const strength = flash.life / flash.maxLife;
      renderer.drawGlow(screen.x, screen.y, flash.radius * (0.6 + strength * 0.4), `rgba(255, 230, 160, ${0.85 * strength})`);
    });

    this.particles.forEach((particle) => {
      renderer.drawEllipse(particle, particle.size, {
        fill: particle.color,
        alpha: Math.max(0, (particle.life / particle.maxLife) * particle.alpha),
      });
    });

    this.rings.forEach((ring) => {
      const strength = ring.life / ring.maxLife;
      renderer.drawEllipse(ring, ring.radius * (0.3 + 0.9 * (1 - strength)), {
        stroke: "#fff2c4",
        lineWidth: 1 + 4 * strength,
        alpha: strength,
      });
    });

    this.texts.forEach((text) => {
      const screen = renderer.toScreen(text);
      const strength = text.life / text.maxLife;
      renderer.drawText(text.text, screen.x, screen.y, {
        font: `800 ${text.size}px ${FONT}`,
        fill: text.color,
        outline: "rgba(0, 0, 0, 0.75)",
        outlineWidth: 4,
        alpha: Math.min(1, strength * 2),
      });
    });
  }

  drawOverlay(renderer) {
    const banner = this.banner;
    if (!banner) {
      return;
    }
    const elapsed = banner.duration - banner.life;
    const alpha = Math.min(1, elapsed / 0.15, banner.life / 0.3);
    const pop = 1 + Math.max(0, 0.25 - elapsed) * 1.2;
    const size = Math.round((banner.small ? 22 : 38) * pop);
    const y = renderer.height * (banner.small ? 0.24 : 0.32);

    renderer.drawText(banner.text, renderer.width / 2, y, {
      font: `800 ${size}px ${FONT}`,
      fill: banner.color,
      outline: "rgba(0, 0, 0, 0.65)",
      outlineWidth: 6,
      alpha,
    });
    if (banner.subtitle) {
      renderer.drawText(banner.subtitle, renderer.width / 2, y + 34, {
        font: `700 14px ${FONT}`,
        fill: "#ffffff",
        outline: "rgba(0, 0, 0, 0.65)",
        outlineWidth: 4,
        alpha,
      });
    }
  }
}
