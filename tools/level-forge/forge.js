#!/usr/bin/env node
// CLI entrypoint: wires stages 1-6 together.
//
//   node forge.js <loadout-config.js> [baseUrl]
//
// The config file exports a plain object — see loadouts/level8.example.js
// for the shape. Prints a difficulty report and a ready-to-paste level
// object (matching js/data/levels.js's existing style) to stdout, and also
// writes it to out/level-<id>.js.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { traceLoadout } = require('./trace.js');
const { autoTuneCorridor, runTrial } = require('./validate.js');
const { getToolCosts, assembleLevel } = require('./emit.js');

const SAVE_OVERRIDE = {
  version: '1.0',
  current_level: 1,
  completed_levels: [1, 2, 3, 4, 5, 6, 7],
  unlocked_tools: ['wind_jet', 'attractor', 'repulsor'],
  settings: { particle_count: 4096, sound_enabled: true },
};

// Minimal pretty-printer producing the same unquoted-key/single-quote style
// as the rest of js/data/levels.js, so output can be pasted in directly.
function toJsLiteral(value, indent = 2) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v) => padIn + toJsLiteral(v, indent + 2)).join(',\n');
    return `[\n${items},\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${padIn}${k}: ${toJsLiteral(v, indent + 2)}`).join(',\n');
    return `{\n${entries},\n${pad}}`;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  return JSON.stringify(value);
}

async function forge(config, baseUrl = 'http://localhost:8123/') {
  console.log(`\n=== Stage 2: tracing loadout for level ${config.id} ===`);
  const { center, edgeLow, edgeHigh } = await traceLoadout({
    baseUrl, loadout: config.loadout, emitter: config.emitter, saveOverride: SAVE_OVERRIDE,
  });
  console.log(`centerline: ${center.length} samples, edgeLow: ${edgeLow.length}, edgeHigh: ${edgeHigh.length}`);
  if (center.length < 2) {
    throw new Error('Centerline trace produced fewer than 2 points — loadout likely killed the particle immediately. Check tool placement.');
  }

  console.log(`\n=== Stage 3+4: corridor carving + auto-tune ===`);
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  let level, difficultyReport, realBudgetTrial;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl);
    await page.evaluate((save) => localStorage.setItem('particle_flow_save', JSON.stringify(save)), SAVE_OVERRIDE);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__debug, { timeout: 5000 });

    const candidate = {
      emitters: [config.emitter],
      targets: [config.target],
      ambient_force: config.ambientForce || { x: 0, y: 0 },
      emitter_rate: config.emitterRate ?? 200,
      particle_lifetime: config.particleLifetime ?? 10.0,
      completion: { targets_required: [config.target.id], efficiency_threshold: 0.5, hold_duration_seconds: 3.0 },
      budget: 999,
    };

    const tuned = await autoTuneCorridor({
      page,
      trails: [center, edgeLow, edgeHigh],
      candidate,
      loadout: config.loadout,
      forceOpen: [
        { x: config.emitter.position.x, y: config.emitter.position.y, radius: config.target.radius + 0.02 },
        { x: config.target.position.x, y: config.target.position.y, radius: config.target.radius + 0.02 },
      ],
      initialCorridorHalfWidth: config.corridorHalfWidth ?? 0.05,
      gridResolution: config.gridResolution ?? 60,
      targetBand: config.targetBand ?? [0.65, 0.95],
    });
    console.log(`auto-tune ${tuned.converged ? 'converged' : 'did not fully converge'} after ${tuned.iterations} iteration(s): corridorHalfWidth=${tuned.width.toFixed(4)}, obstacles=${tuned.obstacles.length}, achieved efficiency=${(tuned.trial.efficiency * 100).toFixed(1)}%`);

    console.log(`\n=== Stage 5+6: assembling level + difficulty report ===`);
    const toolCosts = await getToolCosts(page);
    const assembled = assembleLevel({
      id: config.id,
      meta: config.meta,
      loadout: config.loadout,
      toolCosts,
      trail: center,
      emitter: config.emitter,
      target: config.target,
      obstacles: tuned.obstacles,
      ambientForce: config.ambientForce,
      emitterRate: config.emitterRate,
      particleLifetime: config.particleLifetime,
      achievedEfficiency: tuned.trial.efficiency,
      holdDurationSeconds: config.holdDurationSeconds,
      budgetBuffer: config.budgetBuffer,
      unlocksOnComplete: config.unlocksOnComplete,
      corridorHalfWidth: tuned.width,
    });
    level = assembled.level;
    difficultyReport = assembled.difficultyReport;

    console.log(`\n=== Final check: real (unmodified) budget/threshold against generated level ===`);
    realBudgetTrial = await runTrial(page, { candidate: level, loadout: config.loadout, obstacles: level.obstacles, bypassBudget: false });
    console.log(JSON.stringify(realBudgetTrial));
  } finally {
    await browser.close();
  }

  return { level, difficultyReport, realBudgetTrial };
}

async function main() {
  const configPath = process.argv[2];
  const baseUrl = process.argv[3] || 'http://localhost:8123/';
  if (!configPath) {
    console.error('Usage: node forge.js <loadout-config.js> [baseUrl]');
    process.exit(1);
  }
  const config = require(path.resolve(configPath));
  const { level, difficultyReport, realBudgetTrial } = await forge(config, baseUrl);

  console.log('\n=== Difficulty report ===');
  console.log(JSON.stringify(difficultyReport, null, 2));

  console.log('\n=== Real-budget validation ===');
  console.log(JSON.stringify(realBudgetTrial, null, 2));

  const literal = '  ' + toJsLiteral(level, 2) + ',';
  console.log('\n=== Level object (paste into js/data/levels.js) ===\n');
  console.log(literal);

  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `level-${level.id}.js`);
  fs.writeFileSync(outFile, `// Auto-generated by level-forge. Difficulty report + real-budget check in the console output.\n${literal}\n`);
  console.log(`\nWritten to ${outFile}`);

  if (!realBudgetTrial.completed) {
    console.error('\nWARNING: generated level did NOT complete under its own real budget/threshold. Manual polish needed before adding to levels.js.');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { forge, toJsLiteral };
