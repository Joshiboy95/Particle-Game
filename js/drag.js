// Custom Pointer Events drag system: one state machine handles both
// dragging a new tool in from the palette and repositioning an already-
// placed tool. Chosen over the native HTML5 Drag-and-Drop API because that
// API has weak touch support and awkward coordinate handling against a
// canvas drop target (doc §12 flags mobile/touch as an open item — this
// keeps the door open for it).

import { clientToNorm } from './coords.js';
import { isPointBlocked } from './obstacles.js';

const HIT_RADIUS_NORM = 0.035; // click/tap tolerance for picking up a placed tool
const LONG_PRESS_MS = 450;

export class DragController {
  constructor({ canvas, getLevel, onChange, onOpenPopover }) {
    this.canvas = canvas;
    this.getLevel = getLevel;
    this.onChange = onChange || (() => {});
    this.onOpenPopover = onOpenPopover || (() => {});

    this.state = 'idle'; // idle | dragging-new | dragging-existing
    this.pendingType = null;
    this.draggedToolId = null;
    this.originalPosition = null;
    this.ghostPosition = null;
    this.dragValid = false;
    this.activePointerId = null;
    this._longPressTimer = null;

    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    canvas.addEventListener('pointerdown', (e) => this._onCanvasDown(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  attachPaletteIcon(iconEl, toolType) {
    iconEl.addEventListener('pointerdown', (e) => this._onPaletteDown(e, toolType));
  }

  _onPaletteDown(e, toolType) {
    if (this.state !== 'idle') return;
    const level = this.getLevel();
    if (!level.canAfford(toolType)) return;
    e.preventDefault();

    this.state = 'dragging-new';
    this.pendingType = toolType;
    this.activePointerId = e.pointerId;
    this.ghostPosition = this._clampedNorm(e.clientX, e.clientY);
    this._updateValidity(level);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
  }

  _onCanvasDown(e) {
    if (this.state !== 'idle') return;
    const level = this.getLevel();
    const norm = this._clampedNorm(e.clientX, e.clientY);
    const tool = this._findToolNear(level, norm);
    if (!tool) return;
    e.preventDefault();

    if (e.button === 2) {
      e.stopPropagation(); // don't let ui.js's document-level "click outside" listener see this same event and immediately close the popover it's about to open
      this.onOpenPopover(tool, e.clientX, e.clientY);
      return;
    }

    this.state = 'dragging-existing';
    this.draggedToolId = tool.id;
    this.originalPosition = { ...tool.position };
    this.activePointerId = e.pointerId;
    this._updateValidity(level);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);

    this._longPressTimer = setTimeout(() => {
      if (this.state === 'dragging-existing' && this.draggedToolId === tool.id) {
        this._cancelDrag();
        this.onOpenPopover(tool, e.clientX, e.clientY);
      }
    }, LONG_PRESS_MS);
  }

  _onMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    const level = this.getLevel();
    const norm = this._clampedNorm(e.clientX, e.clientY);

    if (this.state === 'dragging-new') {
      this.ghostPosition = norm;
    } else if (this.state === 'dragging-existing') {
      level.moveTool(this.draggedToolId, norm);
    } else {
      return;
    }
    this._updateValidity(level);
  }

  _onUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    const level = this.getLevel();

    if (this.state === 'dragging-new') {
      if (this.dragValid) level.placeTool(this.pendingType, this.ghostPosition);
    } else if (this.state === 'dragging-existing') {
      if (!this.dragValid) level.moveTool(this.draggedToolId, this.originalPosition);
    }

    this._cancelDrag();
    this.onChange();
  }

  _cancelDrag() {
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    this.state = 'idle';
    this.pendingType = null;
    this.draggedToolId = null;
    this.originalPosition = null;
    this.ghostPosition = null;
    this.activePointerId = null;
  }

  _clampedNorm(clientX, clientY) {
    const p = clientToNorm(clientX, clientY, this.canvas);
    return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
  }

  _updateValidity(level) {
    const pos = this.state === 'dragging-new' ? this.ghostPosition : this._currentToolPosition(level);
    if (!pos) {
      this.dragValid = false;
      return;
    }
    this.dragValid = !isPointBlocked(pos.x, pos.y, level.def.obstacles);
  }

  _currentToolPosition(level) {
    const tool = level.getTool(this.draggedToolId);
    return tool ? tool.position : null;
  }

  _findToolNear(level, norm) {
    let best = null;
    let bestDist = HIT_RADIUS_NORM;
    for (const tool of level.activeTools) {
      const dx = tool.position.x - norm.x;
      const dy = tool.position.y - norm.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        best = tool;
        bestDist = dist;
      }
    }
    return best;
  }
}
