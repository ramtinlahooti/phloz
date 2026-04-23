/**
 * Tailwind v4 uses a PostCSS plugin (@tailwindcss/postcss). No
 * tailwind.config.ts — all theming lives in CSS via `@theme` in
 * `packages/ui/styles/globals.css`.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
