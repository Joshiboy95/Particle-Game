// Stage 4: full-emitter validation + corridor-width auto-tune. Loads a
// candidate level (real obstacles, real emitter_rate/spread, real loadout)
// against a blank-canvas level whose `def` is overwritten in place, runs
// fastForward(30) exactly like this session's l3_full_tune.js/verify_l2.js
// pattern, and reports the achieved efficiency/completion/budget usage.

const { chromium } = require('playwright');
const { placeLoadout } = require('./trace.js');
const { buildCorridorObstacles } = require('./corridor.js');

const BLANK_CANVAS_LEVEL_INDEX = 0;

// Runs one fastForward(30) trial for a given obstacle set + loadout against
// the candidate's real emitter/target/budget. `bypassBudget` lets you check
// pure physics (ignore cost) separately from real affordability.
async function runTrial(page, { candidate, loadout, obstacles, bypassBudget = false }) {
  await page.evaluate((idx) => window.__debug.startLevel(idx), BLANK_CANVAS_LEVEL_INDEX);
  const result = await page.evaluate(({ candidate, loadout, obstacles, bypassBudget }) => {
    const level = window.__debug.getLevel();
    level.def.obstacles = obstacles;
    level.def.emitters = candidate.emitters;
    level.def.targets = candidate.targets;
    level.def.ambient_force = candidate.ambient_force || { x: 0, y: 0 };
    level.def.emitter_rate = candidate.emitter_rate;
    level.def.particle_lifetime = candidate.particle_lifetime;
    level.def.completion = candidate.completion;
    level.def.budget = bypassBudget ? 999 : candidate.budget;

    const placementErrors = [];
    for (const t of loadout) {
      const tool = level.placeTool(t.type, t.pos);
      if (!tool) { placementErrors.push(t.type); continue; }
      if (t.direction !== undefined) tool.params.direction = t.direction;
      if (t.spreadAngle !== undefined) tool.params.spreadAngle = t.spreadAngle;
      if (t.strength !== undefined) tool.strength = t.strength;
      if (t.radius !== undefined) tool.radius = t.radius;
    }
    return { placementErrors, budget: level.def.budget };
  }, { candidate, loadout, obstacles, bypassBudget });

  if (result.placementErrors.length) {
    return { efficiency: 0, completed: false, budgetUsed: 0, budget: result.budget, placementErrors: result.placementErrors };
  }

  const ff = await page.evaluate(() => window.__debug.fastForward(30));
  return {
    efficiency: ff.efficiencies[0] || 0,
    completed: ff.completed,
    budgetUsed: ff.budgetUsed,
    budget: result.budget,
    holdProgress: ff.holdProgress,
  };
}

// Auto-tune loop: start at `initialCorridorHalfWidth`, widen if efficiency is
// near-zero (corridor too tight for the real spread), narrow if suspiciously
// high (>95%, matching this session's "too easy" KPI signal) and the level
// is meant to have real precision demands. Stops once efficiency lands in
// `targetBand` or after `maxIterations`.
async function autoTuneCorridor({
  page, trails, candidate, loadout, forceOpen,
  initialCorridorHalfWidth = 0.05, gridResolution = 60,
  targetBand = [0.65, 0.95], maxIterations = 8,
}) {
  let width = initialCorridorHalfWidth;
  let best = null;
  for (let i = 0; i < maxIterations; i++) {
    const obstacles = buildCorridorObstacles({ trails, gridResolution, corridorHalfWidth: width, forceOpen });
    const trial = await runTrial(page, { candidate, loadout, obstacles, bypassBudget: true });
    const log = { iteration: i, corridorHalfWidth: +width.toFixed(4), efficiency: +trial.efficiency.toFixed(4), completed: trial.completed, obstacleCount: obstacles.length };
    if (!best || trial.efficiency > best.trial.efficiency) best = { obstacles, trial, width };

    if (trial.efficiency >= targetBand[0] && trial.efficiency <= targetBand[1]) {
      return { obstacles, trial, width, iterations: i + 1, log, converged: true };
    }
    if (trial.efficiency < targetBand[0]) {
      width *= 1.35; // too narrow for the real spread — widen
    } else {
      width *= 0.8; // too generous — narrow to add real precision demand
    }
  }
  return { ...best, iterations: maxIterations, converged: false };
}

module.exports = { runTrial, autoTuneCorridor, BLANK_CANVAS_LEVEL_INDEX };
