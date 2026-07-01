// Purely decorative per-tool ambient particle streaks — "each tool emits
// its own small particle flow that shows its force's character." These
// never touch the physics simulation in particles.js/tools.js and are not
// influenced by any other tool; each tool owns an independent set.
//
// Motion per type:
//  - wind_jet: streaks drift outward through the fixed cone in the wind
//    direction, with a gentle sinusoidal wobble ("gusts").
//  - attractor: streaks spawn at the ring edge and spiral inward
//    (accelerating, curling), vanishing at the center — a graceful pull.
//  - repulsor: streaks spawn at the center and blast straight outward
//    (decelerating, no curl) to the ring edge — an energetic push.

import { toPixel, toPixelLength } from './coords.js';
import { WIND_JET_RANGE } from './tools.js';

const COUNTS = { wind_jet: 16, attractor: 18, repulsor: 18 };

// Each type leans on a different slice of the blue palette for a distinct
// identity while staying in the game's established color language.
const PALETTES = {
  wind_jet: [
    { r: 232, g: 236, b: 244, a: 0.9 },
    { r: 191, g: 219, b: 254, a: 0.85 },
    { r: 147, g: 197, b: 253, a: 0.7 },
  ],
  attractor: [
    { r: 34, g: 211, b: 238, a: 0.92 },
    { r: 56, g: 189, b: 248, a: 0.85 },
    { r: 14, g: 165, b: 233, a: 0.8 },
  ],
  repulsor: [
    { r: 224, g: 242, b: 254, a: 0.95 },
    { r: 96, g: 165, b: 250, a: 0.88 },
    { r: 186, g: 230, b: 253, a: 0.82 },
  ],
};

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function fadeAlpha(progress) {
  const fadeIn = Math.min(1, progress / 0.12);
  const fadeOut = Math.min(1, (1 - progress) / 0.18);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function makeParticle(type) {
  const p = {
    progress: Math.random(),
    speed: 0.35 + Math.random() * 0.4,
    color: pick(PALETTES[type]),
  };
  if (type === 'wind_jet') {
    p.angleJitter = Math.random() - 0.5;
    p.wobblePhase = Math.random() * Math.PI * 2;
  } else {
    p.angle = Math.random() * Math.PI * 2;
    p.curlSpeed = type === 'attractor' ? (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? 1 : -1) : 0;
  }
  return p;
}

function respawn(p, type) {
  Object.assign(p, makeParticle(type));
  p.progress = 0;
}

class ToolFx {
  constructor(type) {
    this.type = type;
    this.particles = [];
    const n = COUNTS[type] || 14;
    for (let i = 0; i < n; i++) {
      const p = makeParticle(type);
      p.progress = Math.random(); // stagger initial phases so they don't all spawn together
      this.particles.push(p);
    }
  }

  step(dt) {
    for (const p of this.particles) {
      p.progress += p.speed * dt * 0.5;
      if (this.type !== 'wind_jet') p.angle += p.curlSpeed * dt;
      if (p.progress >= 1) respawn(p, this.type);
    }
  }

  draw(ctx, tool, dpr) {
    if (this.type === 'wind_jet') this._drawWind(ctx, tool, dpr);
    else this._drawRadial(ctx, tool, dpr, this.type === 'repulsor');
  }

  _drawWind(ctx, tool, dpr) {
    const center = toPixel(tool.position.x, tool.position.y);
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
    const range = toPixelLength(WIND_JET_RANGE);

    for (const p of this.particles) {
      const wobble = Math.sin(p.progress * Math.PI * 2 + p.wobblePhase) * 0.05;
      const angle = dirRad + p.angleJitter * spreadRad * 0.5 + wobble;
      const tailProgress = Math.max(0, p.progress - 0.05);
      const d2 = p.progress * range;
      const d1 = tailProgress * range;
      const x2 = center.x + Math.cos(angle) * d2;
      const y2 = center.y + Math.sin(angle) * d2;
      const x1 = center.x + Math.cos(angle) * d1;
      const y1 = center.y + Math.sin(angle) * d1;
      this._stroke(ctx, x1, y1, x2, y2, p, dpr);
    }
  }

  _drawRadial(ctx, tool, dpr, outward) {
    const center = toPixel(tool.position.x, tool.position.y);
    const radius = toPixelLength(tool.radius);

    for (const p of this.particles) {
      const tailProgress = Math.max(0, p.progress - 0.05);
      const d2 = this._radialDistance(p.progress, radius, outward);
      const d1 = this._radialDistance(tailProgress, radius, outward);
      const x2 = center.x + Math.cos(p.angle) * d2;
      const y2 = center.y + Math.sin(p.angle) * d2;
      const x1 = center.x + Math.cos(p.angle) * d1;
      const y1 = center.y + Math.sin(p.angle) * d1;
      this._stroke(ctx, x1, y1, x2, y2, p, dpr);
    }
  }

  _radialDistance(progress, radius, outward) {
    if (outward) {
      // repulsor: fast start, slows near the edge (matches force falloff)
      return radius * (1 - Math.pow(1 - progress, 2));
    }
    // attractor: gentle start, accelerates into the center
    return radius * (1 - Math.pow(progress, 1.6));
  }

  _stroke(ctx, x1, y1, x2, y2, p, dpr) {
    const alpha = fadeAlpha(p.progress) * p.color.a;
    if (alpha <= 0.01) return;
    ctx.strokeStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
    ctx.lineWidth = 1.6 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

export class ToolFxManager {
  constructor() {
    this._byId = new Map();
  }

  step(activeTools, dt) {
    const liveIds = new Set();
    for (const tool of activeTools) {
      liveIds.add(tool.id);
      let fx = this._byId.get(tool.id);
      if (!fx) {
        fx = new ToolFx(tool.type);
        this._byId.set(tool.id, fx);
      }
      fx.step(dt);
    }
    for (const id of this._byId.keys()) {
      if (!liveIds.has(id)) this._byId.delete(id);
    }
  }

  draw(ctx, activeTools, dpr) {
    for (const tool of activeTools) {
      const fx = this._byId.get(tool.id);
      if (fx) fx.draw(ctx, tool, dpr);
    }
  }
}
