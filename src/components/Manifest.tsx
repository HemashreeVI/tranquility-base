import {owner, projects} from '../content';
import {useReveals} from '../hooks/useReveals';

/** Every project as a manifest entry; "Fly there" hands off to the globe above. */
export function Manifest() {
  const ref = useReveals<HTMLElement>();
  return (
    <section ref={ref} id="manifest" aria-labelledby="manifest-title" className="relative bg-void px-4 py-28 sm:px-6 md:px-[6vw] md:py-40">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between" data-reveal>
        <div>
          <p className="font-mono text-label text-earth uppercase">Manifest</p>
          <h2 id="manifest-title" className="mt-4 font-display text-display text-white">
            {projects.length} countries. {projects.length} projects.
          </h2>
        </div>
        <a href={owner.github} target="_blank" rel="noreferrer" className="font-mono text-label text-regolith/60 uppercase hover:text-white">
          github.com/{owner.name} ↗
        </a>
      </div>

      <ol className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-3 md:gap-5">
        {projects.map((p, i) => (
          <li
            key={p.repo}
            data-reveal
            style={{transitionDelay: `${(i % 3) * 90}ms`}}
            className="group relative flex flex-col rounded-[8px] bg-void-2/60 p-6 ring-1 ring-white/10 transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:ring-white/25 md:p-7"
          >
            <div className="flex items-start justify-between gap-4 font-mono text-label text-regolith/50 uppercase">
              <span>
                <span aria-hidden="true">{p.flag}</span> {p.country}
              </span>
              <span className="text-right tabular-nums">
                {Math.abs(p.site[1]).toFixed(1)}°{p.site[1] >= 0 ? 'N' : 'S'} {Math.abs(p.site[0]).toFixed(1)}°{p.site[0] >= 0 ? 'E' : 'W'}
              </span>
            </div>
            <h3 className="mt-6 font-display text-[1.125rem] tracking-[0.08em] text-white uppercase">{p.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-regolith/70">{p.tagline}</p>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {p.stack.map((t) => (
                <li key={t} className="rounded-[3px] px-2 py-0.5 font-mono text-[0.625rem] tracking-[0.12em] text-regolith/70 uppercase ring-1 ring-white/10">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('tb:fly', {detail: i}))}
                className="rounded-[4px] bg-white px-4 py-2.5 font-mono text-label text-void uppercase transition-colors hover:bg-earth"
              >
                Fly there
              </button>
              <a href={`${owner.github}/${p.repo}`} target="_blank" rel="noreferrer" className="rounded-[4px] px-4 py-2.5 font-mono text-label text-white uppercase ring-1 ring-white/25 transition-colors hover:bg-white hover:text-void">
                Code ↗
              </a>
              {p.live && (
                <a href={p.live} target="_blank" rel="noreferrer" className="rounded-[4px] px-4 py-2.5 font-mono text-label text-earth uppercase ring-1 ring-earth/40 transition-colors hover:bg-earth hover:text-void">
                  Live ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
