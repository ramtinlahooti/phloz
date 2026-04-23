# Observability

Phloz uses four pillars of observability, each with a graceful-degradation
pattern so local dev and self-hosted environments work without any of
them configured.

| Concern | Tool | Where |
|---|---|---|
| Errors + performance traces | Sentry (`@sentry/nextjs`) | Both apps |
| Product analytics | GTM + GA4 + PostHog | Marketing: GTM/GA4; Product: PostHog |
| Structured server logs | pino (`@phloz/config/logger`) | Every server context |
| Uptime / health | `GET /api/health` | Product app |

---

## Sentry

### Config files

Each app ships three Sentry config files plus an `instrumentation.ts`
that registers the right one for the active Next.js runtime:

```
apps/web/
├── instrumentation.ts
├── sentry.client.config.ts
├── sentry.server.config.ts
└── sentry.edge.config.ts
```

Same layout in `apps/app/`, with one difference: the product app's
client config enables **session replay** with full masking of text /
inputs / media. Marketing site doesn't need replay.

### Env vars

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project → Client Keys | Client-side + fallback for server |
| `SENTRY_DSN` | Sentry project → Client Keys | Server-side preferred name |
| `SENTRY_AUTH_TOKEN` | Sentry → Auth Tokens → "releases" scope | For source-map upload at build time |

When no DSN is set, Sentry no-ops. You get no events, no fetch calls,
no overhead. This is deliberate so local dev stays fast.

### Source-map upload

Sentry's Next.js SDK uploads source maps at build time when
`SENTRY_AUTH_TOKEN` is present. Add it to Vercel env vars before the
first deploy where you want symbolicated traces.

### What to put in Sentry

- **Uncaught errors**: automatic via `onRequestError` in instrumentation.
- **Thrown errors in server actions / route handlers**: automatic once
  the server config loads.
- **Explicit capture**: `Sentry.captureException(err, { extra })` when you
  want context.

### What to keep out of Sentry

- PII (emails, names, raw message bodies). The session-replay
  integration already masks text/inputs/media by default.
- Secrets. Never log them, never pass them as tags.

---

## Product analytics

### GTM (marketing site)

`apps/web` ships with GTM container `GTM-W3MGZ8V7` wired into the root
layout via `components/gtm.tsx`. GTM handles pageviews, outbound-link
tracking, and any marketing-team-owned conversions.

### PostHog (product app)

`apps/app/components/posthog-provider.tsx` mounts once in the root
layout. It initializes PostHog with `capture_pageview: false` +
`autocapture: false` and manually captures `$pageview` on every
Next.js client-side route change (via `usePathname` / `useSearchParams`).

Env vars:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → Project Settings → Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Defaults to `https://us.i.posthog.com` |

When no key is set, the provider no-ops.

### GA4 Measurement Protocol (server events)

`packages/analytics/src/ga4/` already ships a server-side emitter.
Events tagged as `SERVER_GA4_EVENTS` (`sign_up`, `upgrade_tier`) are
sent directly from the server — this matters for conversion attribution
because client-side events lose fidelity as browsers tighten cookies.

Env vars:

| Variable | Where |
|---|---|
| `GA4_MEASUREMENT_ID` | GA4 → Admin → Data Streams → Stream details |
| `GA4_API_SECRET` | Same stream → Measurement Protocol API secrets |

### The `track()` rule

Per `CLAUDE.md` §2: **every tracked user action goes through
`packages/analytics/track()`**. No raw `gtag()`, no raw `dataLayer.push()`,
no raw PostHog SDK calls outside `packages/analytics`.

---

## Structured logging (pino)

### The logger

`@phloz/config/logger` exports two helpers:

```ts
import { getLogger, requestLogger } from '@phloz/config/logger';

const logger = getLogger();
logger.info({ workspaceId }, 'client added');

// Or with request context:
const log = requestLogger({ route: '/api/clients', workspaceId });
log.warn({ reason: 'quota_near' }, 'approaching client cap');
```

### Defaults

- **JSON in production, pretty-print in dev** (when `pino-pretty` is
  available; falls back to JSON if not).
- **Level**: `LOG_LEVEL` env var, default `debug` in dev, `info` in prod.
- **Base fields**: `app`, `env` (from `VERCEL_ENV`), `region`.
- **Redaction**: `password`, `token`, `authorization`, `headers.cookie`,
  `apiKey`, `stripeSecretKey`, `supabaseServiceRoleKey` are always
  `[REDACTED]` before they hit the transport.

### What to log

- **Server actions**: start + end with outcome (ok / err).
- **Route handlers**: errors + unusual paths (rate-limit hits, quota
  warnings).
- **Inngest functions**: step-level output already captured by Inngest;
  use pino for anything Inngest wouldn't show (upstream API issues).

### What not to log

- Secrets (handled by redaction, but don't rely on it — don't put
  tokens in field names that aren't on the redact list).
- Full HTML bodies, binary payloads, entire DB rows with PII. Use ids.

---

## Uptime / health

`GET /api/health` on `app.phloz.com` returns:

```json
{ "ok": true, "db": "ok", "at": "2026-04-23T12:00:00.000Z" }
```

Point any uptime monitor (BetterUptime, Pingdom, UptimeRobot) at it.
Returns 503 with the error message if the DB round-trip fails.

---

## Dashboards to wire post-launch

| Dashboard | Tool | Contents |
|---|---|---|
| "Signups today" | PostHog | `sign_up` event count, per-tier |
| "Trial conversions" | PostHog | trial_started → upgrade_tier funnel |
| "Active-client cap warnings" | Inngest | `recomputeActiveClientCount` run history |
| "Stripe failures" | Stripe + Sentry | `invoice.payment_failed` events |
| "Email deliverability" | Resend | Bounces + complaints |

None of these block the V1 launch. Add them when traffic justifies it.
