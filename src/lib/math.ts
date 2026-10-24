export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where `v` sits between `a` and `b`, clamped to 0–1. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Scroll progress through a tall section whose child is `position: sticky`.
 * 0 when the section's top meets the viewport top, 1 when the sticky child
 * is about to unpin.
 */
export function pinProgress(el: HTMLElement): {p: number; rect: DOMRect; vh: number} {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const span = Math.max(1, rect.height - vh);
  return {p: clamp(-rect.top / span), rect, vh};
}

/** Small deterministic PRNG so procedural scenery is the same on every load. */
export function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
