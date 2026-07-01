// Normalized (0..1) game-space <-> device-pixel conversion, shared by
// physics, WebGL rendering, the Canvas2D overlay, and drag hit-testing.
// The game field is always the full canvas — there is no camera/zoom.

const state = {
  cssWidth: 0,
  cssHeight: 0,
  width: 0,   // device pixels
  height: 0,  // device pixels
  dpr: 1,
};

const resizeListeners = [];

export function initCoords(canvases) {
  const resize = () => {
    state.dpr = window.devicePixelRatio || 1;
    state.cssWidth = window.innerWidth;
    state.cssHeight = window.innerHeight;
    state.width = Math.round(state.cssWidth * state.dpr);
    state.height = Math.round(state.cssHeight * state.dpr);

    for (const canvas of canvases) {
      canvas.width = state.width;
      canvas.height = state.height;
      canvas.style.width = state.cssWidth + 'px';
      canvas.style.height = state.cssHeight + 'px';
    }

    for (const cb of resizeListeners) cb(getSize());
  };

  window.addEventListener('resize', resize);
  resize();
}

export function onResize(cb) {
  resizeListeners.push(cb);
}

export function getSize() {
  return { ...state };
}

// normalized (0..1, origin top-left) -> device pixels
export function toPixel(nx, ny) {
  return { x: nx * state.width, y: ny * state.height };
}

// device pixels -> normalized (0..1)
export function toNorm(px, py) {
  return { x: px / state.width, y: py / state.height };
}

// CSS pixels (e.g. from a pointer event's clientX/clientY) -> normalized
export function clientToNorm(clientX, clientY, canvasEl) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

// scalar normalized length (e.g. a radius) -> device pixels, using the
// smaller of width/height so radii read consistently regardless of aspect
export function toPixelLength(nLen) {
  return nLen * Math.min(state.width, state.height);
}

// normalized -> CSS pixels (the frame pointer events' clientX/clientY use,
// given the canvas fills the viewport from (0,0)). CSS pixels are square,
// so this is the right space for UI decorations whose on-screen distance
// from a point must be isotropic (e.g. a handle sitting "46px away" in
// every direction) — unlike toPixel, which scales x/y independently and
// would turn a fixed offset into an ellipse on a non-square viewport.
export function toCssPixel(nx, ny) {
  return { x: nx * state.cssWidth, y: ny * state.cssHeight };
}

// CSS pixels -> device pixels (the canvas drawing-buffer space toPixel
// uses), for rendering something computed in toCssPixel's space.
export function cssToDevicePixel(cssX, cssY) {
  return { x: cssX * state.dpr, y: cssY * state.dpr };
}
