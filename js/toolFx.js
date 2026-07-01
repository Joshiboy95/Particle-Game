// Purely decorative per-tool ambient particle streaks — "each tool emits
// its own small particle flow that shows its force's character." These
// never touch the physics simulation in particles.js/tools.js and are not
// influenced by any other tool; each tool owns an independent set.
//
// Each streak is a comet trail from a *fixed* spawn anchor to a *moving*
// head, so it visibly grows/shrinks with progress instead of sliding as a
// constant-length dash — with many particles at staggered phases, this
// produces a dense burst of varying-length trails converging on (or
// erupting from) the center, rather than a ring of uniform dashes.
//
// Motion per type:
//  - wind_jet: anchored at the center, head drifts outward through the
//    fixed cone in the wind direction (gentle sinusoidal "gust" wobble).
//  - attractor: anchored at the ring edge, head races inward toward the
//    center (accelerating, with a slow curl) — a graceful pull.
//  - repulsor: anchored at the center, head blasts straight outward to
//    the ring edge (decelerating, matching the force's real falloff).

import { toPixel, toPixelLength } from './coords.js';
import { WIND_JET_RANGE } from './tools.js';

const COUNTS = { wind_jet: 50, attractor: 70, repulsor: 70 };

// Head = near the convergence point (bright), tail = fully transparent
// (fades out), glow = soft low-alpha underlay for a bit of bloom. Kept in
// blue/cyan rather than the main particles' near-white glow (webgl.js's
// fragment shader is ~rgba(0.75, 0.85, 1.0)) so a tool's own flow never
// gets confused with the particle stream it's steering, and dimmer than
// a "hot" reference look on purpose.
const PALETTES = {
  wind_jet: {
    head: 'rgba(147, 197, 253, 0.5)',
    tail: 'rgba(37, 99, 235, 0)',
    glow: 'rgba(59, 130, 246, 0.08)',
  },
  attractor: {
    head: 'rgba(103, 232, 249, 0.55)',
    tail: 'rgba(8, 47, 73, 0)',
    glow: 'rgba(34, 211, 238, 0.1)',
  },
  repulsor: {
    head: 'rgba(96, 165, 250, 0.55)',
    tail: 'rgba(30, 58, 138, 0)',
    glow: 'rgba(59, 130, 246, 0.1)',
  },
};

function fadeOutAlpha(progress) {
  // Only fades near the very end, just before respawn — the trail's own
  // shrinking-to-nothing at progress=0 already handles the fade-in.
  return Math.min(1, (1 - progress) / 0.15);
}

function makeParticle(type) {
  const p = {
    progress: Math.random(),
    speed: 1.4 + Math.random() * 1.8,
  };
  if (type === 'wind_jet') {
    p.angleJitter = Math.random() - 0.5;
    p.wobblePhase = Math.random() * Math.PI * 2;
    p.reachFactor = 0.6 + Math.random() * 0.6; // some streaks fall short, some overshoot
  } else {
    p.angle = Math.random() * Math.PI * 2;
    p.curlSpeed = type === 'attractor' ? (0.4 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1) : 0;
    p.edgeFactor = 0.7 + Math.random() * 0.6; // spawn radius varies around the ring edge
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
    const n = COUNTS[type] || 40;
    for (let i = 0; i < n; i++) {
      const p = makeParticle(type);
      p.progress = Math.random(); // stagger initial phases so they don't all spawn together
      this.particles.push(p);
    }
  }

  step(dt) {
    for (const p of this.particles) {
      p.progress += p.speed * dt;
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
    const baseRange = toPixelLength(WIND_JET_RANGE);
    const palette = PALETTES.wind_jet;

    for (const p of this.particles) {
      const wobble = Math.sin(p.progress * Math.PI * 2 + p.wobblePhase) * 0.05;
      const angle = dirRad + p.angleJitter * spreadRad * 0.5 + wobble;
      const headDist = p.progress * baseRange * p.reachFactor;
      const hx = center.x + Math.cos(angle) * headDist;
      const hy = center.y + Math.sin(angle) * headDist;
      // Anchored at the center — the trail lengthens outward as it grows.
      this._strokeTrail(ctx, center.x, center.y, hx, hy, palette, p.progress, dpr);
    }
  }

  _drawRadial(ctx, tool, dpr, outward) {
    const center = toPixel(tool.position.x, tool.position.y);
    const baseRadius = toPixelLength(tool.radius);
    const palette = PALETTES[this.type];

    for (const p of this.particles) {
      const edgeRadius = baseRadius * p.edgeFactor;
      const headDist = outward
        ? edgeRadius * (1 - Math.pow(1 - p.progress, 2)) // repulsor: fast start, slows near the edge
        : edgeRadius * (1 - Math.pow(p.progress, 1.6)); // attractor: gentle start, accelerates into the center
      const anchorDist = outward ? 0 : edgeRadius;

      const hx = center.x + Math.cos(p.angle) * headDist;
      const hy = center.y + Math.sin(p.angle) * headDist;
      const ax = center.x + Math.cos(p.angle) * anchorDist;
      const ay = center.y + Math.sin(p.angle) * anchorDist;
      this._strokeTrail(ctx, ax, ay, hx, hy, palette, p.progress, dpr);
    }
  }

  _strokeTrail(ctx, x1, y1, x2, y2, palette, progress, dpr) {
    const alphaMul = fadeOutAlpha(progress);
    if (alphaMul <= 0.01) return;

    ctx.globalAlpha = alphaMul;
    ctx.lineCap = 'round';

    // Soft glow underlay, then a crisp gradient core line (dim tail at the
    // fixed anchor, brighter head at the moving tip).
    ctx.strokeStyle = palette.glow;
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, palette.tail);
    gradient.addColorStop(1, palette.head);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.globalAlpha = 1;
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
