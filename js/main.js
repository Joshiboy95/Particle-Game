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

const MAX_PARTICLES = 4096;

const glCanvas = document.getElementById('gl-canvas');
const uiCanvas = document.getElementById('ui-canvas');

initCoords([glCanvas, uiCanvas]);

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
  onOpenPopover: (tool, x, y) => ui.showPopover(tool, x, y),
});

const ui = new UI({ uiCanvas, dragController });
ui.setRemoveHandler((toolId) => level.removeTool(toolId));

function startLevel(index) {
  levelIndex = index;
  level = new Level(LEVEL_DATA[levelIndex]);
  handledComplete = false;
  save.current_level = level.def.id;
  ui.buildPalette(level, save.unlocked_tools);
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
    ui.showCompleteModal(goToNextLevel);
  }

  const size = getSize();
  renderer.draw(level.pool, size.dpr);
  ui.render(level, dt);
  ui.updateHUD(level);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
