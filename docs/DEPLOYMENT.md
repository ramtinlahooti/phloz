# Deployment

Phloz ships as two Vercel projects off the same monorepo:

| Project | Root dir | Domain |
|---|---|---|
| `phloz-web` | `apps/web` | `phloz.com`, `www.phloz.com` |
| `phloz-app` | `apps/app` | `app.phloz.com` |

Inbound email (`inbound.phloz.com`) is a Resend MX — not a Vercel
project. See `docs/DNS-SETUP.md` for those DNS records.

This doc walks through first-time setup. Re-runs just mean pushing to
`main` — CI + Vercel handle the rest.

---

## Prerequisites

- ✅ GitHub repo at `ramtinlahooti/phloz` (done).
- ✅ Supabase project + RLS applied (done).
- ✅ Stripe sandbox products + prices (done).
- A **Vercel account** on the Pro plan (Hobby works for dev but you'll
  want serverless function timeouts > 10s and higher concurrency).

---

## Step 1 — Create both Vercel projects

From the Vercel dashboard:

1. **New Project** → import `ramtinlahooti/phloz`.
2. **Project name:** `phloz-web`.
3. **Framework preset:** Next.js (auto-detected).
4. **Root directory:** `apps/web`.
5. Leave build + output commands at defaults — Vercel reads
   `apps/web/vercel.json` for anything that needs pinning.
6. **Install command** override: `pnpm install --frozen-lockfile`.
7. Click **Deploy** (it'll fail — env vars missing — that's fine).

Repeat for `phloz-app`:

1. **New Project** → same repo.
2. **Project name:** `phloz-app`.
3. **Root directory:** `apps/app`.
4. Everything else same as above.

---

## Step 2 — Environment variables

Both apps read env vars per `.env.example`. Some are shared, some are
app-specific. The comment tags in `.env.example` mark scope: `[both]`,
`[web]`, `[app]`.

### Shared (copy into BOTH projects)

```
NEXT_PUBLIC_APP_URL              https://app.phloz.com
NEXT_PUBLIC_MARKETING_URL        https://phloz.com
NEXT_PUBLIC_SUPABASE_URL         https://tdvzhwhzxuskrsobdyrm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    sb_publishable_…
NEXT_PUBLIC_GTM_CONTAINER_ID     GTM-W3MGZ8V7
NEXT_PUBLIC_SENTRY_DSN           (from Sentry project — optional)
SENTRY_DSN                       (same as NEXT_PUBLIC_ — server usage)
SENTRY_AUTH_TOKEN                (from Sentry → Auth Tokens — source-map upload)
NODE_ENV                         production (auto-set by Vercel)
```

### `phloz-app` only

```
DATABASE_URL                     postgres://postgres.*:****@aws-*.pooler.supabase.com:6543/postgres
SUPABASE_SERVICE_ROLE_KEY        sb_secret_…
STRIPE_SECRET_KEY                sk_live_… or sk_test_…
STRIPE_WEBHOOK_SECRET            whsec_… (see Step 4)
RESEND_API_KEY                   re_…
RESEND_WEBHOOK_SECRET            whsec_… (Resend-dashboard endpoint)
INBOUND_EMAIL_DOMAIN             inbound.phloz.com
INNGEST_EVENT_KEY                (from Inngest dashboard)
INNGEST_SIGNING_KEY              (from Inngest dashboard)
NEXT_PUBLIC_POSTHOG_KEY          phc_… (optional — no-op if absent)
NEXT_PUBLIC_POSTHOG_HOST         https://us.i.posthog.com
GA4_MEASUREMENT_ID               G-… (server-side conversion events)
GA4_API_SECRET                   …
```

### Vercel CLI shortcut

```bash
pnpm dlx vercel link   # from apps/web AND apps/app
pnpm dlx vercel env pull .env.production  # sanity-check what's set
```

---

## Step 3 — Domains

In the `phloz-web` project settings → Domains:
- `phloz.com` (add + Vercel auto-issues TLS).
- `www.phloz.com` (add with redirect to the apex).

In `phloz-app` → Domains:
- `app.phloz.com`.

For `inbound.phloz.com` — do not point it at Vercel. Leave MX records
pointing at Resend (see `docs/DNS-SETUP.md`).

---

## Step 4 — Stripe webhook

Stripe sends subscription events to `POST https://app.phloz.com/api/webhooks/stripe`.

1. Stripe dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://app.phloz.com/api/webhooks/stripe`.
3. Events to send (matches `HANDLED_EVENT_TYPES` in `@phloz/billing`):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Click **Add endpoint**.
5. Copy the **Signing secret** → paste into Vercel env as
   `STRIPE_WEBHOOK_SECRET` on `phloz-app`.
6. Redeploy `phloz-app` so the new env takes effect.

---

## Step 5 — Resend inbound

Pointing `inbound.phloz.com` at Resend is covered in
`docs/DNS-SETUP.md`. After the domain is verified:

1. Resend dashboard → Webhooks → Add endpoint.
2. URL: `https://app.phloz.com/api/webhooks/resend/inbound`.
3. Events: `email.received` (inbound).
4. Copy the signing secret → Vercel env `RESEND_WEBHOOK_SECRET` on
   `phloz-app`.

---

## Step 6 — Supabase Auth emails via Resend SMTP

By default Supabase sends signup / magic-link / password-reset /
email-change emails from `noreply@mail.app.supabase.io`. Two minutes
in the Supabase dashboard routes them through Resend instead so
they land from your own `phloz.com` sender.

**Pre-req:** `phloz.com` must be verified in Resend
(see `docs/DNS-SETUP.md`).

1. **Create an SMTP key in Resend**: dashboard → API Keys → Create
   (full access is fine). Copy it.
2. **In Supabase** → Project Settings → Authentication → SMTP Settings
   → **Enable Custom SMTP**.
3. Fill in:
   - **Sender email**: `no-reply@phloz.com` (or whatever you like on
     the verified domain)
   - **Sender name**: `Phloz`
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (TLS)
   - **Username**: `resend`
   - **Password**: the Resend API key from step 1
4. Save, then send a test email from the same screen. Check your
   inbox and confirm the sender is now `no-reply@phloz.com`.

Optionally customise the email templates at Authentication →
Email Templates — the `{{ .ConfirmationURL }}` placeholder carries
the magic link.

If you'd rather render the templates in your own code (via React
Email + `@phloz/email`), the Supabase path is the **Send Email Auth
Hook** — that's a V2 improvement and we haven't shipped the route
handler yet. SMTP covers the immediate need.

---

## Step 7 — Inngest

Inngest manages our background jobs. See `docs/INNGEST-SETUP.md` for
the full flow; the short version:

1. Create a new Inngest app from their dashboard.
2. Point it at `https://app.phloz.com/api/inngest`.
3. Copy both `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` into Vercel
   env on `phloz-app`.

---

## Step 8 — Sanity checks

After the first deploy of each project:

- `https://phloz.com` returns 200, the GTM `<script>` is in the DOM.
- `https://phloz.com/sitemap.xml` lists all 49 pages.
- `https://phloz.com/robots.txt` allows `/` and disallows `/api/`.
- `https://phloz.com/llms.txt` renders categorized index.
- `https://app.phloz.com/api/health` returns
  `{"ok":true,"db":"ok",...}` (proves `DATABASE_URL` works).
- `https://app.phloz.com/login` renders and accepts an email.
- After signup, `https://app.phloz.com/onboarding` creates a workspace
  and redirects to `/[workspace]` (proves service-role writes work).
- Sentry dashboard shows at least a `HandledException` test event when
  you visit a page with an intentional error.

---

## Preview deployments

Every PR against `main` gets its own preview URL
(`phloz-<branch>-<hash>.vercel.app`). Env vars on preview deployments
inherit from the project's "Preview" scope — set your sandbox keys
there rather than production.

Vercel's branch deployments are compatible with the CI pipeline:
`.github/workflows/ci.yml` runs `pnpm check` + builds + RLS guard
before Vercel even starts, so failing type checks never reach preview.

---

## Runtime gotchas

- **Turbopack build root warning** — harmless, fixed by setting
  `turbopack.root` in each app's `next.config.ts` if it starts nagging.
- **Supabase pooler port** — use `6543` (transaction pool) in
  `DATABASE_URL`, not `5432`. The pool is required for Next.js
  serverless functions; `prepare: false` is already set in
  `packages/db/src/client.ts`.
- **Inngest cold-start** — the first request after a deploy triggers
  Inngest's introspection roundtrip, which can take ~500ms extra.
  Subsequent requests don't pay this cost.
- **Middleware → Proxy** — Next 16 renamed the file convention.
  `apps/app/proxy.ts` is correct; don't revert to `middleware.ts`.

---

## Rollback

If a deploy goes sideways, Vercel's "Promote to Production" on an
older deployment reverts in ~30s. All routes go back to the previous
build's assets + functions. Env vars are not rolled back — they're
project-level. For env-var rollbacks, use the dashboard's env var
history.

## Rotation schedule (post-launch)

Quarterly:
- Rotate `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Settings → API).
- Rotate `STRIPE_WEBHOOK_SECRET` (Stripe dashboard → Webhooks → endpoint).
- Rotate `RESEND_WEBHOOK_SECRET`.
- Rotate `INNGEST_SIGNING_KEY`.

Annually:
- Review the full `.env.example` against what's actually in Vercel —
  drift is the default. Add a calendar reminder.
