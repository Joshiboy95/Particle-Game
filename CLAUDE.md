# Particle Flow — CLAUDE.md

## Project status

POC implementation in progress. [PARTICLE_FLOW_GAME.md](PARTICLE_FLOW_GAME.md)
is the design source of truth for game mechanics, tools, levels, and data
schemas — read it before touching game logic. This file (and the plan at
the time of writing) is the source of truth for the actual technical
architecture, which deviates from that doc's original single-file/GPGPU
sketch (see "Architecture decisions" below).

## How to run it

Because the code is native ES modules (`<script type="module">`), opening
`index.html` directly via `file://` **will not work** — browsers block
cross-origin module loading from the `file:` scheme (you'll see a CORS
error in the console and a blank/stuck page). Serve the repo root with any
static webserver instead, e.g.:

```
python -m http.server 8000
```

then open `http://localhost:8000/` in the browser. GitHub Pages, `npx serve`,
or any other static host works the same way — the only requirement is
"http(s), not file(s)".

## What this is

Particle Flow is a browser-based physics puzzle game. The player places
gravity-like tools (Wind-Jet, Attraktor, Repulsor, Vortex, Deflector,
Portal-Paar) into a continuously running particle simulation to route a
particle stream from an emitter to a target zone under a per-level energy
budget.

## Architecture decisions

- **Not a single HTML file.** Multiple static files (HTML/CSS/JS) are fine —
  the only hard constraint is that it runs with **no build/compile step and
  no server-side runtime**: plain static files served by any static
  webserver (`python -m http.server`, GitHub Pages, nginx, etc.).
- **Plain vanilla JS, native ES modules** (`<script type="module">`), no
  bundler, no npm dependencies, no TypeScript. Code is split into small
  modules under `js/` instead of one giant file (see file layout below).
- **Physics is CPU-side**, not GPU compute. Particle state lives in typed
  arrays (`Float32Array` for position/velocity/lifetime); forces and
  collisions are plain JS functions. Steady-state particle counts for this
  game are tiny (~2,000 alive at once even on the busiest level), and the
  sibling project `Particle-Website/particle-flow-v5.html` proves CPU-side
  physics comfortably handles 200k+ particles at 60fps on the same target
  hardware — so GPU ping-pong compute shaders would add real complexity
  (float-texture precision, framebuffer completeness across drivers) for
  headroom this game will not need.
- **Rendering is split**: WebGL1 draws only the particle point-cloud
  (performance-critical, additive-blended, dynamic VBO uploaded per frame —
  adapted from the sibling project's proven canvas/DPR/shader-compile
  pattern). A transparent Canvas2D overlay on top draws everything else:
  obstacles, emitter, target circle, tool force-field visuals, and hosts
  the DOM-based UI (palette, budget bar, modals, popovers).
- **Tool placement uses a custom Pointer Events drag system** (not the
  native HTML5 Drag-and-Drop API, which has poor touch support and awkward
  canvas-drop-target coordinate handling). One state machine handles both
  dragging a new tool from the palette and repositioning an already-placed
  tool.
- Levels are pure JSON-shaped data (schema in doc §9.1) exported from
  `js/data/levels.js` — adding a level requires no code changes.
- Adding a new tool requires: one force function in `js/tools.js`, one
  `TOOL_DEFINITIONS` entry, one visualization case in `js/ui.js`, and
  cost/unlock data — nothing else in the pipeline changes.
- Game state (progress, unlocked tools) persists to `localStorage` under
  `particle_flow_save` (schema per doc §9.4).
- POC scope: 3 levels (free flow, wall, L-obstacle), 3 tools (Wind-Jet,
  Attraktor, Repulsor).

See `C:\Users\rosen\.claude\plans\frolicking-seeking-sky.md` for the full
file-by-file POC implementation plan (module responsibilities, per-frame
loop order, force formulas, drag/state machines).

## Open decisions (doc §12)

Obstacle collision beyond AABB rects, capture-detection details, and mobile
touch support remain open past the POC — the design doc's recommendations
are the default unless the user says otherwise.

## Working conventions

- UI copy is German, formal (Sie-Form). Code/comments in English.
- Dark mode only, no light theme.
- No build tooling — plain files, edit-and-refresh dev loop.
