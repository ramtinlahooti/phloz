'use client';

import { useEffect, useState } from 'react';

/**
 * Top-of-page progress bar that fills as the reader scrolls a long
 * article. Hidden in the SSR output (initial value 0) and on
 * `prefers-reduced-motion: reduce` browsers — no parallax effect, no
 * jank. Tracks document.scrollingElement so it works whether the
 * scroll lives on `<html>` or `<body>` across browsers.
 *
 * Cheap rAF-throttled scroll listener; one transform-only style
 * update per frame so the bar paints on the GPU.
 */
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let raf = 0;
    function compute() {
      const el = document.scrollingElement ?? document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) {
        setPct(0);
        return;
      }
      const ratio = Math.min(1, Math.max(0, el.scrollTop / max));
      setPct(ratio * 100);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    }
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', compute, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', compute);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div
        className="h-full origin-left bg-primary transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
