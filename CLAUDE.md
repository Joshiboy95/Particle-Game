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
  the DOM-based UI (palette, budget bar, modals).
- **Tool placement uses a custom Pointer Events drag system** (not the
  native HTML5 Drag-and-Drop API, which has poor touch support and awkward
  canvas-drop-target coordinate handling). One state machine handles
  dragging a new tool from the palette, repositioning an already-placed
  tool, and (once selected) dragging its handles.
- **No properties panel.** Every tunable parameter is edited by dragging
  directly on the selected tool via `js/handles.js`: Wind-Jet has one
  "vector" handle whose position simultaneously encodes direction (angle)
  and strength (distance — its length *is* its strength, its reach/range
  is fixed); Attractor/Repulsor have one "power" handle sitting right on
  the visible ring edge, dragged radially to resize, which derives
  strength from the new radius (`radialStrengthFromRadius` in
  `js/tools.js`). Every tool also has a delete handle. Handle geometry and
  hit-testing must stay in CSS-pixel space (`toCssPixel`/`toCssLength` in
  `js/coords.js`), not normalized game space — a fixed on-screen
  offset/angle decomposed through normalized x/y and re-projected via
  `toPixel` stretches unevenly on a non-square viewport.
- Levels are pure JSON-shaped data (schema in doc §9.1) exported from
  `js/data/levels.js` — adding a level requires no code changes.
- Adding a new tool requires: one force function in `js/tools.js`, one
  `TOOL_DEFINITIONS` entry, one visualization case in `js/ui.js`, and
  cost/unlock data — nothing else in the pipeline changes.
- Game state (progress, unlocked tools) persists to `localStorage` under
  `particle_flow_save` (schema per doc §9.4).
- POC scope: 8 levels in `js/data/levels.js` (all buildable with the 3
  implemented tools — ambient force, multi-emitter, and forge-generated
  corridor levels included; the design doc's levels needing Vortex/
  Deflector/Portal-Paar aren't built yet), 3 tools (Wind-Jet, Attraktor,
  Repulsor). A level-select panel (`☰` button, top-right) lets the player
  jump to any level whose predecessor is completed — same sequential-unlock
  rule as tools.
- `window.__debug` (`js/main.js`) exposes `getLevel()`, `startLevel(index)`,
  and `fastForward(seconds, stepDt)` — a synchronous stepping loop that
  advances a level's simulation without waiting on real time or rendering.
  Kept intentionally (not test-only scaffolding) as the shared foundation
  for both manual playtesting and `tools/level-forge/`.

See `C:\Users\rosen\.claude\plans\frolicking-seeking-sky.md` for the full
file-by-file POC implementation plan (module responsibilities, per-frame
loop order, force formulas, drag/state machines).

## Level authoring

New levels are built trail-first, not maze-first: place 2-3 tools (at least
two distinct types), trace the curved path they naturally produce in an
obstacle-free field, then generate walls that hug that trail — leaving open
only a corridor around it. Curve complexity (bends, tortuosity, tool
diversity) is the deliberate difficulty knob, not hand-authored geometry.

`tools/level-forge/` implements this as a dev-only Node+Playwright pipeline
(its own `package.json`, isolated from the shipped game — nothing under
`js/` ever imports from it):
- `corridor.js` — pure math: grids the field, measures distance from a trail
  polyline, merges blocked cells into `obstacles.js`-compatible AABB rects.
- `trace.js` — drives the running game via `window.__debug` to trace a
  loadout's centerline plus its two emitter-spread edges.
- `validate.js` — loads candidate obstacles against the real emitter/spread,
  runs `fastForward(30)`, and auto-tunes corridor width until the achieved
  efficiency lands in a healthy band (not near-zero, not near-100%).
- `emit.js` — assembles the final `LEVEL_DATA`-shaped object and a
  difficulty report (turning count, tortuosity, corridor tightness).
- `forge.js` — CLI wiring the above end to end: `node forge.js <loadout.js>`.

Run `npm install` once inside `tools/level-forge/` before first use. See
`tools/level-forge/loadouts/level8.js` for a worked example, and
`js/data/levels.js`'s Level 8 entry for the polished, hand-reformatted
result of its raw pipeline output (`tools/level-forge/out/level-8.js`).

## Open decisions (doc §12)

Obstacle collision beyond AABB rects, capture-detection details, and mobile
touch support remain open past the POC — the design doc's recommendations
are the default unless the user says otherwise.

## Working conventions

- UI copy is German, formal (Sie-Form). Code/comments in English.
- Dark mode only, no light theme.
- No build tooling — plain files, edit-and-refresh dev loop.
