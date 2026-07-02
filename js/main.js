// Bootstrap + the main requestAnimationFrame loop. Wires every module
// together; see CLAUDE.md / the POC implementation plan for the intended
// per-frame order (emit -> forces -> integrate -> collide -> capture ->
// completion state machine -> render).

import { initCoords, onResize, getSize } from './coords.js';
import { initGL, ParticleRenderer } from './webgl.js';
import { Level } from './level.js';
import { LEVEL_DATA } from './data/levels.js';
import { UI } from './ui.js';
import { DragController } from './drag.js';
import { loadSave, markLevelComplete } from './save.js';
import { getMainConfig } from './fxConfig.js';

const MAX_PARTICLES = 4096;

const toolFxCanvas = document.getElementById('toolfx-canvas');
const glCanvas = document.getElementById('gl-canvas');
const uiCanvas = document.getElementById('ui-canvas');

initCoords([toolFxCanvas, glCanvas, uiCanvas]);

const gl = initGL(glCanvas);
const renderer = new ParticleRenderer(gl, MAX_PARTICLES);
renderer.setViewport(getSize().width, getSize().height);
onResize((size) => renderer.setViewport(size.width, size.height));

const save = loadSave();
let levelIndex = Math.max(0, LEVEL_DATA.findIndex((l) => l.id === save.current_level));
let level = new Level(LEVEL_DATA[levelIndex]);
let handledComplete = false;

const dragController = new DragController({
  canvas: uiCanvas,
  getLevel: () => level,
  onChange: () => {},
});

const ui = new UI({ toolFxCanvas, uiCanvas, dragController });

function startLevel(index) {
  dragController.reset();
  levelIndex = index;
  level = new Level(LEVEL_DATA[levelIndex]);
  handledComplete = false;
  save.current_level = level.def.id;
  ui.buildPalette(level, save.unlocked_tools);
  ui.buildLevelSelectPanel(LEVEL_DATA, save, level.def.id, startLevel);
  ui.showLevelModal(level.def, levelIndex + 1, LEVEL_DATA.length);
}

startLevel(levelIndex);

function goToNextLevel() {
  if (levelIndex + 1 < LEVEL_DATA.length) {
    startLevel(levelIndex + 1);
  }
}

let debugFastForwarding = false;
window.__debug = {
  getLevel: () => level,
  startLevel,
  // Advances the level's simulation `seconds` of *game* time using fixed
  // dt steps in a tight synchronous loop — no rendering, no waiting on
  // real wall-clock time. Lets a playtest script simulate 30s of play in
  // well under a second. Blocks the real rAF loop from double-stepping
  // while it runs (single-threaded JS: no rAF callback fires mid-loop
  // anyway, this just skips the *next* real frame's step too).
  fastForward(seconds, stepDt = 1 / 60) {
    debugFastForwarding = true;
    const steps = Math.round(seconds / stepDt);
    let simNow = performance.now();
    for (let i = 0; i < steps; i++) {
      simNow += stepDt * 1000;
      level.step(stepDt, simNow);
      if (level.completed) break;
    }
    debugFastForwarding = false;
    lastTime = performance.now();
    return {
      state: level.state,
      completed: level.completed,
      holdProgress: level.holdProgress,
      efficiencies: Array.from(level.lastEfficiencies),
      budgetUsed: level.budgetUsed,
      poolCount: level.pool.count,
    };
  },
};
let lastTime = performance.now();
// Simulated-time clock (ms), advanced by `dt` each stepped frame rather than
// read from performance.now(). The ThroughputMonitor's sliding window is
// keyed off this value, not wall-clock time — on a slow/laggy frame (dt
// capped below the real elapsed gap), fewer sim-seconds pass, so the
// window must shrink with them. Anchoring the window to wall-clock time
// instead would silently deflate measured efficiency under lag, punishing
// players for frame-rate drops rather than tool placement.
let simTime = 0;

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (debugFastForwarding) {
    requestAnimationFrame(frame);
    return;
  }

  simTime += dt * 1000;
  level.step(dt, simTime);

  if (level.completed && !handledComplete) {
    handledComplete = true;
    markLevelComplete(save, level.def.id, level.def.unlocks_on_complete);
    ui.buildPalette(level, save.unlocked_tools);
    ui.buildLevelSelectPanel(LEVEL_DATA, save, level.def.id, startLevel);
    ui.showCompleteModal(goToNextLevel);
  }

  const size = getSize();
  renderer.draw(level.pool, size.dpr, getMainConfig());
  ui.render(level, dt);
  ui.updateHUD(level);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
