// Tool catalogue (cost/unlock/default params) + per-type force functions +
// the force-accumulation entry point called once per frame from main.js.
//
// Adding a new tool later = one entry here + one force function + one
// visualization case in ui.js. Nothing else changes.

export const TOOL_DEFINITIONS = {
  wind_jet: {
    type: 'wind_jet',
    label: 'Wind-Jet',
    cost: 10,
    unlockedAtLevel: 1,
    defaultRadius: 0.3,      // cone range
    defaultStrength: 0.35,
    defaultParams: { direction: 0, spreadAngle: 30 },
  },
  attractor: {
    type: 'attractor',
    label: 'Attraktor',
    cost: 20,
    unlockedAtLevel: 2,
    defaultRadius: 0.14,
    defaultStrength: 0.6,
    defaultParams: {},
  },
  repulsor: {
    type: 'repulsor',
    label: 'Repulsor',
    cost: 20,
    unlockedAtLevel: 3,
    defaultRadius: 0.14,
    defaultStrength: 0.6,
    defaultParams: {},
  },
};

const SOFTENING = 0.02; // prevents force spike / division blowup near tool center

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Returns [fx, fy] contributed by one tool on a particle at (px, py).
function windJetForce(tool, px, py) {
  const dx = px - tool.position.x;
  const dy = py - tool.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > tool.radius) return [0, 0];

  const dirRad = (tool.params.direction || 0) * Math.PI / 180;
  const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
  const angleToParticle = Math.atan2(dy, dx);
  const diff = normalizeAngle(angleToParticle - dirRad);
  if (Math.abs(diff) > spreadRad / 2) return [0, 0];

  return [Math.cos(dirRad) * tool.strength, Math.sin(dirRad) * tool.strength];
}

function radialForce(tool, px, py, sign) {
  const dx = tool.position.x - px;
  const dy = tool.position.y - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= tool.radius) return [0, 0];

  // Quadratic falloff: strongest at the center, zero at the radius edge.
  // Direction is softened (not normalized by raw dist) so it stays finite
  // and well-defined as dist -> 0, instead of spiking/dividing by zero —
  // this is what produces the "slingshot past center" rather than a stall.
  const falloff = Math.pow(1 - dist / tool.radius, 2);
  const magnitude = tool.strength * falloff;
  const safeDist = dist + SOFTENING;
  const nx = dx / safeDist;
  const ny = dy / safeDist;
  return [sign * nx * magnitude, sign * ny * magnitude];
}

function attractorForce(tool, px, py) {
  return radialForce(tool, px, py, 1);
}

function repulsorForce(tool, px, py) {
  return radialForce(tool, px, py, -1);
}

const FORCE_FUNCTIONS = {
  wind_jet: windJetForce,
  attractor: attractorForce,
  repulsor: repulsorForce,
};

// Fills outFx/outFy (Float32Array, index-aligned with the particle pool)
// with ambient force + the sum of every active tool's force, for the first
// `count` particles.
export function accumulateForces(pool, activeTools, ambientForce, outFx, outFy) {
  const { px, py, count } = pool;
  const ax = (ambientForce && ambientForce.x) || 0;
  const ay = (ambientForce && ambientForce.y) || 0;

  for (let i = 0; i < count; i++) {
    outFx[i] = ax;
    outFy[i] = ay;
  }

  for (const tool of activeTools) {
    const fn = FORCE_FUNCTIONS[tool.type];
    if (!fn) continue;
    for (let i = 0; i < count; i++) {
      const [fx, fy] = fn(tool, px[i], py[i]);
      outFx[i] += fx;
      outFy[i] += fy;
    }
  }
}

export function createToolInstance(type, position) {
  const def = TOOL_DEFINITIONS[type];
  return {
    id: 'tool_' + Math.random().toString(36).slice(2, 10),
    type,
    position: { x: position.x, y: position.y },
    radius: def.defaultRadius,
    strength: def.defaultStrength,
    params: { ...def.defaultParams },
  };
}
