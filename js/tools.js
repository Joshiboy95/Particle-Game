// Tool catalogue (cost/unlock/default params) + per-type force functions +
// the force-accumulation entry point called once per frame from main.js.
//
// Adding a new tool later = one entry here + one force function + one
// visualization case in ui.js. Nothing else changes.

// Wind-Jet's cone reach ("range") is fixed — the only two things the
// player controls directly on the element are its length (-> strength)
// and its angle (-> direction). Attractor/Repulsor expose a single visual
// "power" handle on the ring edge; radius and strength both derive from
// where that handle sits, so there's effectively one on-canvas control.
export const WIND_JET_RANGE = 0.28;
export const WIND_JET_MIN_STRENGTH = 0.15;
export const WIND_JET_MAX_STRENGTH = 0.9;
export const WIND_JET_MIN_LEN_CSS = 30;
export const WIND_JET_MAX_LEN_CSS = 300; // long drag range for granular strength control

export const RADIAL_MIN_RADIUS = 0.05;
export const RADIAL_MAX_RADIUS = 0.32;
const RADIAL_MIN_STRENGTH = 0.25;
const RADIAL_MAX_STRENGTH = 1.3;

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

export function radialStrengthFromRadius(radius) {
  const t = (radius - RADIAL_MIN_RADIUS) / (RADIAL_MAX_RADIUS - RADIAL_MIN_RADIUS);
  return RADIAL_MIN_STRENGTH + clamp01(t) * (RADIAL_MAX_STRENGTH - RADIAL_MIN_STRENGTH);
}

export function windJetStrengthToHandleLenCss(strength) {
  const t = (strength - WIND_JET_MIN_STRENGTH) / (WIND_JET_MAX_STRENGTH - WIND_JET_MIN_STRENGTH);
  return WIND_JET_MIN_LEN_CSS + clamp01(t) * (WIND_JET_MAX_LEN_CSS - WIND_JET_MIN_LEN_CSS);
}

export function windJetHandleLenCssToStrength(lenCss) {
  const t = (lenCss - WIND_JET_MIN_LEN_CSS) / (WIND_JET_MAX_LEN_CSS - WIND_JET_MIN_LEN_CSS);
  return WIND_JET_MIN_STRENGTH + clamp01(t) * (WIND_JET_MAX_STRENGTH - WIND_JET_MIN_STRENGTH);
}

export const TOOL_DEFINITIONS = {
  wind_jet: {
    type: 'wind_jet',
    label: 'Wind-Jet',
    cost: 10,
    unlockedAtLevel: 1,
    defaultRadius: WIND_JET_RANGE,
    defaultStrength: 0.4,
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

export function normalizeAngle(a) {
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
  const tool = {
    id: 'tool_' + Math.random().toString(36).slice(2, 10),
    type,
    position: { x: position.x, y: position.y },
    radius: def.defaultRadius,
    strength: def.defaultStrength,
    params: { ...def.defaultParams },
  };
  if (type === 'attractor' || type === 'repulsor') {
    tool.strength = radialStrengthFromRadius(tool.radius);
  }
  return tool;
}
