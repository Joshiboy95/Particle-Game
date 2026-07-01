// Custom Pointer Events drag system: one state machine handles dragging a
// new tool in from the palette, repositioning an already-placed tool, and
// (once a tool is selected) dragging its vector/power/delete handles.
// Chosen over the native HTML5 Drag-and-Drop API because that API has
// weak touch support and awkward coordinate handling against a canvas
// drop target (doc §12 flags mobile/touch as an open item — this keeps
// the door open for it).
//
// There is no separate properties panel: every tunable parameter is
// edited by dragging directly on the element itself (see handles.js) —
// tapping a placed tool (or finishing a drag on it) just selects it,
// which shows its handles.

import { clientToNorm, toCssPixel, cssLengthToNormLen } from './coords.js';
import { isPointBlocked } from './obstacles.js';
import { hitTestHandles } from './handles.js';
import {
  windJetHandleLenCssToStrength,
  WIND_JET_MIN_LEN_CSS,
  WIND_JET_MAX_LEN_CSS,
  WIND_JET_RANGE,
  RADIAL_MIN_RADIUS,
  RADIAL_MAX_RADIUS,
  radialStrengthFromRadius,
  normalizeAngle,
} from './tools.js';

const HIT_RADIUS_NORM = 0.035; // minimum click/tap tolerance even for a tiny tool
const WIND_JET_HIT_ANGLE_MARGIN = (8 * Math.PI) / 180; // a bit forgiving past the cone's visual edge
const TAP_MOVE_THRESHOLD_NORM = 0.01; // below this, a press+release counts as a tap, not a drag

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class DragController {
  constructor({ canvas, getLevel, onChange }) {
    this.canvas = canvas;
    this.getLevel = getLevel;
    this.onChange = onChange || (() => {});

    this.state = 'idle'; // idle | dragging-new | dragging-existing | handle-vector | handle-power
    this.pendingType = null;
    this.draggedToolId = null;
    this.originalPosition = null;
    this.ghostPosition = null;
    this.dragValid = true;
    this.activePointerId = null;
    this.selectedToolId = null;
    this.handleToolId = null;
    this._hasMoved = false;

    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    canvas.addEventListener('pointerdown', (e) => this._onCanvasDown(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  attachPaletteIcon(iconEl, toolType) {
    iconEl.addEventListener('pointerdown', (e) => this._onPaletteDown(e, toolType));
  }

  deselect() {
    this.selectedToolId = null;
  }

  // Called when switching levels: the old Level's tool references (and
  // any in-progress drag/handle interaction) are no longer valid.
  reset() {
    this._cancelDrag();
    this.deselect();
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

    // 1. A handle of the currently selected tool takes priority.
    if (this.selectedToolId) {
      const selectedTool = level.getTool(this.selectedToolId);
      if (selectedTool) {
        const hit = hitTestHandles(selectedTool, e.clientX, e.clientY);
        if (hit === 'delete') {
          e.preventDefault();
          e.stopPropagation();
          level.removeTool(selectedTool.id);
          this.deselect();
          this.onChange();
          return;
        }
        if (hit === 'vector' || hit === 'power') {
          e.preventDefault();
          e.stopPropagation();
          this.state = hit === 'vector' ? 'handle-vector' : 'handle-power';
          this.handleToolId = selectedTool.id;
          this.activePointerId = e.pointerId;
          window.addEventListener('pointermove', this._onMove);
          window.addEventListener('pointerup', this._onUp);
          return;
        }
      }
    }

    // 2. An existing tool body: right-click selects immediately, left-click
    // starts a drag that resolves to either a tap-select or a move on release.
    const tool = this._findToolNear(level, norm);
    if (tool) {
      e.preventDefault();
      e.stopPropagation();

      if (e.button === 2) {
        this.selectedToolId = tool.id;
        return;
      }

      this.state = 'dragging-existing';
      this.draggedToolId = tool.id;
      this.originalPosition = { ...tool.position };
      this.activePointerId = e.pointerId;
      this._downNorm = norm;
      this._hasMoved = false;
      this._updateValidity(level);
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      return;
    }

    // 3. Empty field: clear selection.
    this.deselect();
  }

  _onMove(e) {
    if (e.pointerId !== this.activePointerId) return;
    const level = this.getLevel();
    const norm = this._clampedNorm(e.clientX, e.clientY);

    if (this.state === 'dragging-new') {
      this.ghostPosition = norm;
    } else if (this.state === 'dragging-existing') {
      const dx = norm.x - this._downNorm.x;
      const dy = norm.y - this._downNorm.y;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD_NORM) this._hasMoved = true;
      level.moveTool(this.draggedToolId, norm);
    } else if (this.state === 'handle-vector' || this.state === 'handle-power') {
      // CSS-pixel space, not normalized: a fixed-radius circle of drag
      // positions must map to a real circle on screen (isotropic), which
      // normalized space can't guarantee on a non-square field.
      const tool = level.getTool(this.handleToolId);
      if (tool) {
        const center = toCssPixel(tool.position.x, tool.position.y);
        const dx = e.clientX - center.x;
        const dy = e.clientY - center.y;
        const distCss = Math.sqrt(dx * dx + dy * dy);

        if (this.state === 'handle-vector') {
          // Length -> strength, angle -> direction: both edited by one drag.
          tool.params.direction = (Math.atan2(dy, dx) * 180) / Math.PI;
          tool.strength = windJetHandleLenCssToStrength(clamp(distCss, WIND_JET_MIN_LEN_CSS, WIND_JET_MAX_LEN_CSS));
        } else {
          // Radial power handle: distance only (angle is ignored — the
          // handle stays pinned to its reference angle, purely a resize).
          const radius = clamp(cssLengthToNormLen(distCss), RADIAL_MIN_RADIUS, RADIAL_MAX_RADIUS);
          tool.radius = radius;
          tool.strength = radialStrengthFromRadius(radius);
        }
      }
      return;
    } else {
      return;
    }
    this._updateValidity(level);
  }

  _onUp(e) {
    if (e.pointerId !== this.activePointerId) return;
    const level = this.getLevel();

    if (this.state === 'dragging-new') {
      if (this.dragValid) {
        const placed = level.placeTool(this.pendingType, this.ghostPosition);
        if (placed) this.selectedToolId = placed.id;
      }
    } else if (this.state === 'dragging-existing') {
      if (!this.dragValid) level.moveTool(this.draggedToolId, this.originalPosition);
      const tool = level.getTool(this.draggedToolId);
      if (tool) this.selectedToolId = tool.id;
    }
    // handle-vector / handle-power: nothing further to do on release,
    // selection is unchanged.

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
    this.handleToolId = null;
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

  // The whole visual footprint is clickable (the cone for Wind-Jet, the
  // whole ring for Attractor/Repulsor) — not just a small dot at the
  // center — with a small fixed floor so even a tiny tool stays pickable.
  _isInsideFootprint(tool, norm, dist) {
    if (dist < HIT_RADIUS_NORM) return true;
    if (tool.type === 'wind_jet') {
      if (dist > WIND_JET_RANGE) return false;
      const dirRad = (tool.params.direction || 0) * Math.PI / 180;
      const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
      const angleToPoint = Math.atan2(norm.y - tool.position.y, norm.x - tool.position.x);
      const diff = normalizeAngle(angleToPoint - dirRad);
      return Math.abs(diff) <= spreadRad / 2 + WIND_JET_HIT_ANGLE_MARGIN;
    }
    return dist <= tool.radius;
  }

  _findToolNear(level, norm) {
    let best = null;
    let bestDist = Infinity;
    for (const tool of level.activeTools) {
      const dx = tool.position.x - norm.x;
      const dy = tool.position.y - norm.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (this._isInsideFootprint(tool, norm, dist) && dist < bestDist) {
        best = tool;
        bestDist = dist;
      }
    }
    return best;
  }
}
