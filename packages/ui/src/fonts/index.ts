/**
 * Geist fonts via `next/font`. Each app calls `loadGeistFonts()` in its
 * root layout and spreads the resulting class names onto `<html>`.
 *
 * Lives here (not in the apps) so the CSS variable names stay consistent
 * with `packages/ui/styles/globals.css` (`--font-geist-sans`,
 * `--font-geist-mono`).
 *
 * `next/font` is imported on demand to keep this package usable from
 * non-Next contexts (Storybook, tests).
 */

export interface GeistFontHandles {
  sansClassName: string;
  monoClassName: string;
  /** Convenience: `sans.className + ' ' + mono.className`. */
  className: string;
  /** CSS variable names — `--font-geist-sans`, `--font-geist-mono`. */
  variables: {
    sans: string;
    mono: string;
  };
}

/**
 * Load the Geist font pair. Only call this from a Next.js app root layout.
 *
 * Usage:
 * ```tsx
 * import { loadGeistFonts } from '@phloz/ui/fonts';
 * const fonts = loadGeistFonts();
 * <html className={fonts.className}>…</html>
 * ```
 */
export async function loadGeistFonts(): Promise<GeistFontHandles> {
  const [{ GeistSans }, { GeistMono }] = await Promise.all([
    import('geist/font/sans'),
    import('geist/font/mono'),
  ]);
  return {
    sansClassName: GeistSans.variable,
    monoClassName: GeistMono.variable,
    className: `${GeistSans.variable} ${GeistMono.variable}`,
    variables: { sans: '--font-geist-sans', mono: '--font-geist-mono' },
  };
}
