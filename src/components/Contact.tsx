import {contact, owner} from '../content';
import {useReveals} from '../hooks/useReveals';

export function Contact() {
  const ref = useReveals<HTMLElement>();
  return (
    <section ref={ref} id="contact" aria-labelledby="contact-title" className="relative overflow-hidden bg-void px-4 pb-28 sm:px-6 md:px-[6vw] md:pb-40">
      {/* A sliver of the Earth rising at the bottom edge — the hero, bookended. */}
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-[62vw] left-1/2 size-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(111,182,255,0.35),rgba(111,182,255,0.05)_55%,transparent_70%)]" />
      <div className="relative border-t border-white/10 pt-20 text-center md:pt-28" data-reveal>
        <p className="font-mono text-label text-earth uppercase">{contact.eyebrow}</p>
        <h2 id="contact-title" className="mx-auto mt-4 max-w-[20ch] font-display text-display text-white">
          {contact.heading}
        </h2>
        <p className="mx-auto mt-5 max-w-[32rem] text-body text-regolith/70">{contact.body}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href={owner.github} target="_blank" rel="noreferrer" className="rounded-[4px] bg-white px-6 py-4 font-mono text-label text-void uppercase transition-colors hover:bg-earth">
            GitHub ↗
          </a>
          <a href={owner.site} target="_blank" rel="noreferrer" className="rounded-[4px] px-6 py-4 font-mono text-label text-white uppercase ring-1 ring-white/25 transition-colors hover:bg-white hover:text-void">
            {owner.site.replace('https://', '')} ↗
          </a>
        </div>
      </div>
    </section>
  );
}
