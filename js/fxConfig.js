// Live-tunable visual parameters for the main particle stream and each
// tool type's ambient fx (toolFx.js), editable from the settings panel
// and persisted independently of the game-progress save (doc §9.4's
// schema stays clean of this freeform tuning data).
//
// Extensibility contract: adding a new tool type later means adding one
// entry to TOOL_FX_SCHEMA/TOOL_FX_DEFAULTS here — ui.js's settings panel
// builds a section per schema entry generically, so no new panel-building
// code is needed. The tool's actual motion/rendering in toolFx.js still
// needs its own code, same as any new tool does.

import { DEFAULT_SCHEME, DEFAULT_CUSTOM_STOPS } from './colorSchemes.js';

const KEY = 'particle_flow_fx_config';

// Must match the particle pool / GPU buffer capacity (MAX_PARTICLES in
// main.js and level.js) — this is a soft display cap on top of it, never
// a way to exceed it.
const MAX_MAIN_PARTICLES = 4096;

export const GRADIENT_OPTIONS = [
  { value: 'ember', label: 'Ember' },
  { value: 'custom', label: 'Eigener' },
  { value: 'sunset', label: 'Sonnenunt.' },
  { value: 'neon', label: 'Neon' },
];

// Schema shape: { key, label, type: 'range'|'select', ...type-specific }.
// 'gradient'-keyed select params automatically get a per-element custom
// color-stop editor in the panel (see ui.js) when "Eigener" is chosen.
export const MAIN_SCHEMA = [
  { key: 'particle_count', label: 'Partikelanzahl', type: 'range', min: 200, max: MAX_MAIN_PARTICLES, step: 100 },
  { key: 'point_size', label: 'Partikelgröße', type: 'range', min: 1, max: 8, step: 0.5 },
  { key: 'max_speed_for_color', label: 'Farb-Empfindlichkeit', type: 'range', min: 0.1, max: 1.5, step: 0.05 },
];

const TOOL_FX_PARAM_TEMPLATE = [
  { key: 'count', label: 'Partikelanzahl', type: 'range', min: 10, max: 150, step: 5 },
  { key: 'speed', label: 'Geschwindigkeit', type: 'range', min: 0.2, max: 3, step: 0.1 },
  { key: 'length', label: 'Länge', type: 'range', min: 1, max: 80, step: 1 },
  { key: 'gradient', label: 'Farbfolge', type: 'select', options: GRADIENT_OPTIONS },
  { key: 'line_width', label: 'Strichstärke', type: 'range', min: 0.3, max: 3, step: 0.1 },
];

export const TOOL_FX_SCHEMA = {
  wind_jet: TOOL_FX_PARAM_TEMPLATE,
  attractor: TOOL_FX_PARAM_TEMPLATE,
  repulsor: TOOL_FX_PARAM_TEMPLATE,
};

const MAIN_DEFAULTS = {
  color_scheme: DEFAULT_SCHEME,
  custom_gradient: [...DEFAULT_CUSTOM_STOPS],
  particle_count: MAX_MAIN_PARTICLES,
  point_size: 3,
  max_speed_for_color: 0.5,
};

// Trail length defaults are short on purpose (dots, not lines) — the
// player can lengthen them into streaks/comets via the panel.
const TOOL_FX_DEFAULTS = {
  wind_jet: { count: 50, speed: 1, length: 6, gradient: 'neon', custom_gradient: [...DEFAULT_CUSTOM_STOPS], line_width: 1 },
  attractor: { count: 70, speed: 1, length: 6, gradient: 'ember', custom_gradient: [...DEFAULT_CUSTOM_STOPS], line_width: 1 },
  repulsor: { count: 70, speed: 1, length: 6, gradient: 'sunset', custom_gradient: [...DEFAULT_CUSTOM_STOPS], line_width: 1 },
};

function defaultConfig() {
  return {
    main: { ...MAIN_DEFAULTS, custom_gradient: [...MAIN_DEFAULTS.custom_gradient] },
    tools: Object.fromEntries(
      Object.entries(TOOL_FX_DEFAULTS).map(([type, v]) => [type, { ...v, custom_gradient: [...v.custom_gradient] }])
    ),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw);
    const defaults = defaultConfig();
    return {
      main: { ...defaults.main, ...(parsed.main || {}) },
      tools: Object.fromEntries(
        Object.keys(defaults.tools).map((type) => [type, { ...defaults.tools[type], ...((parsed.tools || {})[type] || {}) }])
      ),
    };
  } catch {
    return defaultConfig();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — tuning just won't persist across reloads.
  }
}

const state = load();

export function getMainConfig() {
  return state.main;
}

export function setMainParam(key, value) {
  state.main[key] = value;
  persist();
}

export function getToolConfig(type) {
  return state.tools[type] || TOOL_FX_DEFAULTS[type];
}

export function setToolParam(type, key, value) {
  if (!state.tools[type]) state.tools[type] = { ...TOOL_FX_DEFAULTS[type] };
  state.tools[type][key] = value;
  persist();
}

// For the settings panel's "copy values" button — a compact, human- and
// AI-readable snapshot of every current parameter, meant to be pasted
// back into a chat message when sharing a customized look.
export function serializeForCopy() {
  return JSON.stringify(state, null, 2);
}
