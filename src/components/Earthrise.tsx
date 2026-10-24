import {useEffect, useRef} from 'react';
import {hero} from '../content';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {clamp, easeOutCubic, lerp, pinProgress, range, seeded} from '../lib/math';
import {PlanetRenderer} from '../gl/planet';
import {fitCanvas} from '../lib/globe';
import {onFrame} from '../lib/scroll';

/**
 * The Earthrise, from real imagery. The Earth is NASA's Blue Marble (with
 * city lights on the night side and drifting clouds) on a WebGL sphere; the
 * horizon is the limb of the real Moon, textured with the LRO mosaic around
 * the Sea of Tranquillity. Stars sit on a canvas behind, the backlit
 * foreground ridge, astronaut and lens dust on a canvas in front. One
 * scroll range moves each layer at its own rate:
 *
 *   0.00 – 0.18  a veil of cosmic dust drifts off the lens
 *   0.04 – 0.50  the Earth climbs out from behind the horizon
 *   0.08 – 0.52  EARTHRISE resolves, then yields to the captions
 *   0.30 – 0.60  the near ground, crater field and astronaut rise into frame
 *   0.72 – 1.00  everything tilts away upward and the ground swallows the
 *                frame to black, which is where the page continues
 *
 * Letterbox bars close in while the "film" plays and open again on exit.
 */

const STAGE_VH = 460;

type Ridge = {pts: number[]; base: number; amp: number; top: string; bottom: string};
type Crater = {x: number; y: number; r: number};
type Star = {x: number; y: number; r: number; a: number; tw: number};
type Mote = {x: number; y: number; r: number; s: number; a: number};

function makeRidge(rand: () => number, base: number, amp: number, rough: number, top: string, bottom: string): Ridge {
  const n = 160;
  const phases = [rand() * 6, rand() * 6, rand() * 6, rand() * 6];
  const pts = Array.from({length: n + 1}, (_, i) => {
    const x = i / n;
    return (
      Math.sin(x * 3.1 + phases[0]) * 0.5 +
      Math.sin(x * 7.3 + phases[1]) * 0.25 +
      Math.sin(x * 17.9 + phases[2]) * 0.12 * rough +
      Math.sin(x * 41.7 + phases[3]) * 0.05 * rough
    );
  });
  return {pts, base, amp, top, bottom};
}

export function Earthrise() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLParagraphElement>(null);
  const elevRef = useRef<HTMLSpanElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const sceneRefs = useRef<HTMLDivElement[]>([]);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const a = fitCanvas(canvasRef.current!);
    const b = fitCanvas(frontRef.current!);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const front = frontRef.current!;
    const fctx = front.getContext('2d')!;
    let planets: PlanetRenderer | null = null;
    try {
      planets = new PlanetRenderer(glRef.current!, ['earth', 'night', 'clouds', 'moonPatch']);
    } catch {
      // No WebGL: the stars, ridge and astronaut still play.
    }
    const rand = seeded(11);
    const stars: Star[] = Array.from({length: 260}, () => ({x: rand(), y: rand() * 0.8, r: 0.3 + rand() * 1.2, a: 0.25 + rand() * 0.75, tw: rand() * 6}));
    const motes: Mote[] = Array.from({length: 150}, () => ({x: rand(), y: rand(), r: 0.4 + rand() * 1.6, s: 0.3 + rand(), a: 0.2 + rand() * 0.6}));
    // The near ridge is backlit by the Earth: almost a silhouette.
    const near = makeRidge(rand, 0.86, 0.04, 1.4, '#1a1c22', '#05070c');
    const craters: Crater[] = Array.from({length: 26}, () => ({x: rand(), y: 0.06 + rand() * 0.3, r: 0.008 + Math.pow(rand(), 2) * 0.06}));
    let lastTime = 0;
    let spin = 0;

    const ridge = (rg: Ridge, w: number, h: number, yOff: number) => {
      const baseY = rg.base * h + yOff;
      fctx.beginPath();
      fctx.moveTo(0, h + 2);
      rg.pts.forEach((v, i) => fctx.lineTo((i / (rg.pts.length - 1)) * w, baseY - v * rg.amp * h));
      fctx.lineTo(w, h + 2);
      fctx.closePath();
      const g = fctx.createLinearGradient(0, baseY - rg.amp * h, 0, baseY + h * 0.25);
      g.addColorStop(0, rg.top);
      g.addColorStop(1, rg.bottom);
      fctx.fillStyle = g;
      fctx.fill();
      // Earthshine catching the crest.
      fctx.strokeStyle = 'rgba(140,180,240,0.18)';
      fctx.lineWidth = 1;
      fctx.stroke();
      return baseY;
    };

    const astronaut = (x: number, y: number, s: number) => {
      // A suited figure on a rock, back-lit by the Earth. Units: s = suit height.
      fctx.save();
      fctx.translate(x, y);
      fctx.fillStyle = '#07080c';
      // Rock.
      fctx.beginPath();
      fctx.moveTo(-s * 0.9, 0);
      fctx.quadraticCurveTo(-s * 0.7, -s * 0.28, -s * 0.2, -s * 0.3);
      fctx.quadraticCurveTo(s * 0.5, -s * 0.34, s * 0.95, 0);
      fctx.closePath();
      fctx.fill();
      fctx.translate(0, -s * 0.3);
      // Legs.
      fctx.fillRect(-s * 0.14, -s * 0.38, s * 0.11, s * 0.38);
      fctx.fillRect(s * 0.03, -s * 0.38, s * 0.11, s * 0.38);
      // Torso + life-support pack.
      fctx.beginPath();
      fctx.roundRect(-s * 0.18, -s * 0.78, s * 0.36, s * 0.44, s * 0.06);
      fctx.fill();
      fctx.beginPath();
      fctx.roundRect(-s * 0.3, -s * 0.8, s * 0.16, s * 0.36, s * 0.03);
      fctx.fill();
      // Helmet.
      fctx.beginPath();
      fctx.arc(s * 0.02, -s * 0.9, s * 0.13, 0, Math.PI * 2);
      fctx.fill();
      // Arm raised toward home.
      fctx.save();
      fctx.translate(s * 0.15, -s * 0.72);
      fctx.rotate(-0.9);
      fctx.fillRect(0, -s * 0.045, s * 0.34, s * 0.09);
      fctx.restore();
      // Rim light from the Earth (up-right).
      fctx.strokeStyle = 'rgba(140,190,255,0.55)';
      fctx.lineWidth = Math.max(1, s * 0.012);
      fctx.beginPath();
      fctx.arc(s * 0.02, -s * 0.9, s * 0.13, -1.6, 0.2);
      fctx.stroke();
      // Visor glint.
      fctx.fillStyle = 'rgba(242,230,201,0.7)';
      fctx.beginPath();
      fctx.ellipse(s * 0.08, -s * 0.92, s * 0.04, s * 0.025, -0.5, 0, Math.PI * 2);
      fctx.fill();
      fctx.restore();
      // Flag pole + flag.
      fctx.save();
      fctx.translate(x - s * 0.62, y - s * 0.22);
      fctx.fillStyle = '#07080c';
      fctx.fillRect(0, -s * 1.15, s * 0.025, s * 1.15);
      fctx.fillStyle = 'rgba(201,204,211,0.22)';
      fctx.fillRect(s * 0.025, -s * 1.12, s * 0.42, s * 0.26);
      fctx.restore();
    };

    const stop = onFrame((time) => {
      const dt = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      const root = rootRef.current;
      if (!root) return;
      const {p, rect} = pinProgress(root);
      if (rect.bottom < 0) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = canvas.width / Math.max(1, w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const exit = range(p, 0.72, 1);
      const settle = easeOutCubic(range(p, 0, 0.5));
      const veil = 1 - range(p, 0, 0.18);
      const rise = easeOutCubic(range(p, 0.04, 0.5));
      const midIn = easeOutCubic(range(p, 0.18, 0.55));
      const groundIn = easeOutCubic(range(p, 0.3, 0.6));
      const portrait = h > w;

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#020308');
      sky.addColorStop(0.7, '#070a14');
      sky.addColorStop(1, '#0b0f18');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#e8eef8';
      const skyShift = -p * 0.08 * h;
      for (const s of stars) {
        const tw = reducedRef.current ? 1 : 0.7 + 0.3 * Math.sin(time / 900 + s.tw);
        ctx.globalAlpha = s.a * tw;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h + skyShift, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // The Earth, climbing out from behind the lunar limb; then the Moon
      // itself, a sphere so large only the top of its limb is on screen.
      if (!reducedRef.current) spin += dt * 4;
      const R = Math.min(w, h) * (portrait ? 0.24 : 0.17) * lerp(0.9, 1, rise);
      const horizon = h * 0.64 + lerp(h * 0.09, 0, settle) - exit * h * 0.3;
      const ex = w * (portrait ? 0.5 : 0.62);
      const ey = lerp(horizon + R * 1.1, horizon - R * 1.45, rise) - exit * h * 0.12;
      // Sunlight from the left and a little behind, as in Apollo 8's photograph.
      const sun: [number, number, number] = [-0.85, 0.2, 0.35];
      if (planets) {
        planets.begin();
        planets.draw({cx: ex, cy: ey, r: R, rotate: [-20 - spin, -12, -8], texture: 'earth', sun, ambient: 0.015, clouds: true, cloudShift: spin / 900});
        const RM = Math.max(w, h) * (portrait ? 2.6 : 1.9);
        planets.draw({cx: w * 0.5, cy: horizon + RM, r: RM, rotate: [-23.5 - p * 6, 68, 0], texture: 'moonPatch', sun, ambient: 0.1, exposure: 0.95});
      }

      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, w, h);
      // A thin haze line along the limb.
      const haze = fctx.createLinearGradient(0, horizon - 6, 0, horizon + 30);
      haze.addColorStop(0, 'rgba(5,7,12,0)');
      haze.addColorStop(0.3, 'rgba(5,7,12,0.25)');
      haze.addColorStop(1, 'rgba(5,7,12,0)');
      fctx.fillStyle = haze;
      fctx.fillRect(0, horizon - 6, w, 36);
      // Shade the lower frame so the foreground reads as close and dark.
      const shadeG = fctx.createLinearGradient(0, horizon, 0, h);
      shadeG.addColorStop(0, 'rgba(5,7,12,0)');
      shadeG.addColorStop(1, `rgba(5,7,12,${0.35 + midIn * 0.3})`);
      fctx.fillStyle = shadeG;
      fctx.fillRect(0, horizon, w, h - horizon);

      const nearY = ridge(near, w, h, lerp(h * 0.36, 0, groundIn) - exit * h * 0.78);
      // The ground carries a black apron, so when it climbs it fills the screen.
      fctx.fillStyle = '#05070c';
      fctx.fillRect(0, nearY + h * 0.3, w, h * 1.2);

      for (const c of craters) {
        const cx = c.x * w;
        const cy = nearY + c.y * h;
        const rx = c.r * Math.max(w, h);
        const ry = rx * 0.32;
        fctx.fillStyle = 'rgba(0,0,0,0.5)';
        fctx.beginPath();
        fctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        fctx.fill();
        fctx.strokeStyle = 'rgba(140,180,240,0.1)';
        fctx.lineWidth = 1;
        fctx.beginPath();
        fctx.ellipse(cx, cy + ry * 0.15, rx, ry, 0, 0.1, Math.PI - 0.1);
        fctx.stroke();
      }

      const suit = Math.min(w, h) * (portrait ? 0.2 : 0.16);
      astronaut(w * (portrait ? 0.26 : 0.22), nearY + h * 0.07, suit);

      // Dust on the lens.
      if (veil > 0.001) {
        fctx.fillStyle = '#dfe6f2';
        for (const m of motes) {
          if (!reducedRef.current) {
            m.x += 0.006 * m.s * dt;
            m.y -= 0.004 * m.s * dt;
            if (m.x > 1) m.x -= 1;
            if (m.y < 0) m.y += 1;
          }
          fctx.globalAlpha = m.a * veil;
          fctx.beginPath();
          fctx.arc(m.x * w, (m.y - p * 0.6) * h, m.r * (1 + p * 4), 0, Math.PI * 2);
          fctx.fill();
        }
        fctx.globalAlpha = 1;
      }

      // DOM overlays.
      const veilEl = veilRef.current!;
      veilEl.style.opacity = String(veil);
      veilEl.style.transform = `translate3d(0, ${-range(p, 0, 0.18) * 24}vh, 0) scale(${1 + range(p, 0, 0.18) * 0.25})`;
      veilEl.style.visibility = veil < 0.001 ? 'hidden' : '';

      const tIn = easeOutCubic(range(p, 0.08, 0.24));
      const tOut = range(p, 0.34, 0.42);
      const title = titleRef.current!;
      title.style.opacity = String(tIn * (1 - tOut));
      title.style.letterSpacing = `${lerp(0.6, 0.24, tIn)}em`;
      title.style.transform = `translate3d(0, ${-p * 6}vh, 0)`;
      title.style.filter = tIn < 0.99 ? `blur(${(1 - tIn) * 10}px)` : '';

      hero.scenes.forEach((s, i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const o = range(p, s.at - 0.04, s.at) * (1 - range(p, s.at + 0.12, s.at + 0.16));
        el.style.opacity = String(i === 0 ? o * (1 - tIn) : o);
        el.style.transform = `translate3d(0, ${(1 - o) * 10}px, 0)`;
      });

      // Letterbox: closes in as the film starts, opens on the way out.
      const bar = range(p, 0.02, 0.15) * (1 - range(p, 0.82, 0.98));
      barsRef.current.forEach((b) => (b.style.transform = `scaleY(${bar})`));

      hudRef.current!.style.opacity = String(range(p, 0.02, 0.1) * (1 - range(p, 0.62, 0.72)));
      const secs = 102 * 3600 + 45 * 60 + p * 5400; // Eagle landed at T+102:45.
      clockRef.current!.textContent = `T+ ${String(Math.floor(secs / 3600)).padStart(3, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
      elevRef.current!.textContent = `${clamp(rise * 12.4, 0, 99).toFixed(1)}°`;
    });
    // The GL context is kept: StrictMode remounts onto the same canvas.
    return stop;
  }, []);

  return (
    <section id="top" ref={rootRef} aria-label="Earthrise" className="relative" style={{height: `${STAGE_VH}svh`}}>
      <div className="sticky top-0 h-screen-s overflow-hidden bg-void">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />
        <canvas ref={glRef} aria-hidden="true" className="absolute inset-0 size-full" />
        <canvas ref={frontRef} aria-hidden="true" className="absolute inset-0 size-full" />

        <div ref={titleRef} className="pointer-events-none absolute inset-x-0 top-[22%] text-center md:top-[24%]" style={{opacity: 0}}>
          <h1 className="font-display text-hero text-white [text-shadow:0_4px_40px_rgb(0_0_0/0.5)]" style={{marginRight: '-0.24em'}}>
            {hero.title}
          </h1>
          <p className="mt-4 font-mono text-label text-regolith/80 uppercase">{hero.kicker}</p>
        </div>

        {/* Subtitles. */}
        {hero.scenes.map((s, i) => (
          <div
            key={s.label}
            ref={(el) => {
              if (el) sceneRefs.current[i] = el;
            }}
            className="pointer-events-none absolute inset-x-4 bottom-[16%] text-center"
            style={{opacity: 0}}
          >
            <p className="font-mono text-label text-earth uppercase">{s.label}</p>
            <p className="mx-auto mt-2 max-w-[34ch] text-[clamp(1rem,1.6vw,1.375rem)] leading-snug text-white [text-shadow:0_2px_20px_rgb(0_0_0/0.8)]">{s.line}</p>
          </div>
        ))}

        <div
          ref={veilRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 30% 40%, rgba(170,184,210,0.55), transparent 70%), radial-gradient(50% 60% at 75% 60%, rgba(120,140,180,0.5), transparent 70%), radial-gradient(80% 80% at 50% 50%, rgba(20,26,40,0.85), rgba(5,7,12,0.95))',
          }}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center">
            <p className="font-mono text-label text-regolith/80 uppercase">{hero.kicker}</p>
            <p className="mt-3 font-display text-[0.8125rem] tracking-[0.5em] text-white/90 uppercase" style={{marginRight: '-0.5em'}}>
              {hero.veil}
            </p>
            <span aria-hidden="true" className="mt-6 inline-block animate-bounce text-regolith/70 motion-reduce:animate-none">
              ↓
            </span>
          </div>
        </div>

        {/* Letterbox bars. */}
        {['top-0 origin-top', 'bottom-0 origin-bottom'].map((pos, i) => (
          <div
            key={pos}
            ref={(el) => {
              if (el) barsRef.current[i] = el;
            }}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 h-[7svh] bg-black ${pos}`}
            style={{transform: 'scaleY(0)'}}
          />
        ))}

        <div ref={hudRef} aria-hidden="true" className="pointer-events-none absolute inset-4 font-mono text-[0.625rem] tracking-[0.14em] text-regolith/75 uppercase sm:inset-6 md:text-label" style={{opacity: 0}}>
          <div className="brackets absolute inset-0 text-regolith/40" />
          <div className="absolute top-16 left-3 space-y-1 md:top-20 md:left-4">
            <p ref={clockRef}>T+ 102:45:00</p>
            <p className="text-regolith/50">Mission clock</p>
          </div>
          <div className="absolute top-16 right-3 space-y-1 text-right md:top-20 md:right-4">
            <p>
              Earth elev <span ref={elevRef} className="text-earth">0.0°</span>
            </p>
            <p className="text-regolith/50">Above horizon</p>
          </div>
          <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4">{hero.site}</div>
          <div className="absolute right-3 bottom-3 flex items-center gap-2 md:right-4 md:bottom-4">
            Scroll <span className="inline-block animate-bounce motion-reduce:animate-none">↓</span>
          </div>
        </div>
      </div>
    </section>
  );
}
