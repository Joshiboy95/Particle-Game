// Particle color schemes ("Farbfolge") — used both by the main particle
// stream (color depends on speed) and by each tool's ambient fx
// (toolFx.js; color depends on trail progress there instead). `t` in
// [0,1] is 0 for slow/just-spawned, 1 for fast/near-finished. The three
// named presets' HSL curves match the sibling project's "Ember"/
// "Sonnenunt."/"Neon" schemes (index.html's schemeColor()) exactly rather
// than being re-guessed from a screenshot; the "bright" variant (vs. that
// project's dimmer trail-layer variant) is used since this renderer only
// draws one pass.
//
// "Eigener" ("custom") is per-element: every element (main particles,
// each tool type) has its own 3 hex-color stops, editable from the
// settings panel — not a single global custom scheme.

// Above this speed (normalized units/sec), a particle is considered
// "fastest" for color purposes and clamps to t=1. Tuned against this
// game's own speed scale (BASE_SPEED in particles.js is 0.14).
export const MAX_SPEED_FOR_COLOR = 0.5;

export const DEFAULT_SCHEME = 'ember';

// Default "Eigener" stops for any element that hasn't customized them yet.
export const DEFAULT_CUSTOM_STOPS = ['#33aaff', '#ff33aa', '#ffaa33'];

export const SCHEME_META = [
  { key: 'ember', label: 'Ember', preview: 'linear-gradient(90deg,#1a0505,#c03010,#ff8844)' },
  { key: 'custom', label: 'Eigener', preview: 'linear-gradient(90deg,#3af,#f3a,#fa3)' },
  { key: 'sunset', label: 'Sonnenunt.', preview: 'linear-gradient(90deg,#ff6a00,#ee0979,#7b2ff7)' },
  { key: 'neon', label: 'Neon', preview: 'linear-gradient(90deg,#f0f,#0ff,#0f8)' },
];

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

function hexToRgb01(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Linear RGB interpolation across the given hex stops (simpler and avoids
// hue-wraparound edge cases that HSL interpolation has, which doesn't
// matter for a small user-picked stop list the way it would for a
// carefully authored preset).
function customColor(t, hexStops) {
  const stops = hexStops && hexStops.length ? hexStops : DEFAULT_CUSTOM_STOPS;
  const n = stops.length;
  if (n === 1) return hexToRgb01(stops[0]);
  const pos = t * (n - 1);
  const idx = Math.min(Math.floor(pos), n - 2);
  const lt = pos - idx;
  const c0 = hexToRgb01(stops[idx]);
  const c1 = hexToRgb01(stops[idx + 1]);
  return [lerp(c0[0], c1[0], lt), lerp(c0[1], c1[1], lt), lerp(c0[2], c1[2], lt)];
}

const SCHEME_FUNCTIONS = {
  ember: emberColor,
  neon: neonColor,
  sunset: sunsetColor,
};

// Returns [r, g, b] each in 0..1 for position `t` (0..1) along a scheme's
// gradient. `customStops` (hex color array) is only used when
// schemeKey === 'custom' — pass the calling element's own stops.
export function sampleGradient(schemeKey, t, customStops) {
  const clamped = Math.max(0, Math.min(1, t));
  if (schemeKey === 'custom') return customColor(clamped, customStops);
  const fn = SCHEME_FUNCTIONS[schemeKey] || emberColor;
  return fn(clamped);
}

// Returns [r, g, b] each in 0..1, for a particle moving at normalized
// speed `speed` (units/sec) under the given scheme key. `maxSpeed`
// (defaults to MAX_SPEED_FOR_COLOR) is where the gradient saturates.
export function speedToColor(schemeKey, speed, maxSpeed = MAX_SPEED_FOR_COLOR, customStops) {
  return sampleGradient(schemeKey, speed / maxSpeed, customStops);
}
