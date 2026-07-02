// DOM UI (palette, budget bar, modals) + Canvas2D overlay rendering
// (obstacles come from obstacles.js; this module draws the emitter,
// target circle, tool boundaries/handles, and the drag ghost). There is
// no properties panel — every tool parameter is edited by dragging
// directly on the element via its handles (see handles.js/drag.js). Each
// tool's own ambient particle flow (its visual "character") is owned by
// toolFx.js and drawn between the boundary and the center glow.

import { TOOL_DEFINITIONS, windJetStrengthToHandleLenCss } from './tools.js';
import { toPixel, toPixelLength, cssToDevicePixel, getSize } from './coords.js';
import { drawObstacles } from './obstacles.js';
import { getHandlePositionsCss } from './handles.js';
import { ToolFxManager } from './toolFx.js';
import { SCHEME_META, sampleGradient } from './colorSchemes.js';
import { MAIN_SCHEMA, TOOL_FX_SCHEMA, getMainConfig, setMainParam, getToolConfig, setToolParam, serializeForCopy } from './fxConfig.js';

const TOOL_ORDER = ['wind_jet', 'attractor', 'repulsor'];
const FILL_SMOOTHING_SECONDS = 1.0;

function rgbCss(rgb01) {
  const r = Math.round(rgb01[0] * 255);
  const g = Math.round(rgb01[1] * 255);
  const b = Math.round(rgb01[2] * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export class UI {
  constructor({ toolFxCanvas, uiCanvas, dragController }) {
    this.uiCanvas = uiCanvas;
    this.ctx = uiCanvas.getContext('2d');
    this.toolFxCanvas = toolFxCanvas;
    this.toolFxCtx = toolFxCanvas.getContext('2d');
    this.dragController = dragController;
    this.toolFx = new ToolFxManager();

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

    this.copyLevelBtn = document.getElementById('copy-level-btn');
    this.copyLevelBtn.addEventListener('click', () => this._copyLevelReport(this.copyLevelBtn, '⧉'));
    this.copyLevelCompleteBtn = document.getElementById('copy-level-complete-btn');
    this.copyLevelCompleteBtn.addEventListener('click', () => this._copyLevelReport(this.copyLevelCompleteBtn, 'Level-Daten kopieren'));

    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsPanelEl = document.getElementById('settings-panel');
    this.fxPanelContentEl = document.getElementById('fx-panel-content');
    this.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.levelSelectPanelEl.classList.add('hidden');
      this.settingsPanelEl.classList.toggle('hidden');
    });
    this.buildFxPanel();

    this.levelSelectBtn = document.getElementById('level-select-btn');
    this.levelSelectPanelEl = document.getElementById('level-select-panel');
    this.levelSelectContentEl = document.getElementById('level-select-content');
    this.levelSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.settingsPanelEl.classList.add('hidden');
      this.levelSelectPanelEl.classList.toggle('hidden');
    });

    // Clicking outside the canvas (HUD/palette) clears the selection;
    // clicks on the field itself are already handled by dragController's
    // own empty-space/handle/tool hit-testing in _onCanvasDown.
    document.addEventListener('pointerdown', (e) => {
      if (this.dragController.state === 'idle' && e.target !== this.uiCanvas) {
        this.dragController.deselect();
      }
      if (
        !this.settingsPanelEl.classList.contains('hidden') &&
        !this.settingsPanelEl.contains(e.target) &&
        e.target !== this.settingsBtn
      ) {
        this.settingsPanelEl.classList.add('hidden');
      }
      if (
        !this.levelSelectPanelEl.classList.contains('hidden') &&
        !this.levelSelectPanelEl.contains(e.target) &&
        e.target !== this.levelSelectBtn
      ) {
        this.levelSelectPanelEl.classList.add('hidden');
      }
    });

    this._smoothedFill = [];
    this._lastBudgetText = '';
    this._levelModalTimer = null;
  }

  // Builds the whole settings panel content from fxConfig.js's schemas —
  // one section for the main particle stream, one per tool type. Adding a
  // new tool type later only needs a TOOL_FX_SCHEMA/TOOL_FX_DEFAULTS entry
  // in fxConfig.js; this method picks it up automatically via TOOL_ORDER.
  buildFxPanel() {
    const container = this.fxPanelContentEl;
    container.innerHTML = '';

    const mainCfg = getMainConfig();
    container.appendChild(this._buildSubheader('Partikel'));
    const mainSwatchList = this._buildSchemeSwatchList(mainCfg.color_scheme, mainCfg.custom_gradient, (key) => {
      setMainParam('color_scheme', key);
      mainCustomRow.style.display = key === 'custom' ? 'flex' : 'none';
    });
    container.appendChild(mainSwatchList);
    const mainCustomRow = this._buildCustomStopsEditor(mainCfg.custom_gradient, mainCfg.color_scheme === 'custom', (newStops) => {
      setMainParam('custom_gradient', newStops);
      this._updateSwatchPreview(mainSwatchList, newStops);
    });
    container.appendChild(mainCustomRow);
    for (const paramDef of MAIN_SCHEMA) {
      container.appendChild(this._buildRangeRow(paramDef, mainCfg[paramDef.key], (v) => setMainParam(paramDef.key, v)));
    }

    for (const type of TOOL_ORDER) {
      const cfg = getToolConfig(type);
      container.appendChild(this._buildSubheader(TOOL_DEFINITIONS[type].label));
      for (const paramDef of TOOL_FX_SCHEMA[type]) {
        if (paramDef.key === 'gradient') {
          let customRow;
          const selectRow = this._buildSelectRow(paramDef, cfg.gradient, (v) => {
            setToolParam(type, 'gradient', v);
            customRow.style.display = v === 'custom' ? 'flex' : 'none';
          });
          container.appendChild(selectRow);
          customRow = this._buildCustomStopsEditor(cfg.custom_gradient, cfg.gradient === 'custom', (newStops) => {
            setToolParam(type, 'custom_gradient', newStops);
          });
          container.appendChild(customRow);
        } else if (paramDef.type === 'select') {
          container.appendChild(this._buildSelectRow(paramDef, cfg[paramDef.key], (v) => setToolParam(type, paramDef.key, v)));
        } else {
          container.appendChild(this._buildRangeRow(paramDef, cfg[paramDef.key], (v) => setToolParam(type, paramDef.key, v)));
        }
      }
    }

    container.appendChild(this._buildCopyButton());
  }

  // 3 color-picker inputs for a per-element "Eigener" gradient. Kept as a
  // dedicated control (not part of the generic range/select schema loop)
  // since editing color stops isn't expressible as a single input.
  _buildCustomStopsEditor(stops, visible, onChangeStops) {
    const row = document.createElement('div');
    row.className = 'param-row custom-stops-row';
    row.style.display = visible ? 'flex' : 'none';
    const wrap = document.createElement('div');
    wrap.className = 'custom-stops';
    let current = stops;
    stops.forEach((hex, i) => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = hex;
      input.addEventListener('input', () => {
        current = [...current];
        current[i] = input.value;
        onChangeStops(current);
      });
      wrap.appendChild(input);
    });
    row.appendChild(wrap);
    return row;
  }

  _updateSwatchPreview(swatchListEl, stops) {
    const customRow = swatchListEl.querySelector('.scheme-row[data-custom-swatch]');
    if (!customRow) return;
    const swatch = customRow.querySelector('.scheme-swatch');
    swatch.style.background = `linear-gradient(90deg,${stops.join(',')})`;
  }

  _buildSubheader(text) {
    const el = document.createElement('div');
    el.className = 'panel-subheader';
    el.textContent = text;
    return el;
  }

  _buildRangeRow(paramDef, value, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';
    const label = document.createElement('label');
    label.textContent = paramDef.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = paramDef.min;
    input.max = paramDef.max;
    input.step = paramDef.step;
    input.value = value;
    const readout = document.createElement('span');
    readout.className = 'param-value';
    readout.textContent = value;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      readout.textContent = v;
      onChange(v);
    });
    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(readout);
    return row;
  }

  _buildSelectRow(paramDef, value, onChange) {
    const row = document.createElement('div');
    row.className = 'param-row';
    const label = document.createElement('label');
    label.textContent = paramDef.label;
    const select = document.createElement('select');
    for (const opt of paramDef.options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => onChange(select.value));
    row.appendChild(label);
    row.appendChild(select);
    return row;
  }

  _buildSchemeSwatchList(activeKey, customStops, onSelect) {
    const wrap = document.createElement('div');
    wrap.className = 'scheme-list';
    for (const meta of SCHEME_META) {
      const row = document.createElement('div');
      row.className = 'scheme-row' + (meta.key === activeKey ? ' active' : '');
      const isCustom = meta.key === 'custom';
      if (isCustom) row.dataset.customSwatch = 'true';
      const preview = isCustom ? `linear-gradient(90deg,${customStops.join(',')})` : meta.preview;
      row.innerHTML =
        '<span class="scheme-dot"></span>' +
        `<span class="scheme-swatch" style="background:${preview}"></span>` +
        `<span class="scheme-label">${meta.label}</span>`;
      row.addEventListener('click', () => {
        wrap.querySelectorAll('.scheme-row').forEach((r) => r.classList.remove('active'));
        row.classList.add('active');
        onSelect(meta.key);
      });
      wrap.appendChild(row);
    }
    return wrap;
  }

  _buildCopyButton() {
    const btn = document.createElement('button');
    btn.className = 'copy-values-btn';
    btn.textContent = 'Werte kopieren';
    btn.addEventListener('click', async () => {
      const text = serializeForCopy();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Kopiert!';
      } catch {
        btn.textContent = 'Kopieren fehlgeschlagen';
      }
      setTimeout(() => {
        btn.textContent = 'Werte kopieren';
      }, 1500);
    });
    return btn;
  }

  // Lets the player jump directly to any already-reached level. A level
  // is reachable once the one before it has been completed (or it's
  // level 1, or it's already been completed itself — replayable). Levels
  // beyond that stay locked, same progression rule the tool-unlock system
  // already follows.
  buildLevelSelectPanel(levelData, save, currentLevelId, onSelect) {
    const container = this.levelSelectContentEl;
    container.innerHTML = '';
    const maxReachableId = save.completed_levels.length ? Math.max(...save.completed_levels) + 1 : 1;

    levelData.forEach((def, index) => {
      const completed = save.completed_levels.includes(def.id);
      const reachable = def.id <= maxReachableId;
      const isActive = def.id === currentLevelId;

      const row = document.createElement('div');
      row.className = 'level-row' + (isActive ? ' active' : '') + (completed ? ' completed' : '') + (reachable ? '' : ' locked');

      const num = document.createElement('span');
      num.className = 'level-row-num';
      num.textContent = completed ? '✓' : String(def.id);
      row.appendChild(num);

      const name = document.createElement('span');
      name.className = 'level-row-name';
      name.textContent = `${def.id}. ${def.name}`;
      row.appendChild(name);

      if (!reachable) {
        const lock = document.createElement('span');
        lock.className = 'level-row-lock';
        lock.textContent = '🔒';
        row.appendChild(lock);
      } else {
        row.addEventListener('click', () => {
          this.levelSelectPanelEl.classList.add('hidden');
          onSelect(index);
        });
      }

      container.appendChild(row);
    });
  }

  // Consistent layout for every tool (glyph + label + cost, same sizing
  // regardless of label length or lock state) — the glyph's colors are
  // sampled from that tool's own current gradient config, so the palette
  // always matches whatever look the player has customized in the panel.
  buildPalette(level, unlockedTools) {
    this.paletteEl.innerHTML = '';
    for (const type of TOOL_ORDER) {
      const def = TOOL_DEFINITIONS[type];
      const unlocked = unlockedTools.includes(type) && level.def.available_tools.includes(type);
      const icon = document.createElement('div');
      icon.className = 'tool-icon' + (unlocked ? '' : ' locked');

      const cfg = getToolConfig(type);
      const glyph = document.createElement('span');
      glyph.className = 'tool-icon-glyph';
      if (unlocked) {
        const headRgb = sampleGradient(cfg.gradient, 1, cfg.custom_gradient);
        const midRgb = sampleGradient(cfg.gradient, 0.4, cfg.custom_gradient);
        glyph.style.background = `radial-gradient(circle, ${rgbCss(headRgb)}, ${rgbCss(midRgb)} 55%, transparent 75%)`;
      }
      icon.appendChild(glyph);

      const label = document.createElement('span');
      label.className = 'tool-label';
      label.textContent = def.label;
      icon.appendChild(label);

      const cost = document.createElement('span');
      cost.className = 'tool-cost';
      cost.textContent = `${def.cost} EP`;
      icon.appendChild(cost);

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
    this._currentLevel = level;
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

  // Shared by the in-HUD and complete-modal copy buttons — both just need
  // the current level's exact tool placement/params for bug reports and
  // reproduction (see Level.serializeReport in level.js).
  async _copyLevelReport(btn, defaultLabel) {
    if (!this._currentLevel) return;
    const text = this._currentLevel.serializeReport();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Kopiert!';
    } catch {
      btn.textContent = 'Kopieren fehlgeschlagen';
    }
    setTimeout(() => {
      btn.textContent = defaultLabel;
    }, 1500);
  }

  // Stacking (back to front): toolfx-canvas -> gl-canvas (main particles,
  // drawn separately in main.js) -> ui-canvas -> DOM UI. So tool elements
  // and their ambient particles render on the bottom canvas (behind the
  // main particle stream), while level objects (obstacles/emitter/target)
  // and transient interaction feedback (drag ghost, selection handles)
  // render on the top one (in front of the main particle stream).
  render(level, dt) {
    const dpr = getSize().dpr;

    const fxCtx = this.toolFxCtx;
    fxCtx.clearRect(0, 0, this.toolFxCanvas.width, this.toolFxCanvas.height);
    this.toolFx.step(level.activeTools, dt, getToolConfig);
    this._drawToolBoundaries(fxCtx, level, dpr);
    this.toolFx.draw(fxCtx, level.activeTools, dpr, getToolConfig);
    this._drawToolCenters(fxCtx, level, dpr);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);
    drawObstacles(ctx, level.def.obstacles);
    this._drawEmitters(ctx, level.def.emitters);
    this._drawTargets(ctx, level, dt);
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

  _isDraggedInvalid(tool) {
    return (
      this.dragController.state === 'dragging-existing' &&
      this.dragController.draggedToolId === tool.id &&
      !this.dragController.dragValid
    );
  }

  _drawToolBoundaries(ctx, level, dpr) {
    for (const tool of level.activeTools) {
      const p = toPixel(tool.position.x, tool.position.y);
      const isSelected = this.dragController.selectedToolId === tool.id;
      const isInvalid = this._isDraggedInvalid(tool);
      if (tool.type === 'wind_jet') {
        this._drawWindJetBoundary(ctx, tool, p, dpr, isSelected, isInvalid);
      } else {
        this._drawRadialBoundary(ctx, tool, p, dpr, isSelected, isInvalid);
      }
    }
  }

  _drawWindJetBoundary(ctx, tool, p, dpr, isSelected, isInvalid) {
    if (!isSelected && !isInvalid) return; // core beam only shown while selected

    // The reach wedge is intentionally never drawn — it confused more
    // than it helped (the cone is generous and fixed; the ambient
    // particle flow already shows the wind's area). Only the strength/
    // direction beam is shown, and only while selected.
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    const invalidTint = isInvalid ? 'rgba(239, 68, 68, 0.9)' : null;

    // Core beam: length *is* the strength.
    const len = windJetStrengthToHandleLenCss(tool.strength) * dpr;
    const tipX = p.x + Math.cos(dirRad) * len;
    const tipY = p.y + Math.sin(dirRad) * len;
    ctx.strokeStyle = invalidTint || 'rgba(191, 219, 254, 0.45)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    this._drawArrowhead(ctx, tipX, tipY, dirRad, invalidTint || 'rgba(191, 219, 254, 0.6)', 5 * dpr);
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

  _drawRadialBoundary(ctx, tool, p, dpr, isSelected, isInvalid) {
    if (!isSelected && !isInvalid) return; // ring outline only shown while selected

    const r = toPixelLength(tool.radius);
    ctx.strokeStyle = isInvalid ? 'rgba(239, 68, 68, 0.85)' : 'rgba(147, 197, 253, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawToolCenters(ctx, level, dpr) {
    for (const tool of level.activeTools) {
      const p = toPixel(tool.position.x, tool.position.y);
      const isInvalid = this._isDraggedInvalid(tool);
      const glowR = tool.type === 'wind_jet' ? 10 * dpr : Math.max(6 * dpr, toPixelLength(tool.radius) * 0.16);

      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      glow.addColorStop(0, isInvalid ? 'rgba(239, 68, 68, 0.7)' : 'rgba(191, 219, 254, 0.65)');
      glow.addColorStop(1, 'rgba(191, 219, 254, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isInvalid ? 'rgba(239, 68, 68, 0.9)' : '#93C5FD';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
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
