import {geoContains, geoDistance, geoOrthographic} from 'd3-geo';
import {useCallback, useEffect, useRef, useState} from 'react';
import {expedition, owner, projects, type Project} from '../content';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {clamp, easeInOutCubic, lerp} from '../lib/math';
import {PlanetRenderer} from '../gl/planet';
import {drawGlobe, drawOverlay, fitCanvas} from '../lib/globe';
import {onFrame, scrollToHash, setScrollLocked} from '../lib/scroll';
import {byIso, countries} from '../lib/world';

/**
 * The game. The Eagle hangs fixed at the centre of the screen; you steer the
 * real Earth underneath it. Each of the 19 beacons sits on a real city in
 * the country that holds a project. Line the reticle up, touch down, and
 * the project's dossier opens.
 *
 * Fuel: steering burns it, every landing refuels, and an empty tank drops
 * you to reserve thrust (still flyable — you can never get stuck). Every
 * frame is written straight to the canvas from refs; React state only
 * changes when something you can read changes (country underneath, a
 * landing, the dossier).
 */

const FUEL_MAX = 100;
const FUEL_PER_DEG = 0.11;
const REFUEL = 35;
const LAND_RADIUS = 0.09; // radians (~5°) around a beacon that counts as on target
const FLY_SECONDS = 1.8;
const ZOOM_SECONDS = 0.9;

type Flight = {from: [number, number]; to: [number, number]; t: number; then: number};

const features = projects.map((p) => byIso.get(p.iso)!);

/** Shortest-way longitude difference, so autopilot never flies the long way round. */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function Expedition() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fuelRef = useRef<HTMLSpanElement>(null);
  const fuelBarRef = useRef<HTMLSpanElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const [engaged, setEngaged] = useState(false);
  const [over, setOver] = useState<string>('Open ocean');
  const [target, setTarget] = useState<number | null>(null);
  const [visited, setVisited] = useState<Set<number>>(() => new Set());
  const [dossier, setDossier] = useState<number | null>(null);
  const [reserve, setReserve] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // Mutable flight state, read and written every frame.
  const sim = useRef({
    rot: [-78, -18] as [number, number], // [λ, φ] rotation; the centre is [-λ, -φ]
    vel: [0, 0] as [number, number],
    keys: new Set<string>(),
    drag: null as null | {x: number; y: number; t: number},
    flight: null as Flight | null,
    zoom: 1,
    zoomTo: 1,
    fuel: FUEL_MAX,
    landing: -1,
    idle: 0,
    started: 0,
    elapsed: 0,
    engaged: false,
    dossierOpen: false,
    target: null as number | null,
  });

  const land = useCallback((i: number) => {
    const s = sim.current;
    if (s.landing >= 0 || s.dossierOpen) return;
    s.landing = i;
    s.vel = [0, 0];
    s.zoomTo = 2.4;
    const p = projects[i];
    s.flight = {from: [...s.rot], to: [-p.site[0], -p.site[1]], t: 0, then: -1};
  }, []);

  const fly = useCallback(
    (i: number) => {
      const s = sim.current;
      if (s.dossierOpen) {
        s.dossierOpen = false;
        setDossier(null);
        s.zoomTo = 1;
      }
      if (!s.started) s.started = performance.now();
      const p = projects[i];
      s.landing = -1;
      s.vel = [0, 0];
      s.flight = {from: [...s.rot], to: [-p.site[0], -p.site[1]], t: 0, then: i};
      setListOpen(false);
    },
    [],
  );

  const liftOff = useCallback(() => {
    const s = sim.current;
    s.dossierOpen = false;
    s.landing = -1;
    s.zoomTo = 1;
    s.vel = [40, 0];
    setDossier(null);
  }, []);

  const nextBeacon = useCallback(() => {
    const s = sim.current;
    const centre: [number, number] = [-s.rot[0], -s.rot[1]];
    let best = -1;
    let bestD = Infinity;
    projects.forEach((p, i) => {
      if (visitedRef.current.has(i) || i === dossierRef.current) return;
      const d = geoDistance(centre, p.site);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) fly(best);
    else liftOff();
  }, [fly, liftOff]);

  const visitedRef = useRef(visited);
  visitedRef.current = visited;
  const dossierRef = useRef(dossier);
  dossierRef.current = dossier;

  const engage = useCallback((on: boolean) => {
    sim.current.engaged = on;
    setEngaged(on);
    if (!on) {
      setScrollLocked(false);
      return;
    }
    if (!sim.current.started) sim.current.started = performance.now();
    canvasRef.current?.focus({preventScroll: true});
    // Frame the globe exactly before freezing the page around it.
    scrollToHash('#expedition', () => {
      if (sim.current.engaged) setScrollLocked(true);
    });
  }, []);

  // Release the controls if the component unmounts mid-flight.
  useEffect(() => () => setScrollLocked(false), []);

  // "Fly there" from the manifest below.
  useEffect(() => {
    const onFly = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      scrollToHash('#expedition', () => fly(i));
    };
    window.addEventListener('tb:fly', onFly);
    return () => window.removeEventListener('tb:fly', onFly);
  }, [fly]);

  // Keyboard.
  useEffect(() => {
    const STEER = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S'];
    const down = (e: KeyboardEvent) => {
      const s = sim.current;
      if (!s.engaged) return;
      if (e.key === 'Escape') {
        if (s.dossierOpen) liftOff();
        else engage(false);
        e.preventDefault();
        return;
      }
      if (s.dossierOpen) return;
      if (STEER.includes(e.key)) {
        s.keys.add(e.key.toLowerCase());
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (s.target !== null) land(s.target);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => sim.current.keys.delete(e.key.toLowerCase());
    const blur = () => sim.current.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [engage, land, liftOff]);

  useEffect(() => fitCanvas(canvasRef.current!), []);

  // Pointer steering: drag the planet.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const s = sim.current;
    const k = () => 0.28 / s.zoom;
    const onDown = (e: PointerEvent) => {
      if (s.dossierOpen || s.landing >= 0) return;
      s.drag = {x: e.clientX, y: e.clientY, t: performance.now()};
      s.flight = null;
      if (!s.started) s.started = performance.now();
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!s.drag) return;
      const now = performance.now();
      const dx = e.clientX - s.drag.x;
      const dy = e.clientY - s.drag.y;
      const thrust = s.fuel > 0 ? 1 : 0.35;
      const dl = dx * k() * thrust;
      const dp = -dy * k() * thrust;
      s.rot[0] += dl;
      s.rot[1] = clamp(s.rot[1] + dp, -80, 80);
      s.fuel = Math.max(0, s.fuel - Math.hypot(dl, dp) * FUEL_PER_DEG);
      const dt = Math.max(16, now - s.drag.t) / 1000;
      s.vel = [clamp(dl / dt, -400, 400), clamp(dp / dt, -400, 400)];
      s.drag = {x: e.clientX, y: e.clientY, t: now};
      s.idle = 0;
    };
    const onUp = () => {
      s.drag = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // The flight loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const projection = geoOrthographic().clipAngle(90);
    const s = sim.current;
    let planets: PlanetRenderer | null = null;
    try {
      planets = new PlanetRenderer(glRef.current!, ['earth', 'night', 'clouds']);
    } catch {
      // No WebGL: fall back to the vector globe below.
    }
    let lastTime = 0;
    let frame = 0;
    let lastOver = '';
    let lastTarget: number | null = null;
    let lastReserve = false;

    return onFrame((time) => {
      const dt = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 1 / 60;
      lastTime = time;
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      frame++;

      // --- Input → motion.
      if (s.flight) {
        const f = s.flight;
        f.t = Math.min(1, f.t + dt / (reducedRef.current ? 0.01 : f.then >= 0 ? FLY_SECONDS : ZOOM_SECONDS));
        const e = easeInOutCubic(f.t);
        s.rot = [f.from[0] + wrap(f.to[0] - f.from[0]) * e, lerp(f.from[1], f.to[1], e)];
        if (f.t >= 1) {
          s.flight = null;
          if (f.then >= 0) {
            land(f.then);
          } else if (s.landing >= 0) {
            // Touchdown.
            const i = s.landing;
            s.dossierOpen = true;
            s.fuel = Math.min(FUEL_MAX, s.fuel + REFUEL);
            setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
            setDossier(i);
          }
        }
      } else if (s.landing < 0 && !s.dossierOpen && !s.drag) {
        const ax = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0);
        const ay = (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0) - (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0);
        const thrust = (s.fuel > 0 ? 1 : 0.35) * 110 / s.zoom;
        // Steering right flies east: the planet turns the other way.
        s.vel[0] -= ax * thrust * dt;
        s.vel[1] -= ay * thrust * dt;
        if (ax || ay) s.idle = 0;
        const damp = Math.pow(0.12, dt);
        s.vel = [s.vel[0] * damp, s.vel[1] * damp];
        const dl = s.vel[0] * dt;
        const dp = s.vel[1] * dt;
        if (ax || ay) s.fuel = Math.max(0, s.fuel - Math.hypot(dl, dp) * FUEL_PER_DEG);
        s.rot[0] += dl;
        s.rot[1] = clamp(s.rot[1] + dp, -80, 80);
        s.idle += dt;
        // A slow drift when nobody's flying, so the planet feels alive.
        if (!s.engaged && s.idle > 2 && !reducedRef.current) s.rot[0] += dt * 3;
      }
      s.zoom = lerp(s.zoom, s.zoomTo, 1 - Math.pow(0.02, dt));
      if (s.started && visitedRef.current.size < projects.length) s.elapsed = (performance.now() - s.started) / 1000;

      // --- Draw.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = canvas.width / Math.max(1, w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // On wide screens the planet sits right of the briefing, clear of the destination list.
      const wide = w >= 1024;
      const R = Math.min(w, h) * (w < 768 ? 0.4 : wide ? 0.34 : 0.36) * s.zoom;
      const cx = wide ? w * 0.54 : w / 2;
      const cy = h / 2;
      projection.scale(R).translate([cx, cy]).rotate([s.rot[0], s.rot[1], 0]);

      const visitedSet = visitedRef.current;
      if (planets?.ready('earth')) {
        // The real planet: NASA Blue Marble, lit from just over your shoulder.
        planets.begin();
        planets.draw({cx, cy, r: R, rotate: [s.rot[0], s.rot[1], 0], texture: 'earth', sun: [-0.35, 0.45, 0.82], ambient: 0.05, clouds: true, cloudShift: time / 4e6, cloudAlpha: 0.45, exposure: 1.08});
        drawOverlay(
          ctx,
          projection,
          features.map((f, i) => ({
            feature: f,
            fill: visitedSet.has(i) ? 'rgba(242,230,201,0.32)' : i === s.target ? 'rgba(111,182,255,0.42)' : 'rgba(111,182,255,0.14)',
            stroke: visitedSet.has(i) ? 'rgba(242,230,201,0.95)' : i === s.target ? 'rgba(170,215,255,1)' : 'rgba(111,182,255,0.7)',
          })),
        );
      } else {
        drawGlobe(ctx, projection, {
          shade: 0,
          highlight: features.map((f, i) => ({
            feature: f,
            fill: visitedSet.has(i) ? 'rgba(242,230,201,0.85)' : i === s.target ? 'rgba(111,182,255,0.95)' : 'rgba(111,182,255,0.55)',
          })),
        });
      }

      // Beacons.
      const centre: [number, number] = [-s.rot[0], -s.rot[1]];
      const pulse = reducedRef.current ? 0.5 : (Math.sin(time / 300) + 1) / 2;
      projects.forEach((p, i) => {
        if (geoDistance(centre, p.site) > Math.PI / 2 - 0.05) return;
        const pt = projection(p.site);
        if (!pt) return;
        const done = visitedSet.has(i);
        ctx.fillStyle = done ? '#f2e6c9' : '#ffffff';
        ctx.globalAlpha = 0.25 + 0.25 * (1 - pulse);
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 6 + pulse * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (s.zoom > 1.6 || i === s.target) {
          ctx.font = '500 11px "IBM Plex Mono", monospace';
          ctx.fillStyle = done ? 'rgba(242,230,201,0.9)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(`${p.flag} ${p.title.toUpperCase()}`, pt[0] + 10, pt[1] - 8);
        }
      });

      // The Eagle and its reticle, fixed at screen centre.
      const onTarget = s.target !== null;
      ctx.strokeStyle = onTarget ? '#f2e6c9' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      const rr = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (rr + 4), cy + Math.sin(a) * (rr + 4));
        ctx.lineTo(cx + Math.cos(a) * (rr + 12), cy + Math.sin(a) * (rr + 12));
        ctx.stroke();
      }
      // Lander: a squat body on four legs, tilting with velocity.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(clamp(-s.vel[0] / 400, -0.35, 0.35));
      const ls = 1 / Math.max(1, s.zoom * 0.7);
      ctx.scale(ls, ls);
      ctx.fillStyle = '#e8e2cf';
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(7, -4);
      ctx.lineTo(9, 3);
      ctx.lineTo(-9, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9aa0ab';
      ctx.fillRect(-5, -10, 10, 6);
      ctx.strokeStyle = '#e8e2cf';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-8, 3);
      ctx.lineTo(-13, 10);
      ctx.moveTo(8, 3);
      ctx.lineTo(13, 10);
      ctx.moveTo(-3, 3);
      ctx.lineTo(-5, 10);
      ctx.moveTo(3, 3);
      ctx.lineTo(5, 10);
      ctx.stroke();
      const thrusting = s.keys.size > 0 || !!s.drag;
      if (thrusting && !reducedRef.current) {
        ctx.fillStyle = s.fuel > 0 ? 'rgba(255,190,120,0.85)' : 'rgba(255,138,92,0.5)';
        ctx.beginPath();
        ctx.moveTo(-3, 4);
        ctx.lineTo(3, 4);
        ctx.lineTo(0, 10 + Math.random() * 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // --- Telemetry (DOM, written directly).
      fuelRef.current!.textContent = `${Math.round(s.fuel)}%`;
      fuelBarRef.current!.style.transform = `scaleX(${s.fuel / FUEL_MAX})`;
      const lat = centre[1];
      const lon = wrap(centre[0]);
      coordRef.current!.textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
      const m = Math.floor(s.elapsed / 60);
      clockRef.current!.textContent = `${String(m).padStart(2, '0')}:${String(Math.floor(s.elapsed % 60)).padStart(2, '0')}`;

      // --- What's underneath (a few times a second is plenty).
      if (frame % 6 === 0) {
        const c: [number, number] = [lon, lat];
        let t: number | null = null;
        projects.forEach((p, i) => {
          if (t === null && (geoDistance(c, p.site) < LAND_RADIUS || geoContains(features[i], c))) t = i;
        });
        s.target = s.landing >= 0 || s.dossierOpen ? null : t;
        if (s.target !== lastTarget) {
          lastTarget = s.target;
          setTarget(s.target);
        }
        const hit = t !== null ? features[t] : countries.find((f) => geoContains(f, c));
        const name = hit ? hit.properties.name : 'Open ocean';
        if (name !== lastOver) {
          lastOver = name;
          setOver(name);
        }
        const res = s.fuel <= 0;
        if (res !== lastReserve) {
          lastReserve = res;
          setReserve(res);
        }
      }
    });
  }, [land]);

  const done = visited.size === projects.length;
  const open: Project | null = dossier !== null ? projects[dossier] : null;

  return (
    <section ref={rootRef} id="expedition" aria-labelledby="expedition-title" className="relative h-screen-s overflow-hidden bg-void">
      <canvas ref={glRef} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
      <canvas
        ref={canvasRef}
        tabIndex={-1}
        aria-label="Interactive globe. Use the destination list to fly to each project, or take the controls to steer."
        className={`absolute inset-0 size-full outline-none ${engaged ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-grab touch-pan-y'}`}
      />

      {/* Title + briefing. */}
      <div className={`pointer-events-none absolute top-20 left-4 max-w-[58%] transition-opacity md:max-w-[24rem] duration-500 sm:left-6 md:top-24 md:left-[4vw] ${engaged ? 'opacity-0 md:opacity-40' : ''}`}>
        <p className="font-mono text-label text-earth uppercase">{expedition.eyebrow}</p>
        <h2 id="expedition-title" className="mt-3 font-display text-[clamp(1.25rem,2.6vw,2.5rem)] leading-tight text-white">
          {expedition.heading}
        </h2>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-regolith/60 max-md:hidden">{expedition.body}</p>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[0.625rem] tracking-[0.14em] text-regolith/60 uppercase max-md:hidden">
          {expedition.controls.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/80">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Telemetry. */}
      <div aria-hidden="true" className="pointer-events-none absolute right-4 top-20 space-y-3 text-right font-mono text-[0.625rem] tracking-[0.14em] text-regolith/70 uppercase sm:right-6 md:top-24 md:right-[4vw] md:text-label">
        <div>
          <p className="text-regolith/45">Landings</p>
          <p className="mt-1 font-display text-[1.5rem] tracking-normal text-white md:text-[2rem]">
            {String(visited.size).padStart(2, '0')}
            <span className="text-regolith/40">/{projects.length}</span>
          </p>
        </div>
        <div>
          <p className={reserve ? 'text-alarm' : 'text-regolith/45'}>{reserve ? 'Reserve thrust' : 'Fuel'}</p>
          <p className="mt-1 flex items-center justify-end gap-2">
            <span className="relative h-1 w-20 overflow-hidden rounded-full bg-white/15">
              <span ref={fuelBarRef} className={`absolute inset-0 origin-left ${reserve ? 'bg-alarm' : 'bg-earth'}`} />
            </span>
            <span ref={fuelRef} className="w-10 text-white tabular-nums">100%</span>
          </p>
        </div>
        <div>
          <p className="text-regolith/45">Mission time</p>
          <p className="mt-1 text-white tabular-nums">
            <span ref={clockRef}>00:00</span>
          </p>
        </div>
      </div>

      {/* Below the Eagle: where you are, and the landing call. */}
      <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-3 px-4 md:bottom-10">
        <p className="font-mono text-label text-regolith/70 uppercase" aria-live="polite">
          Over <span className="text-white">{over}</span> · <span ref={coordRef} className="tabular-nums">—</span>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {target !== null && dossier === null && (
            <button
              type="button"
              onClick={() => land(target)}
              className="rounded-[4px] bg-sunlit px-5 py-3 font-mono text-label text-void uppercase shadow-[0_0_40px_rgb(242_230_201/0.35)] transition-colors hover:bg-white"
            >
              Land on {projects[target].title} {engaged && <span className="opacity-60">[Space]</span>}
            </button>
          )}
          <button
            type="button"
            onClick={() => engage(!engaged)}
            className={`rounded-[4px] px-5 py-3 font-mono text-label uppercase transition-colors ${engaged ? 'text-white ring-1 ring-white/30 hover:bg-white hover:text-void' : 'bg-white text-void hover:bg-earth'}`}
          >
            {engaged ? 'Release controls [Esc]' : 'Take the controls'}
          </button>
          <button type="button" onClick={nextBeacon} className="rounded-[4px] px-5 py-3 font-mono text-label text-white uppercase ring-1 ring-white/25 transition-colors hover:bg-white hover:text-void">
            Autopilot → nearest
          </button>
        </div>
      </div>

      {/* Destinations: every country, one tap away. */}
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        aria-expanded={listOpen}
        aria-controls="destinations"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-label text-earth uppercase md:hidden"
      >
        {listOpen ? 'Hide destinations' : `Destinations (${projects.length})`}
      </button>
      <nav
        id="destinations"
        aria-label="Destinations"
        className={`absolute z-10 overflow-y-auto overscroll-contain bg-void/85 backdrop-blur-md max-md:inset-x-3 max-md:bottom-16 max-md:max-h-[50svh] max-md:rounded-[8px] max-md:ring-1 max-md:ring-white/10 md:right-[4vw] md:bottom-10 md:max-h-[46svh] md:w-72 md:rounded-[8px] md:ring-1 md:ring-white/10 ${listOpen ? '' : 'max-md:hidden'}`}
        data-lenis-prevent
      >
        <ol className="divide-y divide-white/5">
          {projects.map((p, i) => (
            <li key={p.repo}>
              <button
                type="button"
                onClick={() => fly(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${dossier === i ? 'bg-white/10' : ''}`}
              >
                <span aria-hidden="true">{p.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-white">{p.title}</span>
                  <span className="block font-mono text-[0.625rem] tracking-[0.12em] text-regolith/50 uppercase">{p.country}</span>
                </span>
                <span className={`font-mono text-[0.625rem] ${visited.has(i) ? 'text-sunlit' : 'text-regolith/30'}`}>{visited.has(i) ? '✓ Landed' : '○'}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* The dossier. */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="dossier-title"
          className="absolute inset-x-3 top-1/2 z-20 max-h-[80svh] -translate-y-1/2 animate-[dossier-in_0.5s_cubic-bezier(0.2,0.7,0.1,1)] overflow-y-auto rounded-[10px] bg-void/90 p-6 ring-1 ring-white/15 backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:w-[min(36rem,92vw)] sm:-translate-x-1/2 md:p-8"
          data-lenis-prevent
        >
          <p className="font-mono text-label text-earth uppercase">
            {open.flag} {open.city}, {open.country} · Landing {String(visited.size).padStart(2, '0')}/{projects.length}
          </p>
          <h3 id="dossier-title" className="mt-4 font-display text-[clamp(1.375rem,3vw,2rem)] leading-tight text-white">
            {open.title}
          </h3>
          <p className="mt-2 text-lg text-sunlit">{open.tagline}</p>
          <p className="mt-4 text-body text-regolith/75">{open.body}</p>
          <p className="mt-4 font-mono text-[0.6875rem] tracking-[0.08em] text-regolith/50">Why here: {open.why}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {open.stack.map((t) => (
              <li key={t} className="rounded-[3px] px-2 py-1 font-mono text-[0.625rem] tracking-[0.12em] text-regolith/80 uppercase ring-1 ring-white/15">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-2">
            <a href={`${owner.github}/${open.repo}`} target="_blank" rel="noreferrer" className="rounded-[4px] bg-white px-4 py-3 font-mono text-label text-void uppercase transition-colors hover:bg-earth">
              View the code ↗
            </a>
            {open.live && (
              <a href={open.live} target="_blank" rel="noreferrer" className="rounded-[4px] bg-earth px-4 py-3 font-mono text-label text-void uppercase transition-colors hover:bg-white">
                Live demo ↗
              </a>
            )}
            <button type="button" onClick={nextBeacon} className="rounded-[4px] px-4 py-3 font-mono text-label text-white uppercase ring-1 ring-white/25 transition-colors hover:bg-white hover:text-void">
              Next beacon →
            </button>
            <button type="button" onClick={liftOff} className="rounded-[4px] px-4 py-3 font-mono text-label text-regolith/70 uppercase transition-colors hover:text-white">
              Lift off
            </button>
          </div>
        </div>
      )}

      {done && dossier === null && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
          <p className="font-mono text-label text-sunlit uppercase">All {projects.length} landings · {clockRef.current?.textContent}</p>
          <p className="mt-3 font-display text-[clamp(1.5rem,4vw,3rem)] tracking-[0.12em] text-white">MISSION ACCOMPLISHED</p>
        </div>
      )}
    </section>
  );
}
