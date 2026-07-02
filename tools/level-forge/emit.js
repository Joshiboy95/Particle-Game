// Stage 5 (level JSON assembly) + stage 6 (difficulty report). Pure
// assembly logic; the one browser touchpoint is fetching live tool costs
// from js/tools.js via dynamic import, so budget math never drifts from
// whatever TOOL_DEFINITIONS.cost actually is in the shipped game.

const { turningCount, tortuosity, pathLength } = require('./corridor.js');

async function getToolCosts(page) {
  return page.evaluate(async () => {
    const mod = await import('/js/tools.js');
    const out = {};
    for (const [type, def] of Object.entries(mod.TOOL_DEFINITIONS)) out[type] = def.cost;
    return out;
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Builds the full LEVEL_DATA-shaped object plus an informational difficulty
// report. `meta` carries the hand-written narrative fields (name,
// description, hints — German, formal Sie-Form) since those aren't
// auto-generated.
function assembleLevel({
  id, meta, loadout, toolCosts, trail, emitter, target, obstacles,
  ambientForce = { x: 0, y: 0 }, emitterRate = 200, particleLifetime = 10.0,
  achievedEfficiency, holdDurationSeconds = 3.0, budgetBuffer = 10,
  unlocksOnComplete = null, corridorHalfWidth,
}) {
  const toolCostSum = loadout.reduce((sum, t) => sum + (toolCosts[t.type] || 0), 0);
  const budget = toolCostSum + budgetBuffer;
  const threshold = clamp(+(achievedEfficiency * 0.85).toFixed(2), 0.55, 0.7);

  const level = {
    id,
    name: meta.name,
    description: meta.description,
    budget,
    emitter_rate: emitterRate,
    particle_lifetime: particleLifetime,
    ambient_force: ambientForce,
    emitters: [emitter],
    targets: [target],
    obstacles,
    // By Level 8, all three tools are already unlocked (L1 unlocks attractor,
    // L2 unlocks repulsor) — always offer the full palette here.
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: [target.id],
      efficiency_threshold: threshold,
      hold_duration_seconds: holdDurationSeconds,
    },
    unlocks_on_complete: unlocksOnComplete,
    hints: meta.hints,
  };

  const distinctTypes = new Set(loadout.map((t) => t.type)).size;
  const difficultyReport = {
    turningCount: turningCount(trail),
    tortuosity: +tortuosity(trail).toFixed(3),
    pathLength: +pathLength(trail).toFixed(3),
    toolCount: loadout.length,
    toolTypeDiversity: distinctTypes,
    corridorHalfWidth: +corridorHalfWidth.toFixed(4),
    achievedEfficiency: +achievedEfficiency.toFixed(4),
    budget,
    toolCostSum,
    budgetUtilization: +(toolCostSum / budget).toFixed(3),
  };

  return { level, difficultyReport };
}

module.exports = { getToolCosts, assembleLevel };
