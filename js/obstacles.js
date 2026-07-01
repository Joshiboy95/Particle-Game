// Obstacle collision (POC: AABB rects only, per doc §2.4 "Solid Wall") and
// Canvas2D rendering. All coordinates are normalized (0..1), matching the
// level JSON schema in doc §9.1.

import { toPixel } from './coords.js';

function pointInRect(px, py, obstacle) {
  return (
    px >= obstacle.x &&
    px <= obstacle.x + obstacle.width &&
    py >= obstacle.y &&
    py <= obstacle.y + obstacle.height
  );
}

export function isPointBlocked(px, py, obstacles) {
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'rect') continue;
    if (pointInRect(px, py, obstacle)) return true;
  }
  return false;
}

// Kills particles that collided with a "kill" obstacle. Iterates backwards
// so pool's swap-remove doesn't skip the particle swapped into this slot.
export function applyObstacleCollision(pool, obstacles) {
  for (let i = pool.count - 1; i >= 0; i--) {
    const px = pool.px[i];
    const py = pool.py[i];
    for (const obstacle of obstacles) {
      if (obstacle.type !== 'rect') continue; // POC: only rect/kill supported
      if (pointInRect(px, py, obstacle)) {
        pool.kill(i);
        break;
      }
    }
  }
}

export function drawObstacles(ctx, obstacles) {
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'rect') continue;
    const topLeft = toPixel(obstacle.x, obstacle.y);
    const bottomRight = toPixel(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;

    ctx.fillStyle = '#1E2230';
    ctx.strokeStyle = 'rgba(148, 180, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(topLeft.x, topLeft.y, w, h);
    ctx.strokeRect(topLeft.x, topLeft.y, w, h);
  }
}
