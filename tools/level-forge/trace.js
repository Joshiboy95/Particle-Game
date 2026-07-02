// Stage 2: browser-driven trail tracing. Loads the running game, places a
// loadout of tools via the window.__debug hook (js/main.js), and steps a
// deterministic particle through it in small fastForward increments,
// recording its (x,y) path until it dies, is captured, or times out.
//
// Traces the emitter's centerline plus its two angular-spread edges, so the
// corridor built in corridor.js reflects how much the *real* particle
// stream fans out, not just a single idealized line.

const { chromium } = require('playwright');

async function placeLoadout(page, loadout) {
  await page.evaluate((loadout) => {
    const level = window.__debug.getLevel();
    level.def.budget = 999; // physics-only tracing; affordability is checked separately in validate.js
    for (const t of loadout) {
      const tool = level.placeTool(t.type, t.pos);
      if (!tool) throw new Error(`placeTool failed for ${t.type} at ${JSON.stringify(t.pos)}`);
      if (t.direction !== undefined) tool.params.direction = t.direction;
      if (t.spreadAngle !== undefined) tool.params.spreadAngle = t.spreadAngle;
      if (t.strength !== undefined) tool.strength = t.strength;
      if (t.radius !== undefined) tool.radius = t.radius;
    }
  }, loadout);
}

// Traces one particle spawned at (emitter.position, headingRad, speed) until
// it dies/leaves the pool or a max step budget is hit. Returns the ordered
// (x,y) polyline.
async function traceOneParticle(page, { emitter, headingRad, speed = 0.14, lifetime = 20, maxSeconds = 12, stepDt = 0.15 }) {
  await page.evaluate(({ emitter, headingRad, speed, lifetime }) => {
    const level = window.__debug.getLevel();
    level.def.emitter_rate = 0;
    level.pool.clear();
    const vx = Math.cos(headingRad) * speed;
    const vy = Math.sin(headingRad) * speed;
    level.pool.spawn(emitter.x, emitter.y, vx, vy, lifetime);
  }, { emitter, headingRad, speed, lifetime });

  const trail = [];
  const steps = Math.round(maxSeconds / stepDt);
  for (let i = 0; i < steps; i++) {
    const sample = await page.evaluate((dt) => {
      const level = window.__debug.getLevel();
      const before = level.pool.count > 0 ? { x: level.pool.px[0], y: level.pool.py[0] } : null;
      const cap = level.throughputMonitors ? level.throughputMonitors[0].captureTimestamps.length : 0;
      window.__debug.fastForward(dt);
      const after = level.pool.count > 0 ? { x: level.pool.px[0], y: level.pool.py[0] } : null;
      const capAfter = level.throughputMonitors ? level.throughputMonitors[0].captureTimestamps.length : 0;
      return { before, after, captured: capAfter > cap };
    }, stepDt);
    if (sample.before && trail.length === 0) trail.push(sample.before);
    if (sample.after) trail.push(sample.after);
    if (!sample.after || sample.captured) break;
  }
  return trail;
}

// Runs a full trace session: centerline + two edge-spread traces, for a
// given loadout and emitter definition. Returns { center, edgeLow, edgeHigh }.
//
// Traces against a blank canvas (Level 1's index, which ships with an empty
// obstacles array) rather than any specific existing level — the whole point
// of level-forge is discovering the natural curve an *unobstructed* loadout
// produces, before any walls exist. Level 1's own emitter/obstacles are
// overridden per-trace so this never depends on Level 1's actual content.
const BLANK_CANVAS_LEVEL_INDEX = 0;

async function traceLoadout({ baseUrl, loadout, emitter, saveOverride }) {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl);
    await page.evaluate((save) => localStorage.setItem('particle_flow_save', JSON.stringify(save)), saveOverride);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__debug, { timeout: 5000 });

    const spreadRad = (emitter.spread_angle || 0) * Math.PI / 180;
    const baseHeadingRad = (emitter.direction || 0) * Math.PI / 180;

    const traceOnce = async (headingRad) => {
      await page.evaluate((idx) => window.__debug.startLevel(idx), BLANK_CANVAS_LEVEL_INDEX);
      await page.evaluate(() => { window.__debug.getLevel().def.obstacles = []; });
      await placeLoadout(page, loadout);
      return traceOneParticle(page, { emitter: emitter.position, headingRad });
    };

    const center = await traceOnce(baseHeadingRad);
    const edgeLow = await traceOnce(baseHeadingRad - spreadRad / 2);
    const edgeHigh = await traceOnce(baseHeadingRad + spreadRad / 2);

    return { center, edgeLow, edgeHigh };
  } finally {
    await browser.close();
  }
}

module.exports = { traceLoadout, placeLoadout, traceOneParticle };
