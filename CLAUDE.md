# Particle Flow — CLAUDE.md

## Project status

Pre-implementation. The repo currently contains only the design document
[PARTICLE_FLOW_GAME.md](PARTICLE_FLOW_GAME.md) — no game code exists yet.
That document is the single source of truth for scope, mechanics, and
architecture; read it before implementing anything.

## What this is

Particle Flow is a browser-based physics puzzle game. The player places
gravity-like tools (Wind-Jet, Attraktor, Repulsor, Vortex, Deflector,
Portal-Paar) into a continuously running GPGPU particle simulation to route
a particle stream from an emitter to a target zone under a per-level energy
budget.

## Planned architecture (per the design doc)

- Single-file HTML deliverable (`particle-flow.html`), no external
  dependencies, target size ~1 MB.
- WebGL2 GPGPU ping-pong simulation (position/velocity + metadata textures)
  for particle physics; a separate Canvas2D overlay for tool visuals and UI.
- Levels are pure JSON data (schema in doc §9) — adding a level requires no
  code changes, only new `LEVEL_DATA` entries.
- Adding a new tool requires: a GLSL `applyTool_XYZ` function + switch case,
  a `TOOL_DEFINITIONS` entry, a `renderToolVisual` case, and cost/unlock
  JSON — nothing else in the pipeline changes.
- Game state (progress, unlocked tools) persists to `localStorage` under
  `particle_flow_save`.
- POC scope: 3 levels (free flow, wall, L-obstacle), 3 tools (Wind-Jet,
  Attraktor, Repulsor), 65,536 particles (256×256 texture), 60 FPS target.

## Open decisions (doc §12)

The design doc flags several unresolved implementation choices with
recommendations (obstacle rendering: WebGL vs Canvas2D; capture detection:
GPU readback vs Transform Feedback; tool config UI: hover overlay vs panel;
sound; mobile support). Confirm with the user before locking these in if
they matter for the task at hand — the doc's stated recommendation is the
default otherwise.

## Working conventions

- UI copy is German, formal (Sie-Form).
- Dark mode only, no light theme.
- No build tooling planned — keep the single-file structure unless the user
  says otherwise.
