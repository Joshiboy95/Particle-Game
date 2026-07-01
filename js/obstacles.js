// Obstacle collision (POC: AABB rects only, per doc §2.4 "Solid Wall") and
// Canvas2D rendering. All coordinates are normalized (0..1), matching the
// level JSON schema in doc §9.1.

import { toPixel, getSize } from './coords.js';

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

// Dark glass-panel look with a soft blue containment glow — matches the
// game's dark/glow visual language instead of a flat filled box.
export function drawObstacles(ctx, obstacles) {
  const dpr = getSize().dpr;
  for (const obstacle of obstacles) {
    if (obstacle.type !== 'rect') continue;
    const topLeft = toPixel(obstacle.x, obstacle.y);
    const bottomRight = toPixel(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;

    ctx.save();
    ctx.shadowColor = 'rgba(96, 165, 250, 0.35)';
    ctx.shadowBlur = 14 * dpr;
    const fill = ctx.createLinearGradient(topLeft.x, topLeft.y, topLeft.x, topLeft.y + h);
    fill.addColorStop(0, '#242A3D');
    fill.addColorStop(1, '#161A26');
    ctx.fillStyle = fill;
    ctx.fillRect(topLeft.x, topLeft.y, w, h);
    ctx.restore();

    // Crisp glowing edge.
    ctx.strokeStyle = 'rgba(148, 180, 255, 0.55)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeRect(topLeft.x + 0.75 * dpr, topLeft.y + 0.75 * dpr, w - 1.5 * dpr, h - 1.5 * dpr);

    // Subtle top highlight for a beveled, glass-like feel.
    ctx.strokeStyle = 'rgba(226, 232, 255, 0.25)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y + 0.5 * dpr);
    ctx.lineTo(topLeft.x + w, topLeft.y + 0.5 * dpr);
    ctx.stroke();
  }
}
