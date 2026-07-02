// Owns one level's full runtime state: particle pool, emitters, placed
// tools, budget, per-target throughput monitors, and the completion state
// machine (RUNNING/HOLDING/COMPLETE, per doc §8.6).

import { ParticlePool, createEmitterRuntime, updateEmitter, integrate, applyLifecycleKill } from './particles.js';
import { accumulateForces, createToolInstance, TOOL_DEFINITIONS } from './tools.js';
import { applyObstacleCollision } from './obstacles.js';
import { ThroughputMonitor } from './throughput.js';

const MAX_PARTICLES = 4096;

export class Level {
  constructor(def) {
    this.def = def;
    this.pool = new ParticlePool(MAX_PARTICLES);
    this.emitterRuntimes = def.emitters.map(() => createEmitterRuntime());
    this.throughputMonitors = def.targets.map(() => new ThroughputMonitor(2.0));

    this.activeTools = [];
    this.budgetUsed = 0;

    this.state = 'RUNNING';
    this.holdTimer = 0;
    this.completed = false;

    this.forceX = new Float32Array(MAX_PARTICLES);
    this.forceY = new Float32Array(MAX_PARTICLES);

    this.lastEfficiencies = def.targets.map(() => 0);
    this.holdProgress = 0;
  }

  get budgetAvailable() {
    return this.def.budget - this.budgetUsed;
  }

  canAfford(type) {
    return TOOL_DEFINITIONS[type].cost <= this.budgetAvailable;
  }

  placeTool(type, position) {
    if (!this.canAfford(type)) return null;
    const tool = createToolInstance(type, position);
    this.budgetUsed += TOOL_DEFINITIONS[type].cost;
    this.activeTools.push(tool);
    return tool;
  }

  removeTool(toolId) {
    const idx = this.activeTools.findIndex((t) => t.id === toolId);
    if (idx === -1) return;
    const tool = this.activeTools[idx];
    this.budgetUsed -= TOOL_DEFINITIONS[tool.type].cost;
    this.activeTools.splice(idx, 1);
  }

  getTool(toolId) {
    return this.activeTools.find((t) => t.id === toolId) || null;
  }

  moveTool(toolId, position) {
    const tool = this.getTool(toolId);
    if (!tool) return;
    tool.position.x = position.x;
    tool.position.y = position.y;
  }

  step(dt, now) {
    const def = this.def;

    for (let e = 0; e < def.emitters.length; e++) {
      updateEmitter(this.pool, def.emitters[e], this.emitterRuntimes[e], def.emitter_rate, def.particle_lifetime, dt);
    }

    accumulateForces(this.pool, this.activeTools, def.ambient_force, this.forceX, this.forceY);
    integrate(this.pool, this.forceX, this.forceY, dt);
    applyLifecycleKill(this.pool);
    applyObstacleCollision(this.pool, def.obstacles);
    this._captureTargets(now);
    this._tickCompletion(dt, now);
  }

  _captureTargets(now) {
    const targets = this.def.targets;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const px = this.pool.px[i];
      const py = this.pool.py[i];
      for (let t = 0; t < targets.length; t++) {
        const target = targets[t];
        const dx = px - target.position.x;
        const dy = py - target.position.y;
        if (dx * dx + dy * dy <= target.radius * target.radius) {
          this.throughputMonitors[t].recordCapture(now);
          this.pool.kill(i);
          break;
        }
      }
    }
  }

  _tickCompletion(dt, now) {
    const completion = this.def.completion;
    const targets = this.def.targets;
    const requiredIds = completion.targets_required;
    // Multi-emitter levels (e.g. "Zwei Quellen") measure efficiency against
    // the combined output of every emitter, not a single emitter's rate.
    const totalEmitterRate = this.def.emitter_rate * this.def.emitters.length;

    let allHeld = true;
    for (let t = 0; t < targets.length; t++) {
      this.throughputMonitors[t].prune(now);
      const efficiency = this.throughputMonitors[t].getEfficiency(totalEmitterRate);
      this.lastEfficiencies[t] = efficiency;
      if (requiredIds.includes(targets[t].id) && efficiency < completion.efficiency_threshold) {
        allHeld = false;
      }
    }

    if (this.state === 'RUNNING') {
      if (allHeld) {
        this.state = 'HOLDING';
        this.holdTimer = 0;
      }
    } else if (this.state === 'HOLDING') {
      if (allHeld) {
        this.holdTimer += dt;
        if (this.holdTimer >= completion.hold_duration_seconds) {
          this.state = 'COMPLETE';
          this.completed = true;
        }
      } else {
        this.state = 'RUNNING';
        this.holdTimer = 0;
      }
    }

    this.holdProgress = Math.min(1, this.holdTimer / completion.hold_duration_seconds);
  }

  // Exact reproduction data for the current placement — what tool, where,
  // and with which params — as JSON matching the {type, position,
  // direction, spreadAngle, strength, radius} shape used by the
  // level-forge pipeline's own scripts, so a reported placement can be
  // pasted directly into a test/verification script.
  serializeReport() {
    const tools = this.activeTools.map((tool) => {
      const entry = {
        type: tool.type,
        position: { x: +tool.position.x.toFixed(4), y: +tool.position.y.toFixed(4) },
      };
      if (tool.type === 'wind_jet') {
        entry.direction = +(tool.params.direction || 0).toFixed(2);
        entry.spreadAngle = +(tool.params.spreadAngle || 0).toFixed(2);
      }
      entry.strength = +tool.strength.toFixed(4);
      entry.radius = +tool.radius.toFixed(4);
      return entry;
    });
    const report = {
      levelId: this.def.id,
      levelName: this.def.name,
      budgetUsed: this.budgetUsed,
      budget: this.def.budget,
      efficiencyThreshold: this.def.completion.efficiency_threshold,
      efficiency: +((this.lastEfficiencies[0] || 0)).toFixed(4),
      state: this.state,
      completed: this.completed,
      tools,
    };
    return JSON.stringify(report, null, 2);
  }
}
