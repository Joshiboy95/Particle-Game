// localStorage persistence, schema per design doc §9.4.

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
    return { ...defaultSave(), ...parsed };
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
