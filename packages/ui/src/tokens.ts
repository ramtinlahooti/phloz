/**
 * Design tokens for Phloz.
 *
 * Aesthetic: SpaceX/Linear-inspired. Dark-first (charcoal + near-black),
 * restrained deep-blue accent, Geist typography.
 *
 * Decision logged in docs/DECISIONS.md (2026-04-23).
 */
export const tokens = {
  color: {
    // neutral shell — mirrors Tailwind zinc so shadcn works without mapping
    surface: {
      base: 'hsl(240 6% 4%)', // zinc-950 territory
      raised: 'hsl(240 5% 8%)', // zinc-900
      overlay: 'hsl(240 4% 14%)', // zinc-800
      border: 'hsl(240 4% 18%)',
    },
    text: {
      primary: 'hsl(0 0% 98%)',
      secondary: 'hsl(240 4% 70%)',
      muted: 'hsl(240 4% 50%)',
    },
    // deep blue accent (confirmed 2026-04-23)
    // references Tailwind's blue-600/500 but nudged darker for dark-first UI
    accent: {
      50: 'hsl(214 100% 97%)',
      100: 'hsl(214 95% 93%)',
      500: 'hsl(217 91% 60%)',
      600: 'hsl(221 83% 53%)', // primary
      700: 'hsl(224 76% 45%)',
      900: 'hsl(226 55% 25%)',
    },
    // semantic
    success: 'hsl(142 71% 45%)',
    warning: 'hsl(38 92% 50%)',
    danger: 'hsl(0 72% 51%)',
    info: 'hsl(217 91% 60%)',
    // tracking-map health status (mirrors ARCHITECTURE.md §8.2)
    health: {
      working: 'hsl(142 71% 45%)',
      broken: 'hsl(0 72% 51%)',
      missing: 'hsl(38 92% 50%)',
      unverified: 'hsl(240 4% 50%)',
    },
  },
  font: {
    sans: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
  },
  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
} as const;

export type Tokens = typeof tokens;
