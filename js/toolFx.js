// Purely decorative per-tool ambient particle streaks — "each tool emits
// its own small particle flow that shows its force's character." These
// never touch the physics simulation in particles.js/tools.js and are not
// influenced by any other tool; each tool owns an independent set.
//
// Count/speed/gradient/line-width are live-tunable per tool type via the
// settings panel (see fxConfig.js) — this module just reads whatever the
// current config says each frame/step, it doesn't own the values.
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
import { sampleGradient } from './colorSchemes.js';

function fadeOutAlpha(progress) {
  // Only fades near the very end, just before respawn — the trail's own
  // shrinking-to-nothing at progress=0 already handles the fade-in.
  return Math.min(1, (1 - progress) / 0.15);
}

function rgbaStr(rgb01, alpha) {
  const r = Math.round(rgb01[0] * 255);
  const g = Math.round(rgb01[1] * 255);
  const b = Math.round(rgb01[2] * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeParticle(type) {
  const p = {
    progress: Math.random(),
    speed: 1.4 + Math.random() * 1.8, // per-particle variance around the type's configured speed
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
  constructor(type, count) {
    this.type = type;
    this.particles = [];
    this.ensureCount(count);
  }

  // Grows/shrinks the live particle array to match a changed count
  // setting without resetting particles that already exist.
  ensureCount(count) {
    const n = Math.max(1, Math.round(count));
    if (n === this.particles.length) return;
    if (n > this.particles.length) {
      for (let i = this.particles.length; i < n; i++) {
        const p = makeParticle(this.type);
        p.progress = Math.random(); // stagger phase so new particles don't all spawn together
        this.particles.push(p);
      }
    } else {
      this.particles.length = n;
    }
  }

  step(dt, speedMultiplier) {
    for (const p of this.particles) {
      p.progress += p.speed * speedMultiplier * dt;
      if (this.type !== 'wind_jet') p.angle += p.curlSpeed * dt;
      if (p.progress >= 1) respawn(p, this.type);
    }
  }

  draw(ctx, tool, dpr, gradientKey, lineWidthMultiplier) {
    if (this.type === 'wind_jet') this._drawWind(ctx, tool, dpr, gradientKey, lineWidthMultiplier);
    else this._drawRadial(ctx, tool, dpr, this.type === 'repulsor', gradientKey, lineWidthMultiplier);
  }

  _drawWind(ctx, tool, dpr, gradientKey, lineWidthMultiplier) {
    const center = toPixel(tool.position.x, tool.position.y);
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
    const baseRange = toPixelLength(WIND_JET_RANGE);

    for (const p of this.particles) {
      const wobble = Math.sin(p.progress * Math.PI * 2 + p.wobblePhase) * 0.05;
      const angle = dirRad + p.angleJitter * spreadRad * 0.5 + wobble;
      const headDist = p.progress * baseRange * p.reachFactor;
      const hx = center.x + Math.cos(angle) * headDist;
      const hy = center.y + Math.sin(angle) * headDist;
      // Anchored at the center — the trail lengthens outward as it grows.
      this._strokeTrail(ctx, center.x, center.y, hx, hy, gradientKey, p.progress, lineWidthMultiplier, dpr);
    }
  }

  _drawRadial(ctx, tool, dpr, outward, gradientKey, lineWidthMultiplier) {
    const center = toPixel(tool.position.x, tool.position.y);
    const baseRadius = toPixelLength(tool.radius);

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
      this._strokeTrail(ctx, ax, ay, hx, hy, gradientKey, p.progress, lineWidthMultiplier, dpr);
    }
  }

  _strokeTrail(ctx, x1, y1, x2, y2, gradientKey, progress, lineWidthMultiplier, dpr) {
    const alphaMul = fadeOutAlpha(progress);
    if (alphaMul <= 0.01) return;

    // Head color shifts along the gradient as the trail travels (mirrors
    // the main particles' speed-color idea); tail always samples the
    // gradient's t=0 end but fully transparent, so it fades to nothing
    // rather than showing a flat dim color.
    const headRgb = sampleGradient(gradientKey, progress);
    const tailRgb = sampleGradient(gradientKey, 0);

    ctx.globalAlpha = alphaMul;
    ctx.lineCap = 'round';

    // Soft glow underlay, then a crisp gradient core line.
    ctx.strokeStyle = rgbaStr(headRgb, 0.1);
    ctx.lineWidth = 4 * dpr * lineWidthMultiplier;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, rgbaStr(tailRgb, 0));
    gradient.addColorStop(1, rgbaStr(headRgb, 0.55));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1 * dpr * lineWidthMultiplier;
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

  // getToolConfig: (type) => { count, speed, gradient, line_width }, from
  // fxConfig.js — read fresh each call so live panel edits apply instantly.
  step(activeTools, dt, getToolConfig) {
    const liveIds = new Set();
    for (const tool of activeTools) {
      liveIds.add(tool.id);
      const cfg = getToolConfig(tool.type);
      let fx = this._byId.get(tool.id);
      if (!fx) {
        fx = new ToolFx(tool.type, cfg.count);
        this._byId.set(tool.id, fx);
      } else {
        fx.ensureCount(cfg.count);
      }
      fx.step(dt, cfg.speed);
    }
    for (const id of this._byId.keys()) {
      if (!liveIds.has(id)) this._byId.delete(id);
    }
  }

  draw(ctx, activeTools, dpr, getToolConfig) {
    for (const tool of activeTools) {
      const fx = this._byId.get(tool.id);
      if (!fx) continue;
      const cfg = getToolConfig(tool.type);
      fx.draw(ctx, tool, dpr, cfg.gradient, cfg.line_width);
    }
  }
}
