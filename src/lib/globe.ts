import {geoGraticule10, geoPath, type GeoProjection} from 'd3-geo';
import type {Feature, Geometry} from 'geojson';
import {borders, land} from './world';

const graticule = geoGraticule10();
const SPHERE = {type: 'Sphere'} as const;

type GlobeOptions = {
  /** Country features to paint in their own colour, keyed by ISO id. */
  highlight?: {feature: Feature<Geometry>; fill: string}[];
  /** 0 = flat lighting, 1 = deep night side (the terminator). */
  shade?: number;
  /** Angle of the sunlight, radians; 0 = from the left. */
  sunAngle?: number;
  glow?: number;
};

/**
 * Paints an orthographic Earth from real Natural Earth outlines: ocean,
 * graticule, land, borders, highlighted countries, then the terminator
 * and atmosphere as gradients over the disc.
 */
export function drawGlobe(ctx: CanvasRenderingContext2D, projection: GeoProjection, opts: GlobeOptions = {}) {
  const {highlight = [], shade = 0.55, sunAngle = 0, glow = 1} = opts;
  const path = geoPath(projection, ctx);
  const [cx, cy] = projection.translate();
  const r = projection.scale();

  // Atmosphere halo.
  if (glow > 0) {
    const halo = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.28);
    halo.addColorStop(0, `rgba(111,182,255,${0.45 * glow})`);
    halo.addColorStop(0.35, `rgba(111,182,255,${0.12 * glow})`);
    halo.addColorStop(1, 'rgba(111,182,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ocean.
  const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  ocean.addColorStop(0, '#1d4f8c');
  ocean.addColorStop(0.7, '#0f2f5c');
  ocean.addColorStop(1, '#081a36');
  ctx.beginPath();
  path(SPHERE);
  ctx.fillStyle = ocean;
  ctx.fill();

  ctx.beginPath();
  path(graticule);
  ctx.strokeStyle = 'rgba(160,200,255,0.09)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.beginPath();
  path(land);
  ctx.fillStyle = '#5f7f6a';
  ctx.fill();

  for (const h of highlight) {
    ctx.beginPath();
    path(h.feature);
    ctx.fillStyle = h.fill;
    ctx.fill();
  }

  if (r > 120) {
    ctx.beginPath();
    path(borders);
    ctx.strokeStyle = 'rgba(10,20,30,0.45)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Terminator: light from one side, night on the other.
  if (shade > 0) {
    const dx = Math.cos(sunAngle) * r;
    const dy = Math.sin(sunAngle) * r;
    const night = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    night.addColorStop(0, 'rgba(2,4,10,0)');
    night.addColorStop(0.45, `rgba(2,4,10,${0.15 * shade})`);
    night.addColorStop(0.62, `rgba(2,4,10,${0.85 * shade})`);
    night.addColorStop(1, `rgba(2,4,10,${0.97 * shade})`);
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = night;
    ctx.fill();
  }

  // Limb: a thin bright rim of atmosphere.
  ctx.beginPath();
  path(SPHERE);
  const rim = ctx.createRadialGradient(cx, cy, r * 0.86, cx, cy, r);
  rim.addColorStop(0, 'rgba(140,200,255,0)');
  rim.addColorStop(1, 'rgba(140,200,255,0.35)');
  ctx.fillStyle = rim;
  ctx.fill();
}

/** Keeps a canvas' backing store matched to its CSS size × DPR (capped at 2). */
export function fitCanvas(canvas: HTMLCanvasElement): () => void {
  const sync = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  };
  sync();
  const ro = new ResizeObserver(sync);
  ro.observe(canvas);
  return () => ro.disconnect();
}

/**
 * Country outlines over a photographic globe: faint borders everywhere,
 * tinted fills and crisp edges for the highlighted countries.
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, projection: GeoProjection, highlight: {feature: Feature<Geometry>; fill: string; stroke: string}[]) {
  const path = geoPath(projection, ctx);
  ctx.beginPath();
  path(borders);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  for (const h of highlight) {
    ctx.beginPath();
    path(h.feature);
    ctx.fillStyle = h.fill;
    ctx.fill();
    ctx.strokeStyle = h.stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}
