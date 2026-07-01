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

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  level.step(dt, now);

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
