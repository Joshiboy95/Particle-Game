// Positions for the small interactive handles shown on a *selected* tool
// (rotate handle for directional tools, delete handle for all tools).
// Shared by ui.js (drawing) and drag.js (hit-testing) so they can never
// drift out of sync with each other.
//
// Computed in CSS-pixel space (same frame as pointer events' clientX/Y),
// not normalized game space — a fixed screen offset like "46px away" must
// stay isotropic regardless of the field's aspect ratio, which normalized
// space (scaled independently per axis by toPixel) can't guarantee.

import { toCssPixel } from './coords.js';

const DELETE_OFFSET_CSS = 34; // fixed screen distance, independent of tool.radius
const ROTATE_OFFSET_CSS = 46;
export const HANDLE_HIT_CSS = 16; // tap/click tolerance radius around a handle

const DELETE_ANGLE = -Math.PI * 0.75; // up-left of the tool center

// Returns { delete: {x,y}, rotate?: {x,y} } in CSS-pixel space.
export function getHandlePositionsCss(tool) {
  const center = toCssPixel(tool.position.x, tool.position.y);
  const handles = {
    delete: {
      x: center.x + Math.cos(DELETE_ANGLE) * DELETE_OFFSET_CSS,
      y: center.y + Math.sin(DELETE_ANGLE) * DELETE_OFFSET_CSS,
    },
  };

  if (tool.type === 'wind_jet') {
    const dirRad = (tool.params.direction || 0) * Math.PI / 180;
    handles.rotate = {
      x: center.x + Math.cos(dirRad) * ROTATE_OFFSET_CSS,
      y: center.y + Math.sin(dirRad) * ROTATE_OFFSET_CSS,
    };
  }

  return handles;
}

// Returns 'delete' | 'rotate' | null — which handle (if any) the pointer
// event position (clientX, clientY) is within tap tolerance of.
export function hitTestHandles(tool, clientX, clientY) {
  const handles = getHandlePositionsCss(tool);
  for (const key of Object.keys(handles)) {
    const h = handles[key];
    const dx = h.x - clientX;
    const dy = h.y - clientY;
    if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_HIT_CSS) return key;
  }
  return null;
}
