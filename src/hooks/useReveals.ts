import {useEffect, useRef} from 'react';

/** Adds `.is-in` to every `[data-reveal]` inside the ref the first time it's seen. */
export function useReveals<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      {rootMargin: '0px 0px -10% 0px'},
    );
    const watch = () => root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(root, {childList: true, subtree: true});
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return ref;
}
