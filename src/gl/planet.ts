/**
 * Real planets on a WebGL sphere. Each sphere is one screen-aligned quad;
 * the fragment shader casts the pixel onto an orthographic sphere, undoes
 * the rotation with exactly the maths d3-geo's `rotate([λ, φ, γ])` uses
 * (so SVG/canvas overlays drawn with a d3 projection stay registered), and
 * samples an equirectangular NASA photo mosaic.
 *
 * Textures (public domain): NASA Blue Marble, NASA Black Marble city
 * lights, and the LRO colour mosaic of the Moon — see public/textures/.
 */

const VERT = `
attribute vec2 a;
uniform vec4 u_box; // x, y, w, h in clip space
varying vec2 v;
void main() {
  v = a;
  gl_Position = vec4(u_box.xy + (a * 0.5 + 0.5) * u_box.zw, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v;              // -pad..pad across the quad, in sphere radii
uniform float u_pad;
uniform vec3 u_rot;          // λ, φ, γ in radians (d3 convention)
uniform vec4 u_bounds;       // lon0, lon1, lat0(top), lat1(bottom) of the day texture, radians
uniform sampler2D u_day;
uniform sampler2D u_night;
uniform sampler2D u_clouds;
uniform float u_hasNight;
uniform float u_clouds_on;
uniform float u_cloudShift;
uniform float u_cloudAlpha;
uniform vec3 u_sun;          // view space: x right, y up, z toward the viewer
uniform float u_ambient;
uniform float u_atmos;       // 0 for the Moon
uniform float u_exposure;

const float PI = 3.14159265;

vec2 lonlat(vec3 n) {
  // Rotated frame (d3): X toward viewer, Y right, Z up.
  float X = n.z, Y = n.x, Z = n.y;
  float cp = cos(u_rot.y), sp = sin(u_rot.y), cg = cos(u_rot.z), sg = sin(u_rot.z);
  float k = Z * cg - Y * sg;
  float Y2 = Y * cg + Z * sg;
  float X2 = X * cp + k * sp;
  float Z2 = k * cp - X * sp;
  float lon = atan(Y2, X2) - u_rot.x;
  lon = mod(lon + PI, 2.0 * PI) - PI;
  return vec2(lon, asin(clamp(Z2, -1.0, 1.0)));
}

void main() {
  vec2 p = v * u_pad;
  float r2 = dot(p, p);
  vec3 sun = normalize(u_sun);

  if (r2 > 1.0) {
    // Atmosphere halo outside the disc, brighter on the sunlit side.
    if (u_atmos <= 0.0) discard;
    float d = sqrt(r2) - 1.0;
    float lit = clamp(dot(normalize(vec3(p, 0.0)), sun) * 0.7 + 0.45, 0.0, 1.0);
    float a = pow(clamp(1.0 - d / (u_pad - 1.0), 0.0, 1.0), 3.0) * 0.55 * u_atmos * lit;
    gl_FragColor = vec4(vec3(0.42, 0.68, 1.0) * a, a);
    return;
  }

  vec3 n = vec3(p, sqrt(1.0 - r2));
  vec2 ll = lonlat(n);
  vec2 uv = vec2((ll.x - u_bounds.x) / (u_bounds.y - u_bounds.x), (u_bounds.z - ll.y) / (u_bounds.z - u_bounds.w));
  vec3 day = texture2D(u_day, clamp(uv, 0.0, 1.0)).rgb;
  // Outside a cropped texture, fade to the crop's average grey.
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  day = mix(vec3(0.42), day, inside);

  float ndl = dot(n, sun);
  float light = smoothstep(-0.08, 0.35, ndl);
  vec3 col = day * (u_ambient + (1.0 - u_ambient) * light * (0.55 + 0.45 * max(ndl, 0.0)));

  if (u_clouds_on > 0.5) {
    vec2 cuv = vec2(fract((ll.x + PI) / (2.0 * PI) + u_cloudShift), (PI * 0.5 - ll.y) / PI);
    float c = texture2D(u_clouds, cuv).r;
    col = mix(col, vec3(light * 0.95 + u_ambient), c * u_cloudAlpha);
  }
  if (u_hasNight > 0.5) {
    vec3 city = texture2D(u_night, uv).rgb;
    col += city * city * 1.6 * (1.0 - smoothstep(-0.15, 0.1, ndl));
  }
  if (u_atmos > 0.0) {
    float rim = pow(1.0 - n.z, 2.5);
    col = mix(col, vec3(0.45, 0.7, 1.0) * (0.25 + light), rim * 0.6 * u_atmos);
  }
  // Soft limb darkening keeps the edge from looking pasted on.
  col *= mix(0.78, 1.0, smoothstep(0.0, 0.35, n.z)) * u_exposure;
  gl_FragColor = vec4(col, 1.0);
}`;

export type SphereDraw = {
  /** Centre and radius in CSS pixels. */
  cx: number;
  cy: number;
  r: number;
  /** d3-style rotation in degrees. */
  rotate: [number, number, number?];
  texture: 'earth' | 'moon' | 'moonPatch';
  sun?: [number, number, number];
  ambient?: number;
  atmosphere?: number;
  clouds?: boolean;
  cloudShift?: number;
  cloudAlpha?: number;
  exposure?: number;
};

const TEXTURES = {
  earth: {src: 'textures/earth-day.jpg', bounds: [-180, 180, 90, -90]},
  moon: {src: 'textures/moon.jpg', bounds: [-180, 180, 90, -90]},
  // A full-resolution crop of the 16k LRO mosaic around the Sea of Tranquillity.
  moonPatch: {src: 'textures/moon-tranquility.jpg', bounds: [-20, 80, 45, -45]},
  night: {src: 'textures/earth-night.jpg', bounds: [-180, 180, 90, -90]},
  clouds: {src: 'textures/earth-clouds.jpg', bounds: [-180, 180, 90, -90]},
} as const;
type TexName = keyof typeof TEXTURES;

const rad = (d: number) => (d * Math.PI) / 180;
const BASE = import.meta.env.BASE_URL;

// Images are decoded once and shared by every renderer on the page.
const images = new Map<TexName, Promise<HTMLImageElement>>();
function loadImage(name: TexName) {
  let p = images.get(name);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = BASE + TEXTURES[name].src;
    });
    images.set(name, p);
  }
  return p;
}

export class PlanetRenderer {
  readonly gl: WebGLRenderingContext;
  private tex = new Map<TexName, WebGLTexture>();
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private blank: WebGLTexture;

  constructor(readonly canvas: HTMLCanvasElement, need: TexName[], onReady?: () => void) {
    const gl = canvas.getContext('webgl', {premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false});
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const u of ['u_box', 'u_pad', 'u_rot', 'u_bounds', 'u_day', 'u_night', 'u_clouds', 'u_hasNight', 'u_clouds_on', 'u_cloudShift', 'u_cloudAlpha', 'u_sun', 'u_ambient', 'u_atmos', 'u_exposure']) {
      this.loc[u] = gl.getUniformLocation(prog, u);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.blank = this.upload(null);
    Promise.all(need.map((n) => loadImage(n).then((img) => this.tex.set(n, this.upload(img)))))
      .then(() => onReady?.())
      .catch(() => {});
  }

  private upload(img: HTMLImageElement | null) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([100, 100, 100]));
    // Non-power-of-two safe in WebGL1: clamp, no mipmaps.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  ready(name: TexName) {
    return this.tex.has(name);
  }

  /** Matches the backing store to CSS size × DPR and clears. Returns the CSS size. */
  begin() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {w: c.clientWidth, h: c.clientHeight};
  }

  draw(d: SphereDraw) {
    if (!this.tex.has(d.texture)) return;
    const gl = this.gl;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const atmos = d.atmosphere ?? (d.texture === 'earth' ? 1 : 0);
    const pad = atmos > 0 ? 1.22 : 1.0;
    const half = d.r * pad;
    // Quad in clip space.
    const x0 = ((d.cx - half) / W) * 2 - 1;
    const y0 = 1 - ((d.cy + half) / H) * 2;
    gl.uniform4f(this.loc.u_box, x0, y0, ((half * 2) / W) * 2, ((half * 2) / H) * 2);
    gl.uniform1f(this.loc.u_pad, pad);
    const [l, p, g = 0] = d.rotate;
    gl.uniform3f(this.loc.u_rot, rad(l), rad(p), rad(g));
    const b = TEXTURES[d.texture].bounds;
    gl.uniform4f(this.loc.u_bounds, rad(b[0]), rad(b[1]), rad(b[2]), rad(b[3]));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.get(d.texture)!);
    gl.uniform1i(this.loc.u_day, 0);
    const night = d.texture === 'earth' && this.tex.has('night');
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, night ? this.tex.get('night')! : this.blank);
    gl.uniform1i(this.loc.u_night, 1);
    const clouds = !!d.clouds && this.tex.has('clouds');
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, clouds ? this.tex.get('clouds')! : this.blank);
    gl.uniform1i(this.loc.u_clouds, 2);
    gl.uniform1f(this.loc.u_hasNight, night ? 1 : 0);
    gl.uniform1f(this.loc.u_clouds_on, clouds ? 1 : 0);
    gl.uniform1f(this.loc.u_cloudShift, d.cloudShift ?? 0);
    gl.uniform1f(this.loc.u_cloudAlpha, d.cloudAlpha ?? 0.9);
    const s = d.sun ?? [0, 0, 1];
    gl.uniform3f(this.loc.u_sun, s[0], s[1], s[2]);
    gl.uniform1f(this.loc.u_ambient, d.ambient ?? 0.04);
    gl.uniform1f(this.loc.u_atmos, atmos);
    gl.uniform1f(this.loc.u_exposure, d.exposure ?? 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** Renders one sphere to a PNG data URL, for places that want a still (the SVG trajectory). */
export function snapshot(d: Omit<SphereDraw, 'cx' | 'cy'>, size: number, need: TexName[]): Promise<string> {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.style.cssText = `position:fixed;left:-9999px;top:0;width:${size}px;height:${size}px`;
    document.body.appendChild(c);
    let r: PlanetRenderer;
    try {
      r = new PlanetRenderer(c, need, () => {
        r.begin();
        r.draw({...d, cx: size / 2, cy: size / 2});
        const url = c.toDataURL('image/png');
        r.dispose();
        c.remove();
        resolve(url);
      });
    } catch {
      c.remove();
    }
  });
}
