// localStorage persistence, schema per design doc §9.4. Visual/fx tuning
// (color scheme, tool particle counts, etc.) lives in its own
// localStorage key via fxConfig.js instead of here — it's freeform tuning
// data, not part of the game-progress schema this file covers.

const KEY = 'particle_flow_save';

function defaultSave() {
  return {
    version: '1.0',
    current_level: 1,
    completed_levels: [],
    unlocked_tools: ['wind_jet'],
    settings: {
      particle_count: 4096,
      sound_enabled: true,
    },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const defaults = defaultSave();
    // Shallow merge would let an older save's `settings` object (missing
    // newly added fields like color_scheme) blot out the fresh defaults —
    // merge that one level deeper.
    return { ...defaults, ...parsed, settings: { ...defaults.settings, ...(parsed.settings || {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // localStorage unavailable (private mode / quota) — progress just
    // won't persist across reloads, not fatal to the current session.
  }
}

export function markLevelComplete(save, levelId, unlocksTool) {
  if (!save.completed_levels.includes(levelId)) {
    save.completed_levels.push(levelId);
  }
  if (unlocksTool && !save.unlocked_tools.includes(unlocksTool)) {
    save.unlocked_tools.push(unlocksTool);
  }
  writeSave(save);
}
