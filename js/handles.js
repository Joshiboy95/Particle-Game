// Positions for the small interactive handles shown on a *selected* tool.
// Every tool gets a delete handle; Wind-Jet gets a "vector" handle whose
// position simultaneously encodes direction (angle) and strength
// (distance); Attractor/Repulsor get a "power" handle sitting right on
// the visible ring edge, whose distance from center sets the radius (and,
// derived from that, the strength). Shared by ui.js (drawing) and drag.js
// (hit-testing) so they can never drift out of sync with each other.
//
// Computed in CSS-pixel space (same frame as pointer events' clientX/Y),
// not normalized game space — a fixed screen offset/angle must stay
// isotropic regardless of the field's aspect ratio, which normalized
// space (scaled independently per axis by toPixel) can't guarantee.

import { toCssPixel, toCssLength } from './coords.js';
import { windJetStrengthToHandleLenCss } from './tools.js';

const DELETE_OFFSET_CSS = 34; // fixed screen distance, independent of tool.radius/strength
export const HANDLE_HIT_CSS = 16; // tap/click tolerance radius around a handle

const DELETE_ANGLE = -Math.PI * 0.75; // up-left of the tool center
const RADIAL_HANDLE_ANGLE = 0; // fixed reference direction for the power handle

// Returns { delete: {x,y}, vector?: {x,y}, power?: {x,y} } in CSS-pixel space.
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
    const lenCss = windJetStrengthToHandleLenCss(tool.strength);
    handles.vector = {
      x: center.x + Math.cos(dirRad) * lenCss,
      y: center.y + Math.sin(dirRad) * lenCss,
    };
  } else if (tool.type === 'attractor' || tool.type === 'repulsor') {
    const lenCss = toCssLength(tool.radius);
    handles.power = {
      x: center.x + Math.cos(RADIAL_HANDLE_ANGLE) * lenCss,
      y: center.y + Math.sin(RADIAL_HANDLE_ANGLE) * lenCss,
    };
  }

  return handles;
}

// Returns 'delete' | 'vector' | 'power' | null — which handle (if any) the
// pointer event position (clientX, clientY) is within tap tolerance of.
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
