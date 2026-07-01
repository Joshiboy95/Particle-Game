// DOM UI (palette, budget bar, modals) + Canvas2D overlay rendering
// (obstacles come from obstacles.js; this module draws the emitter,
// target circle, tool force-field visuals, and the drag ghost). There is
// no properties panel — every tool parameter is edited by dragging
// directly on the element via its handles (see handles.js/drag.js).

import { TOOL_DEFINITIONS, WIND_JET_RANGE, windJetStrengthToHandleLenCss } from './tools.js';
import { toPixel, toPixelLength, cssToDevicePixel, getSize } from './coords.js';
import { drawObstacles } from './obstacles.js';
import { getHandlePositionsCss } from './handles.js';

const TOOL_ORDER = ['wind_jet', 'attractor', 'repulsor'];
const FILL_SMOOTHING_SECONDS = 1.0;
const RADIAL_SPOKE_COUNT = 14;

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

    // Clicking outside the canvas (HUD/palette) clears the selection;
    // clicks on the field itself are already handled by dragController's
    // own empty-space/handle/tool hit-testing in _onCanvasDown.
    document.addEventListener('pointerdown', (e) => {
      if (this.dragController.state === 'idle' && e.target !== this.uiCanvas) {
        this.dragController.deselect();
      }
    });

    this._smoothedFill = [];
    this._lastBudgetText = '';
    this._levelModalTimer = null;
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

      if (tool.type === 'wind_jet') {
        this._drawWindJet(ctx, tool, p, isSelected, isDraggedInvalid);
      } else {
        this._drawRadial(ctx, tool, p, tool.type === 'repulsor', isSelected, isDraggedInvalid);
      }
    }
  }

  _drawWindJet(ctx, tool, p, isSelected, isInvalid) {
    const dpr = getSize().dpr;
    const range = toPixelLength(WIND_JET_RANGE);
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    const spreadRad = (tool.params.spreadAngle || 0) * Math.PI / 180;
    const invalidTint = isInvalid ? 'rgba(239, 68, 68, 0.9)' : null;

    // Faint reach wedge for context — the cone's range is fixed, not
    // user-tunable; only length (strength) and angle (direction) are.
    ctx.strokeStyle = invalidTint || (isSelected ? 'rgba(147, 197, 253, 0.35)' : 'rgba(147, 197, 253, 0.18)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, range, dirRad - spreadRad / 2, dirRad + spreadRad / 2);
    ctx.closePath();
    ctx.stroke();

    // Main force vector: its length *is* the strength.
    const lenCss = windJetStrengthToHandleLenCss(tool.strength);
    const len = lenCss * dpr;
    const tipX = p.x + Math.cos(dirRad) * len;
    const tipY = p.y + Math.sin(dirRad) * len;

    this._drawGradientRay(ctx, p.x, p.y, tipX, tipY, invalidTint, 2.5 * dpr);
    this._drawArrowhead(ctx, tipX, tipY, dirRad, invalidTint || '#BFDBFE', 6 * dpr);

    // Flanking flow lines for texture.
    for (const offset of [-0.14, 0.14]) {
      const a = dirRad + offset;
      const flen = len * 0.65;
      const fx = p.x + Math.cos(a) * flen;
      const fy = p.y + Math.sin(a) * flen;
      this._drawGradientRay(ctx, p.x, p.y, fx, fy, invalidTint, 1 * dpr, 0.5);
    }

    ctx.fillStyle = invalidTint || '#93C5FD';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawGradientRay(ctx, x1, y1, x2, y2, tintOverride, lineWidth, alphaScale = 1) {
    if (tintOverride) {
      ctx.strokeStyle = tintOverride;
    } else {
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, `rgba(191, 219, 254, ${0.95 * alphaScale})`);
      gradient.addColorStop(1, `rgba(96, 165, 250, ${0.1 * alphaScale})`);
      ctx.strokeStyle = gradient;
    }
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  _drawArrowhead(ctx, tipX, tipY, angle, color, size) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(angle - 0.4) * size, tipY - Math.sin(angle - 0.4) * size);
    ctx.lineTo(tipX - Math.cos(angle + 0.4) * size, tipY - Math.sin(angle + 0.4) * size);
    ctx.closePath();
    ctx.fill();
  }

  // Attractor/Repulsor: radiating "light" spokes from the center, each
  // with its own gradient (bright-near-center for attractor, pulling the
  // eye inward; bright-near-edge for repulsor, pushing it outward), plus
  // a small arrow along each spoke showing the force's direction.
  _drawRadial(ctx, tool, p, outward, isSelected, isInvalid) {
    const dpr = getSize().dpr;
    const r = toPixelLength(tool.radius);
    const invalidTint = isInvalid ? 'rgba(239, 68, 68, 0.85)' : null;

    for (let i = 0; i < RADIAL_SPOKE_COUNT; i++) {
      const angle = (i / RADIAL_SPOKE_COUNT) * Math.PI * 2;
      const x2 = p.x + Math.cos(angle) * r;
      const y2 = p.y + Math.sin(angle) * r;

      if (invalidTint) {
        ctx.strokeStyle = invalidTint;
      } else {
        const gradient = ctx.createLinearGradient(p.x, p.y, x2, y2);
        const innerAlpha = isSelected ? 0.95 : 0.8;
        const outerAlpha = isSelected ? 0.12 : 0.06;
        if (outward) {
          gradient.addColorStop(0, `rgba(147, 197, 253, ${outerAlpha})`);
          gradient.addColorStop(1, `rgba(191, 219, 254, ${innerAlpha})`);
        } else {
          gradient.addColorStop(0, `rgba(191, 219, 254, ${innerAlpha})`);
          gradient.addColorStop(1, `rgba(147, 197, 253, ${outerAlpha})`);
        }
        ctx.strokeStyle = gradient;
      }
      ctx.lineWidth = 1.25 * dpr;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Small chevron marking the force's direction along the spoke.
      const chevronDist = outward ? r * 0.72 : r * 0.4;
      const cx = p.x + Math.cos(angle) * chevronDist;
      const cy = p.y + Math.sin(angle) * chevronDist;
      const chevronAngle = outward ? angle : angle + Math.PI;
      this._drawArrowhead(ctx, cx, cy, chevronAngle, invalidTint || 'rgba(191, 219, 254, 0.7)', 4 * dpr);
    }

    // Soft glow disc at the center.
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 0.18);
    glow.addColorStop(0, invalidTint || 'rgba(191, 219, 254, 0.6)');
    glow.addColorStop(1, 'rgba(191, 219, 254, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = invalidTint || '#93C5FD';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 * dpr, 0, Math.PI * 2);
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

    const dragHandle = handlesCss.vector || handlesCss.power;
    if (dragHandle) {
      const hp = cssToDevicePixel(dragHandle.x, dragHandle.y);
      ctx.strokeStyle = 'rgba(226, 232, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toolPixel.x, toolPixel.y);
      ctx.lineTo(hp.x, hp.y);
      ctx.stroke();

      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 7 * dpr, 0, Math.PI * 2);
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
    const xArm = 3.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(dp.x - xArm, dp.y - xArm);
    ctx.lineTo(dp.x + xArm, dp.y + xArm);
    ctx.moveTo(dp.x + xArm, dp.y - xArm);
    ctx.lineTo(dp.x - xArm, dp.y + xArm);
    ctx.stroke();
  }
}
