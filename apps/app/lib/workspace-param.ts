import { notFound } from 'next/navigation';

/**
 * RFC-4122 UUID shape.
 *
 * Why this lives here: the `[workspace]` layout already calls
 * `notFound()` for non-UUID segments, but in the App Router
 * (turbopack build) the layout and page render in parallel — the
 * page's `Promise.all` data fetches can fire BEFORE the layout's
 * notFound() tears down the render. Each `[workspace]/...` page
 * therefore needs its own synchronous guard at the very top, before
 * any DB call.
 *
 * Real-world manifestation that drove this: stray /favicon.ico
 * requests fell through to `[workspace]/page.tsx`, which then ran
 * ~7 queries with `workspace_id = "favicon.ico"`. Each one threw
 * an `invalid input syntax for type uuid` error and chewed a
 * connection from the Supabase pool. At a few requests per minute
 * the pool exhausted and legitimate users couldn't load their
 * dashboards.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Throws `notFound()` (which Next.js converts to a 404) when the
 * supplied workspace param isn't a UUID. Call this synchronously
 * at the top of every `[workspace]/...` page server component,
 * before kicking off any data fetching.
 */
export function assertValidWorkspaceId(workspaceId: string): void {
  if (!UUID_RE.test(workspaceId)) notFound();
}
