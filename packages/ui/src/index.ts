/**
 * `@phloz/ui` — shared component library.
 *
 * - `./tokens` — design tokens (pure data, usable in tests)
 * - `./cn` — tailwind-aware classname merger
 * - `./primitives` — shadcn-style primitives (Button, Input, Card, Badge…)
 * - `./components` — Phloz-specific shared components (PageHeader,
 *   EmptyState, LoadingSpinner, TierBadge)
 * - `./fonts` — Geist font loader for Next.js root layouts
 *
 * Tailwind v4 stylesheet lives at `packages/ui/styles/globals.css` and
 * is imported once by each app's root layout.
 */

export * from './tokens';
export { cn } from './cn';
export * from './primitives';
export * from './components';
