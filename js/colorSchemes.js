// Main-particle color schemes ("Farbfolge") — only the game's own particle
// stream is colored this way; tool ambient fx (toolFx.js) is unaffected.
// Color depends on a particle's speed: `t` in [0,1] is 0 for slow, 1 for
// fast. Formulas are the same HSL curves used by the sibling project's
// "Ember"/"Sonnenunt."/"Neon" schemes (index.html's schemeColor()), so the
// look matches exactly rather than being re-guessed from a screenshot; the
// "bright" variant (vs. that project's dimmer trail-layer variant) is used
// since this renderer only draws one pass.

// Above this speed (normalized units/sec), a particle is considered
// "fastest" for color purposes and clamps to t=1. Tuned against this
// game's own speed scale (BASE_SPEED in particles.js is 0.14).
export const MAX_SPEED_FOR_COLOR = 0.5;

export const DEFAULT_SCHEME = 'ember';

export const SCHEME_META = [
  { key: 'ember', label: 'Ember', preview: 'linear-gradient(90deg,#1a0505,#c03010,#ff8844)' },
  { key: 'custom', label: 'Eigener', preview: 'linear-gradient(90deg,#3af,#f3a,#fa3)' },
  { key: 'sunset', label: 'Sonnenunt.', preview: 'linear-gradient(90deg,#ff6a00,#ee0979,#7b2ff7)' },
  { key: 'neon', label: 'Neon', preview: 'linear-gradient(90deg,#f0f,#0ff,#0f8)' },
];

// Default "Eigener" hue stops, matching the sibling project's default
// customStops/customSat.
const CUSTOM_HUE_STOPS = [17, 244, 168, 246, 251, 38];
const CUSTOM_SAT = 80;

function hslToRgb01(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [r1 + m, g1 + m, b1 + m];
}

function emberColor(t) {
  return hslToRgb01(t * 40, 90, 55 - t * 8);
}

function neonColor(t) {
  return hslToRgb01(((300 - t * 180) + 360) % 360, 100, 60);
}

function sunsetColor(t) {
  return hslToRgb01(((30 - t * 118) + 360) % 360, 95 - t * 12, 58 - t * 6);
}

function customColor(t) {
  const n = CUSTOM_HUE_STOPS.length;
  const pos = t * (n - 1);
  const idx = Math.min(Math.floor(pos), n - 2);
  const lt = pos - idx;
  const h0 = CUSTOM_HUE_STOPS[idx];
  const h1 = CUSTOM_HUE_STOPS[idx + 1];
  let dh = h1 - h0;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = ((h0 + dh * lt) + 360) % 360;
  return hslToRgb01(h, CUSTOM_SAT, 52);
}

const SCHEME_FUNCTIONS = {
  ember: emberColor,
  neon: neonColor,
  sunset: sunsetColor,
  custom: customColor,
};

// Returns [r, g, b] each in 0..1 for position `t` (0..1) along a scheme's
// gradient. Used directly by anything that already has a 0..1 fraction
// (e.g. toolFx.js's per-particle trail progress).
export function sampleGradient(schemeKey, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const fn = SCHEME_FUNCTIONS[schemeKey] || emberColor;
  return fn(clamped);
}

// Returns [r, g, b] each in 0..1, for a particle moving at normalized
// speed `speed` (units/sec) under the given scheme key. `maxSpeed`
// (defaults to MAX_SPEED_FOR_COLOR) is where the gradient saturates.
export function speedToColor(schemeKey, speed, maxSpeed = MAX_SPEED_FOR_COLOR) {
  return sampleGradient(schemeKey, speed / maxSpeed);
}
