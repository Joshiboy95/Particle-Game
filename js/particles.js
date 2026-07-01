// Typed-array particle pool: CPU-side physics state + emitter spawning +
// integration + lifetime/bounds lifecycle. Obstacle collision (obstacles.js)
// and target capture (level.js) kill particles through pool.kill(i) too.

// Normalized units/second. Not part of the level schema (yet) — a single
// POC-wide constant is enough until a level needs to vary it.
const BASE_SPEED = 0.14;

export class ParticlePool {
  constructor(maxParticles) {
    this.max = maxParticles;
    this.px = new Float32Array(maxParticles);
    this.py = new Float32Array(maxParticles);
    this.vx = new Float32Array(maxParticles);
    this.vy = new Float32Array(maxParticles);
    this.age = new Float32Array(maxParticles);
    this.maxAge = new Float32Array(maxParticles);
    this.count = 0;
  }

  spawn(x, y, vx, vy, maxAge) {
    if (this.count >= this.max) return -1; // pool full, drop silently
    const i = this.count++;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.age[i] = 0;
    this.maxAge[i] = maxAge;
    return i;
  }

  // Swap-remove keeps the live particles dense in [0, count).
  kill(i) {
    const last = --this.count;
    if (i === last) return;
    this.px[i] = this.px[last];
    this.py[i] = this.py[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.age[i] = this.age[last];
    this.maxAge[i] = this.maxAge[last];
  }

  clear() {
    this.count = 0;
  }
}

// Per-emitter runtime state (fractional spawn accumulator), separate from
// the emitter's static level-data definition.
export function createEmitterRuntime() {
  return { accumulator: 0 };
}

export function updateEmitter(pool, emitterDef, runtime, emitterRate, lifetime, dt) {
  runtime.accumulator += emitterRate * dt;
  while (runtime.accumulator >= 1) {
    runtime.accumulator -= 1;
    const spreadRad = (emitterDef.spread_angle || 0) * Math.PI / 180;
    const baseRad = (emitterDef.direction || 0) * Math.PI / 180;
    const angle = baseRad + (Math.random() - 0.5) * spreadRad;
    const vx = Math.cos(angle) * BASE_SPEED;
    const vy = Math.sin(angle) * BASE_SPEED;
    pool.spawn(emitterDef.position.x, emitterDef.position.y, vx, vy, lifetime);
  }
}

// forceX/forceY: Float32Array of accumulated force per particle (index-
// aligned with the pool, computed by tools.js before this is called).
export function integrate(pool, forceX, forceY, dt) {
  const { px, py, vx, vy, age, count } = pool;
  for (let i = 0; i < count; i++) {
    vx[i] += forceX[i] * dt;
    vy[i] += forceY[i] * dt;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
    age[i] += dt;
  }
}

// Kills particles that expired or left the field. Iterates backwards so
// swap-remove doesn't skip the particle swapped into the current slot.
export function applyLifecycleKill(pool) {
  const { px, py, age, maxAge } = pool;
  for (let i = pool.count - 1; i >= 0; i--) {
    if (age[i] >= maxAge[i] || px[i] < 0 || px[i] > 1 || py[i] < 0 || py[i] > 1) {
      pool.kill(i);
    }
  }
}
