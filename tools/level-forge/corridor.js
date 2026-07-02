// Pure math: turns one or more traced polylines (a centerline trail plus
// optional edge-spread trails) into a set of AABB "kill" rects that hug the
// trail(s), leaving only a corridor of the given half-width open. No browser
// dependency — safe to unit-test with a plain `node corridor.js`.

// Minimum distance from point (px,py) to segment (ax,ay)-(bx,by).
function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Minimum distance from a point to the nearest segment across any polyline.
function minDistToPolylines(px, py, polylines) {
  let best = Infinity;
  for (const line of polylines) {
    for (let i = 0; i < line.length - 1; i++) {
      const d = distPointToSegment(px, py, line[i].x, line[i].y, line[i + 1].x, line[i + 1].y);
      if (d < best) best = d;
    }
  }
  return best;
}

// Rasterizes the 0..1 x 0..1 field into an N x N grid, marks each cell
// blocked/safe, and returns the raw boolean mask plus geometry helpers.
function buildBlockedMask({ trails, gridResolution = 60, corridorHalfWidth = 0.05, forceOpen = [], borderMargin = 1 }) {
  const N = gridResolution;
  const cellSize = 1 / N;
  const blocked = [];
  for (let row = 0; row < N; row++) {
    const rowArr = new Array(N).fill(false);
    blocked.push(rowArr);
  }

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      // Border margin stays open so the level edges aren't walled off.
      if (row < borderMargin || col < borderMargin || row >= N - borderMargin || col >= N - borderMargin) continue;

      const cx = (col + 0.5) * cellSize;
      const cy = (row + 0.5) * cellSize;

      let safe = minDistToPolylines(cx, cy, trails) <= corridorHalfWidth;
      if (!safe) {
        for (const zone of forceOpen) {
          if (Math.hypot(cx - zone.x, cy - zone.y) <= zone.radius) { safe = true; break; }
        }
      }
      blocked[row][col] = !safe;
    }
  }

  return { blocked, N, cellSize };
}

// Histogram-merge: per row, find maximal contiguous blocked-column runs;
// merge vertically-adjacent rows sharing an identical column span into one
// taller rect. Not a minimal rectangle cover, just a compact one — cheap
// enough for obstacles.js's per-rect Canvas2D draw and small enough to stay
// readable as level data.
function mergeBlockedCellsToRects(blocked, N, cellSize) {
  // Stage A: per-row runs -> {row, colStart, colEnd}
  const runs = [];
  for (let row = 0; row < N; row++) {
    let col = 0;
    while (col < N) {
      if (!blocked[row][col]) { col++; continue; }
      const start = col;
      while (col < N && blocked[row][col]) col++;
      runs.push({ row, colStart: start, colEnd: col - 1, merged: false });
    }
  }

  // Stage B: merge vertically. Group runs by row for lookup.
  const runsByRow = new Map();
  for (const r of runs) {
    if (!runsByRow.has(r.row)) runsByRow.set(r.row, []);
    runsByRow.get(r.row).push(r);
  }

  const rects = [];
  for (const r of runs) {
    if (r.merged) continue;
    let rowEnd = r.row;
    // Extend downward while the next row has an identical unmerged run.
    for (let nextRow = r.row + 1; runsByRow.has(nextRow); nextRow++) {
      const candidate = runsByRow.get(nextRow).find(
        (c) => !c.merged && c.colStart === r.colStart && c.colEnd === r.colEnd
      );
      if (!candidate) break;
      candidate.merged = true;
      rowEnd = nextRow;
    }
    r.merged = true;
    rects.push({
      x: r.colStart * cellSize,
      y: r.row * cellSize,
      width: (r.colEnd - r.colStart + 1) * cellSize,
      height: (rowEnd - r.row + 1) * cellSize,
    });
  }
  return rects;
}

// Main entry point: trails -> obstacle rect list matching obstacles.js's
// {type:'rect', x, y, width, height, behavior:'kill'} schema.
function buildCorridorObstacles({ trails, gridResolution = 60, corridorHalfWidth = 0.05, forceOpen = [], borderMargin = 1 }) {
  const { blocked, N, cellSize } = buildBlockedMask({ trails, gridResolution, corridorHalfWidth, forceOpen, borderMargin });
  const rects = mergeBlockedCellsToRects(blocked, N, cellSize);
  return rects.map((r) => ({ type: 'rect', x: +r.x.toFixed(4), y: +r.y.toFixed(4), width: +r.width.toFixed(4), height: +r.height.toFixed(4), behavior: 'kill' }));
}

// --- Trail-geometry difficulty metrics (stage 6) ---

function pathLength(trail) {
  let len = 0;
  for (let i = 0; i < trail.length - 1; i++) {
    len += Math.hypot(trail[i + 1].x - trail[i].x, trail[i + 1].y - trail[i].y);
  }
  return len;
}

// Counts local sign changes in heading angle along the trail, ignoring
// jitter below `noiseThresholdRad`.
function turningCount(trail, noiseThresholdRad = 0.05) {
  if (trail.length < 3) return 0;
  const headings = [];
  for (let i = 0; i < trail.length - 1; i++) {
    headings.push(Math.atan2(trail[i + 1].y - trail[i].y, trail[i + 1].x - trail[i].x));
  }
  let count = 0;
  let lastSign = 0;
  for (let i = 1; i < headings.length; i++) {
    let dh = headings[i] - headings[i - 1];
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    if (Math.abs(dh) < noiseThresholdRad) continue;
    const sign = Math.sign(dh);
    if (lastSign !== 0 && sign !== lastSign) count++;
    lastSign = sign;
  }
  return count;
}

function tortuosity(trail) {
  if (trail.length < 2) return 1;
  const straight = Math.hypot(trail[trail.length - 1].x - trail[0].x, trail[trail.length - 1].y - trail[0].y);
  if (straight === 0) return Infinity;
  return pathLength(trail) / straight;
}

// --- Exhaustive N-segment straight-path checker ---
//
// A tool that only steers velocity toward a fixed target vector (Wind-Jet)
// can only ever produce ONE straight segment; a combo of K such tools can
// produce at most a (K+1)-vertex polyline (K "elbows"). This is a hard,
// unconditional guarantee, unlike an adversarial physics search: if NO
// straight polyline with `elbowCount` elbows can get from start to target
// without crossing an obstacle, then no combination of `elbowCount`
// steering-only tools can either, regardless of how they're tuned. Used to
// prove (not just empirically test) that a hairpin/backtrack corridor
// genuinely requires more tools than a naive straight-line count suggests —
// see js/data/levels.js's Level 10 for the level this was built for.
function anyStraightPathExists({ start, target, obstacles, elbowCount = 1, gridN = 60, segmentSamples = 200 }) {
  function pointBlocked(px, py) {
    for (const o of obstacles) {
      if (px >= o.x && px <= o.x + o.width && py >= o.y && py <= o.y + o.height) return true;
    }
    return false;
  }
  function segmentClear(a, b) {
    for (let i = 0; i <= segmentSamples; i++) {
      const t = i / segmentSamples;
      if (pointBlocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }
  // Recursive search over elbow positions on a gridN x gridN grid.
  function search(from, remainingElbows) {
    if (remainingElbows === 0) return segmentClear(from, target) ? [] : null;
    for (let i = 0; i <= gridN; i++) {
      for (let j = 0; j <= gridN; j++) {
        const elbow = { x: i / gridN, y: j / gridN };
        if (!segmentClear(from, elbow)) continue;
        const rest = search(elbow, remainingElbows - 1);
        if (rest) return [elbow, ...rest];
      }
    }
    return null;
  }
  const elbows = search(start, elbowCount);
  return { exists: !!elbows, elbows };
}

module.exports = {
  distPointToSegment,
  minDistToPolylines,
  buildBlockedMask,
  mergeBlockedCellsToRects,
  buildCorridorObstacles,
  pathLength,
  turningCount,
  tortuosity,
  anyStraightPathExists,
};
