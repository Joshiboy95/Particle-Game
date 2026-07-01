// WebGL1 context + shader helpers, and the particle point-cloud renderer.
// This is the only thing drawn on the GL canvas — everything else (UI,
// obstacles, tool visuals) is drawn on the Canvas2D overlay in ui.js.

export function initGL(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL nicht verfügbar');
  gl.clearColor(10 / 255, 12 / 255, 16 / 255, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive glow
  return gl;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader-Kompilierung fehlgeschlagen: ' + log);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Programm-Verknüpfung fehlgeschlagen: ' + log);
  }
  return program;
}

const VS = `
  attribute vec2 a_pos;   // normalized 0..1, y-down
  attribute float a_alpha;
  uniform float u_pointSize;
  varying float v_alpha;
  void main() {
    vec2 clip = vec2(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = u_pointSize;
    v_alpha = a_alpha;
  }
`;

const FS = `
  precision mediump float;
  varying float v_alpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float dist = length(d);
    if (dist > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, dist);
    gl_FragColor = vec4(0.75, 0.85, 1.0, glow * v_alpha);
  }
`;

// floats per vertex: x, y, alpha
const STRIDE_FLOATS = 3;

export class ParticleRenderer {
  constructor(gl, maxParticles) {
    this.gl = gl;
    this.maxParticles = maxParticles;
    this.program = createProgram(gl, VS, FS);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, maxParticles * STRIDE_FLOATS * 4, gl.DYNAMIC_DRAW);

    this.a_pos = gl.getAttribLocation(this.program, 'a_pos');
    this.a_alpha = gl.getAttribLocation(this.program, 'a_alpha');
    this.u_pointSize = gl.getUniformLocation(this.program, 'u_pointSize');

    this.scratch = new Float32Array(maxParticles * STRIDE_FLOATS);
  }

  // pool: a particles.js ParticlePool (SoA: px, py, age, maxAge, count).
  // Reads straight from its typed arrays — no per-particle object churn.
  draw(pool, dpr) {
    const gl = this.gl;
    const n = Math.min(pool.count, this.maxParticles);
    const data = this.scratch;
    const { px, py, age, maxAge } = pool;
    for (let i = 0; i < n; i++) {
      data[i * STRIDE_FLOATS] = px[i];
      data[i * STRIDE_FLOATS + 1] = py[i];
      // fade in briefly at birth, fade out over the last 20% of lifetime
      const lifeFrac = age[i] / maxAge[i];
      const fadeIn = Math.min(1, age[i] / 0.2);
      const fadeOut = Math.min(1, (1 - lifeFrac) / 0.2);
      data[i * STRIDE_FLOATS + 2] = Math.max(0, Math.min(fadeIn, fadeOut));
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) return;

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, n * STRIDE_FLOATS));

    const stride = STRIDE_FLOATS * 4;
    gl.enableVertexAttribArray(this.a_pos);
    gl.vertexAttribPointer(this.a_pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.a_alpha);
    gl.vertexAttribPointer(this.a_alpha, 1, gl.FLOAT, false, stride, 8);

    gl.uniform1f(this.u_pointSize, 3.0 * (dpr || 1));
    gl.drawArrays(gl.POINTS, 0, n);
  }

  setViewport(width, height) {
    this.gl.viewport(0, 0, width, height);
  }
}
