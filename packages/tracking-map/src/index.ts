/**
 * `@phloz/tracking-map` public API.
 *
 * - `./` (this barrel) — types, health helpers, node-type descriptors
 *   (registering them on import). Pure — safe from server contexts.
 * - `./canvas` — React Flow canvas component (client-only, dynamic-import
 *   it from Next pages to keep the server bundle small).
 * - `./layout` — dagre auto-layout helper (pure, usable from tests).
 * - `./styles` — React Flow base CSS + Phloz overrides.
 */
export * from './types';
export * from './health';
export * from './node-types';
export * from './audit';
