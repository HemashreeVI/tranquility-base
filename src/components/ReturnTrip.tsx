import {geoGraticule10, geoOrthographic, geoPath} from 'd3-geo';
import {useEffect, useRef, useState} from 'react';
import {returnTrip} from '../content';
import {snapshot} from '../gl/planet';
import {clamp, easeOutCubic, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';
import {land} from '../lib/world';

/**
 * Moon → Earth, drawn as you scroll. The section pins while the four legs of
 * the return flight ink themselves one after another, a capsule riding the
 * leg being drawn; the distance flown ticks up to 384,400 km during the
 * coast. The Earth and Moon are stills rendered from the NASA mosaics;
 * until they load, a vector Earth from Natural Earth outlines stands in.
 */

const SECTION_VH = 380;
const WINDOW = [0.06, 0.92] as const;
const DISTANCE = 384400;

const MOON = {cx: 220, cy: 320, r: 52};
const EARTH = {cx: 960, cy: 300, r: 104};

const LEGS = [
  // Ascent from the surface into lunar orbit.
  `M${MOON.cx - 20} ${MOON.cy - 48} C ${MOON.cx - 40} ${MOON.cy - 80}, ${MOON.cx - 30} ${MOON.cy - 98}, ${MOON.cx} ${MOON.cy - 100}`,
  // A lap behind the Moon, then the burn.
  `M${MOON.cx} ${MOON.cy - 100} a100 100 0 1 1 -0.1 0 a100 100 0 0 1 76.6 35.7`,
  // Trans-Earth coast.
  `M${MOON.cx + 76.6} ${MOON.cy - 64.3} C 480 120, 760 110, ${EARTH.cx - 90} ${EARTH.cy - 95}`,
  // Capture into Earth orbit.
  `M${EARTH.cx - 90} ${EARTH.cy - 95} a131 131 0 0 1 180 190 a131 131 0 0 1 -180 -190`,
];

const earthProjection = geoOrthographic().scale(EARTH.r).translate([EARTH.cx, EARTH.cy]).rotate([-60, -18]);
const earthPath = geoPath(earthProjection);
const EARTH_LAND = earthPath(land) ?? '';
const EARTH_GRID = earthPath(geoGraticule10()) ?? '';

export function ReturnTrip() {
  const rootRef = useRef<HTMLElement>(null);
  const legRefs = useRef<SVGPathElement[]>([]);
  const capsuleRef = useRef<SVGGElement>(null);
  const kmRef = useRef<HTMLSpanElement>(null);
  const [leg, setLeg] = useState(0);
  const [stills, setStills] = useState<{earth?: string; moon?: string}>({});

  useEffect(() => {
    let live = true;
    snapshot({r: 512 / 2 / 1.22, rotate: [-60, -18, 0], texture: 'earth', sun: [-0.6, 0.3, 0.75], ambient: 0.02, clouds: true}, 512, ['earth', 'night', 'clouds']).then(
      (earth) => live && setStills((v) => ({...v, earth})),
    );
    snapshot({r: 128, rotate: [0, 0, 0], texture: 'moon', sun: [0.55, 0.25, 0.8], ambient: 0.04}, 256, ['moon']).then((moon) => live && setStills((v) => ({...v, moon})));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let lastP = -1;
    let current = 0;
    return onFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const {p, rect, vh} = pinProgress(root);
      if (rect.bottom < 0 || rect.top > vh) return;
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const u = range(p, ...WINDOW) * LEGS.length;
      const s = clamp(Math.floor(u), 0, LEGS.length - 1);
      if (s !== current) {
        current = s;
        setLeg(s);
      }
      legRefs.current.forEach((path, i) => {
        const k = easeOutCubic(clamp(u - i));
        path.style.strokeDashoffset = String(1 - k);
        if (i === s) {
          const pt = path.getPointAtLength(path.getTotalLength() * k);
          capsuleRef.current!.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        }
      });
      const coast = easeOutCubic(clamp(u - 2));
      kmRef.current!.textContent = Math.round(coast * DISTANCE).toLocaleString('en-US');
    });
  }, []);

  const current = returnTrip.legs[leg];

  return (
    <section ref={rootRef} id="return" aria-labelledby="return-title" className="relative bg-void" style={{height: `${SECTION_VH}svh`}}>
      <div className="sticky top-0 flex h-screen-s flex-col overflow-hidden px-4 pt-20 pb-8 sm:px-6 md:px-[6vw] md:pt-24">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-label text-earth uppercase">{returnTrip.eyebrow}</p>
            <h2 id="return-title" className="mt-3 max-w-[22ch] font-display text-display text-white">
              {returnTrip.heading}
            </h2>
          </div>
          <p className="font-mono text-label whitespace-nowrap text-regolith/60 uppercase" aria-live="off">
            Distance flown <span ref={kmRef} className="text-white tabular-nums">0</span> km
          </p>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center">
          <svg viewBox="0 0 1200 600" className="h-auto max-h-full w-full" role="img" aria-label="The return flight from the Moon to Earth orbit, drawn in four legs.">
            <defs>
              <radialGradient id="moon-shade" cx="35%" cy="35%" r="75%">
                <stop offset="0" stopColor="#e4e6ea" />
                <stop offset="0.7" stopColor="#8b909b" />
                <stop offset="1" stopColor="#2a2e36" />
              </radialGradient>
              <radialGradient id="earth-ocean" cx="35%" cy="35%" r="75%">
                <stop offset="0" stopColor="#1d4f8c" />
                <stop offset="1" stopColor="#081a36" />
              </radialGradient>
              <radialGradient id="earth-glow">
                <stop offset="0.8" stopColor="#6fb6ff" stopOpacity="0.35" />
                <stop offset="1" stopColor="#6fb6ff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="earth-night" x1="0" x2="1">
                <stop offset="0.45" stopColor="#02040a" stopOpacity="0" />
                <stop offset="1" stopColor="#02040a" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            <g fill="#fff">
              {Array.from({length: 70}, (_, i) => (
                <circle key={i} cx={(i * 173) % 1200} cy={(i * 97) % 600} r={i % 7 === 0 ? 1.4 : 0.7} opacity={0.15 + ((i * 37) % 50) / 100} />
              ))}
            </g>

            {stills.earth ? (
              <image href={stills.earth} x={EARTH.cx - EARTH.r * 1.22} y={EARTH.cy - EARTH.r * 1.22} width={EARTH.r * 2.44} height={EARTH.r * 2.44} />
            ) : (
              <g>
                <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r * 1.18} fill="url(#earth-glow)" />
                <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r} fill="url(#earth-ocean)" />
                <path d={EARTH_GRID} fill="none" stroke="#a0c8ff" strokeOpacity="0.1" strokeWidth="0.6" />
                <path d={EARTH_LAND} fill="#5f7f6a" />
                <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r} fill="url(#earth-night)" />
              </g>
            )}

            {stills.moon ? (
              <image href={stills.moon} x={MOON.cx - MOON.r} y={MOON.cy - MOON.r} width={MOON.r * 2} height={MOON.r * 2} />
            ) : (
              <circle cx={MOON.cx} cy={MOON.cy} r={MOON.r} fill="url(#moon-shade)" />
            )}

            {LEGS.map((d, i) => (
              <path key={`g${i}`} d={d} fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="1.5" strokeDasharray="3 6" />
            ))}
            {LEGS.map((d, i) => (
              <path
                key={i}
                ref={(el) => {
                  if (el) legRefs.current[i] = el;
                }}
                d={d}
                pathLength={1}
                fill="none"
                stroke={i === 2 ? '#6fb6ff' : '#f2e6c9'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 1"
                strokeDashoffset="1"
              />
            ))}

            <g ref={capsuleRef} transform={`translate(${MOON.cx - 20} ${MOON.cy - 48})`}>
              <circle r="11" fill="#6fb6ff" opacity="0.25" />
              <circle r="4.5" fill="#fff" />
            </g>

            <g fontFamily="IBM Plex Mono, monospace" fontSize="13" letterSpacing="2" fill="#8b909b">
              <text x={MOON.cx} y={MOON.cy + 130} textAnchor="middle">
                MOON
              </text>
              <text x={EARTH.cx} y={EARTH.cy + 175} textAnchor="middle">
                EARTH
              </text>
            </g>
          </svg>
        </div>

        <div className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-10">
          <p className="font-mono text-label text-earth uppercase">
            {current.day} · Leg {leg + 1}/{returnTrip.legs.length}
          </p>
          <div key={leg} className="animate-[leg-in_0.6s_cubic-bezier(0.2,0.7,0.1,1)]" aria-live="polite">
            <h3 className="font-display text-[1.125rem] tracking-[0.08em] text-white uppercase md:text-[1.375rem]">{current.title}</h3>
            <p className="mt-1.5 max-w-[40rem] text-body text-regolith/70">{current.body}</p>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {returnTrip.legs.map((_, i) => (
              <span key={i} className={`h-1 w-8 rounded-full transition-colors duration-500 ${i <= leg ? 'bg-earth' : 'bg-white/15'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
