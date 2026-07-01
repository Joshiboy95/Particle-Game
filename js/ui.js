// DOM UI (palette, budget bar, modals, popover) + Canvas2D overlay
// rendering (obstacles come from obstacles.js; this module draws the
// emitter, target circle, tool force-field visuals, and the drag ghost).

import { TOOL_DEFINITIONS } from './tools.js';
import { toPixel, toPixelLength, cssToDevicePixel, getSize } from './coords.js';
import { drawObstacles } from './obstacles.js';
import { getHandlePositionsCss } from './handles.js';

const TOOL_ORDER = ['wind_jet', 'attractor', 'repulsor'];
const FILL_SMOOTHING_SECONDS = 1.0;

export class UI {
  constructor({ uiCanvas, dragController }) {
    this.uiCanvas = uiCanvas;
    this.ctx = uiCanvas.getContext('2d');
    this.dragController = dragController;

    this.paletteEl = document.getElementById('toolpalette');
    this.levelLabelEl = document.getElementById('level-label');
    this.budgetFillEl = document.getElementById('budget-bar-fill');
    this.budgetTextEl = document.getElementById('budget-bar-text');
    this.throughputEl = document.getElementById('throughput-readout');

    this.levelModalEl = document.getElementById('level-modal');
    this.levelModalTitleEl = document.getElementById('level-modal-title');
    this.levelModalDescEl = document.getElementById('level-modal-desc');
    this.completeModalEl = document.getElementById('complete-modal');
    this.nextLevelBtn = document.getElementById('next-level-btn');

    this.popoverEl = document.getElementById('tool-popover');
    this.popoverStrength = document.getElementById('popover-strength');
    this.popoverRadius = document.getElementById('popover-radius');
    this.popoverRemove = document.getElementById('popover-remove');
    this.popoverTool = null;
    this._wirePopover();

    this._smoothedFill = [];
    this._lastBudgetText = '';
    this._levelModalTimer = null;
  }

  _wirePopover() {
    this.popoverStrength.addEventListener('input', () => {
      if (this.popoverTool) this.popoverTool.strength = parseFloat(this.popoverStrength.value);
    });
    this.popoverRadius.addEventListener('input', () => {
      if (this.popoverTool) this.popoverTool.radius = parseFloat(this.popoverRadius.value);
    });
    // Only handles clicks *outside* the canvas (e.g. on the HUD/palette);
    // clicks on the field itself are already routed through
    // dragController's own empty-space/handle/tool hit-testing, which
    // calls deselect()/onDeselect() -> hidePopover() as needed. Guarding on
    // dragController.state === 'idle' avoids fighting an in-progress drag
    // or handle interaction.
    document.addEventListener('pointerdown', (e) => {
      if (
        this.dragController.state === 'idle' &&
        this.popoverTool &&
        !this.popoverEl.contains(e.target) &&
        e.target !== this.uiCanvas
      ) {
        this.dragController.deselect();
      }
    });
  }

  buildPalette(level, unlockedTools) {
    this.paletteEl.innerHTML = '';
    for (const type of TOOL_ORDER) {
      const def = TOOL_DEFINITIONS[type];
      const unlocked = unlockedTools.includes(type) && level.def.available_tools.includes(type);
      const icon = document.createElement('div');
      icon.className = 'tool-icon' + (unlocked ? '' : ' locked');
      icon.innerHTML = `<span>${def.label}</span><span class="tool-cost">${def.cost} EP</span>`;
      if (!unlocked) {
        const lockLabel = document.createElement('span');
        lockLabel.className = 'tool-lock-label';
        lockLabel.textContent = `Level ${def.unlockedAtLevel}`;
        icon.appendChild(lockLabel);
      } else {
        this.dragController.attachPaletteIcon(icon, type);
      }
      this.paletteEl.appendChild(icon);
    }
  }

  showLevelModal(levelDef, index, total) {
    this.levelModalTitleEl.textContent = `Level ${index} von ${total} — ${levelDef.name}`;
    this.levelModalDescEl.textContent = levelDef.description;
    this.levelModalEl.classList.remove('hidden');
    this.levelLabelEl.textContent = `Level ${index} von ${total}`;

    const close = () => this.levelModalEl.classList.add('hidden');
    this.levelModalEl.onclick = close;
    if (this._levelModalTimer) clearTimeout(this._levelModalTimer);
    this._levelModalTimer = setTimeout(close, 4000);
  }

  showCompleteModal(onNext) {
    this.completeModalEl.classList.remove('hidden');
    this.nextLevelBtn.onclick = () => {
      this.completeModalEl.classList.add('hidden');
      onNext();
    };
  }

  showPopover(tool, clientX, clientY) {
    this.popoverTool = tool;
    this.popoverStrength.value = tool.strength;
    this.popoverRadius.value = tool.radius;
    // Offset well clear of the selection handles (rotate/delete sit within
    // ~50px of the tool center) so the popover's own bounding box — which
    // captures pointer events across its whole rectangle, not just its
    // visible controls — never overlaps and steals clicks meant for them.
    this.popoverEl.style.left = clientX + 24 + 'px';
    this.popoverEl.style.top = clientY + 60 + 'px';
    this.popoverEl.classList.remove('hidden');
    this.popoverRemove.onclick = () => {
      this._onRemoveTool && this._onRemoveTool(tool.id);
      this.hidePopover();
    };
  }

  hidePopover() {
    this.popoverTool = null;
    this.popoverEl.classList.add('hidden');
  }

  setRemoveHandler(fn) {
    this._onRemoveTool = fn;
  }

  updateHUD(level) {
    const pct = Math.max(0, level.budgetAvailable / level.def.budget) * 100;
    this.budgetFillEl.style.width = pct + '%';
    const text = `${level.budgetAvailable} / ${level.def.budget} EP`;
    if (text !== this._lastBudgetText) {
      this.budgetTextEl.textContent = text;
      this._lastBudgetText = text;
    }
    const efficiency = level.lastEfficiencies[0] || 0;
    this.throughputEl.textContent = Math.round(efficiency * 100) + '%';
  }

  render(level, dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    drawObstacles(ctx, level.def.obstacles);
    this._drawEmitters(ctx, level.def.emitters);
    this._drawTargets(ctx, level, dt);
    this._drawTools(ctx, level);
    this._drawDragGhost(ctx, level);
    this._drawSelectionHandles(ctx, level);
  }

  _drawEmitters(ctx, emitters) {
    ctx.fillStyle = '#E8ECF4';
    for (const e of emitters) {
      const p = toPixel(e.position.x, e.position.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawTargets(ctx, level, dt) {
    const targets = level.def.targets;
    while (this._smoothedFill.length < targets.length) this._smoothedFill.push(0);

    for (let t = 0; t < targets.length; t++) {
      const target = targets[t];
      const efficiency = level.lastEfficiencies[t] || 0;
      const smoothing = Math.min(1, dt / FILL_SMOOTHING_SECONDS);
      this._smoothedFill[t] += (efficiency - this._smoothedFill[t]) * smoothing;

      const p = toPixel(target.position.x, target.position.y);
      const r = toPixelLength(target.radius);

      ctx.strokeStyle = 'rgba(148, 180, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();

      const fill = Math.min(1, Math.max(0, this._smoothedFill[t]));
      ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, r * 0.85, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6, -Math.PI / 2, -Math.PI / 2 + level.holdProgress * Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawTools(ctx, level) {
    for (const tool of level.activeTools) {
      const p = toPixel(tool.position.x, tool.position.y);
      const isDraggedInvalid =
        this.dragController.state === 'dragging-existing' &&
        this.dragController.draggedToolId === tool.id &&
        !this.dragController.dragValid;

      const isSelected = this.dragController.selectedToolId === tool.id;
      ctx.strokeStyle = isDraggedInvalid
        ? 'rgba(239, 68, 68, 0.8)'
        : isSelected
        ? 'rgba(226, 232, 255, 0.9)'
        : 'rgba(148, 180, 255, 0.6)';
      ctx.lineWidth = isSelected ? 2 : 1.5;

      if (tool.type === 'wind_jet') {
        this._drawWindJet(ctx, tool, p);
      } else {
        this._drawRadial(ctx, tool, p, tool.type === 'repulsor');
      }
    }
  }

  _drawWindJet(ctx, tool, p) {
    const range = toPixelLength(tool.radius);
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, range, dirRad - spreadRad / 2, dirRad + spreadRad / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(dirRad) * range, p.y + Math.sin(dirRad) * range);
    ctx.stroke();
  }

  _drawRadial(ctx, tool, p, outward) {
    const r = toPixelLength(tool.radius);
    for (const frac of [0.4, 0.7, 1.0]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * frac, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDragGhost(ctx, level) {
    const dc = this.dragController;
    if (dc.state !== 'dragging-new' || !dc.ghostPosition) return;
    const def = TOOL_DEFINITIONS[dc.pendingType];
    const p = toPixel(dc.ghostPosition.x, dc.ghostPosition.y);
    const r = toPixelLength(def.defaultRadius);
    ctx.strokeStyle = dc.dragValid ? 'rgba(74, 222, 128, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawSelectionHandles(ctx, level) {
    const toolId = this.dragController.selectedToolId;
    if (!toolId) return;
    const tool = level.getTool(toolId);
    if (!tool) return;

    const handlesCss = getHandlePositionsCss(tool);
    const dpr = getSize().dpr;
    const toolPixel = toPixel(tool.position.x, tool.position.y);

    if (handlesCss.rotate) {
      const rp = cssToDevicePixel(handlesCss.rotate.x, handlesCss.rotate.y);
      ctx.strokeStyle = 'rgba(226, 232, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toolPixel.x, toolPixel.y);
      ctx.lineTo(rp.x, rp.y);
      ctx.stroke();

      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 7 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#E8ECF4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const dp = cssToDevicePixel(handlesCss.delete.x, handlesCss.delete.y);
    ctx.fillStyle = '#B91C1C';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, 8 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#E8ECF4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = '#E8ECF4';
    ctx.lineWidth = 1.5;
    const xArm = 3.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(dp.x - xArm, dp.y - xArm);
    ctx.lineTo(dp.x + xArm, dp.y + xArm);
    ctx.moveTo(dp.x + xArm, dp.y - xArm);
    ctx.lineTo(dp.x - xArm, dp.y + xArm);
    ctx.stroke();
  }
}
