# Inngest setup

Inngest runs Phloz's background jobs: nightly active-client recompute,
trial-ending reminders, and post-workspace-creation fan-outs. It's a
managed platform with a local dev relay.

---

## TL;DR

- **Production**: one Inngest app at `app.phloz.com/api/inngest`. Inngest
  registers functions automatically on deploy and runs them on our
  infrastructure.
- **Local dev**: `npx inngest-cli@latest dev` runs a local relay that
  discovers functions via the same route and fires crons/events against
  your laptop.

No self-hosting. No Redis. No queues you maintain.

---

## Local development

### 1. Start the Next.js app

```bash
pnpm --filter @phloz/app dev
# → listening on http://localhost:3001
```

### 2. Start the Inngest dev relay

In a second terminal:

```bash
npx inngest-cli@latest dev
```

It opens a dashboard at `http://localhost:8288` and automatically
discovers the functions registered at
`http://localhost:3001/api/inngest`.

### 3. Trigger functions

From the dashboard you can:

- Manually invoke any function
- Send any registered event (use the typed event catalog in
  `apps/app/inngest/client.ts` as your reference)
- Inspect step-level retry + output history

Or from the CLI:

```bash
curl -X POST http://localhost:8288/e/mock-event-key \
  -H 'Content-Type: application/json' \
  -d '{"name":"billing/recompute-active-clients","data":{}}'
```

---

## Registered functions

All functions live in `apps/app/inngest/functions/` and are registered
in `apps/app/inngest/index.ts`.

| File | Trigger | What it does |
|---|---|---|
| `recompute-active-client-count.ts` | cron `0 9 * * *` UTC + event `billing/recompute-active-clients` | Scans every workspace, counts active clients, flags those at/near the tier cap. |
| `send-trial-ending-reminder.ts` | cron `0 15 * * *` UTC | Finds `subscription_status=trialing` workspaces, asks Stripe for `trial_end`, emails reminder when ≤3 days left. |
| `on-workspace-created.ts` | event `workspace/created` | Seeds per-workspace defaults (V2 hook — currently a no-op). |
| `on-workspace-created.ts` (second function) | event `workspace/client-added` | Mints the opaque inbound email address for a new client (`client-<nanoid(12)>@inbound.phloz.com`). |

Event emission points already wired:

| Event | Emitted from |
|---|---|
| `workspace/created` | `apps/app/app/onboarding/actions.ts` (after workspace + owner membership rows exist). |
| `workspace/client-added` | `apps/app/app/api/workspaces/[workspaceId]/clients/route.ts` (after client insert). |
| `stripe/subscription-updated` | `apps/app/app/api/webhooks/stripe/route.ts` (after reconciling tier). |
| `billing/trial-ending` | `send-trial-ending-reminder.ts` (fan-out for analytics). |

---

## Production wiring

### Environment variables (Vercel)

| Variable | Where from |
|---|---|
| `INNGEST_EVENT_KEY` | Inngest dashboard → Events → Event Key |
| `INNGEST_SIGNING_KEY` | Inngest dashboard → Apps → the Phloz app → Signing Key |

Inngest v4 reads both automatically from the environment — no
explicit wiring in `client.ts` or `serve()`.

### Registering the app

After the first deploy with `INNGEST_SIGNING_KEY` set, open the Inngest
dashboard → "New app" → paste
`https://app.phloz.com/api/inngest`. Inngest pings the route and
registers every function automatically.

Subsequent deploys keep the registration fresh via the `PUT` handler
(Inngest re-introspects on each deploy, so new functions show up without
manual action).

### Observability

- Every function run shows up in the Inngest dashboard with per-step
  logs, retry history, and output.
- Failures retry per the `retries` count on each function (default 2).
- Terminal failures appear in Sentry via the nextjs error boundary (see
  `docs/OBSERVABILITY.md` once Step 11 ships).

---

## Adding a new function

1. Create `apps/app/inngest/functions/my-function.ts`.
2. Import `inngest` from `../client` and write:

   ```ts
   export const myFunction = inngest.createFunction(
     { id: 'my-function', name: 'Human-readable name', retries: 2 },
     [{ event: 'my/event-name' }],
     async ({ event, step }) => {
       // …
     },
   );
   ```

3. Add a new event type to the `Events` record in
   `apps/app/inngest/client.ts` so callers get strongly-typed
   `inngest.send({ name: '…', data: {…} })`.
4. Export the function from `apps/app/inngest/index.ts`.
5. Restart the Inngest dev relay (it reloads automatically on save, but
   a hard restart avoids stale registrations).

---

## Troubleshooting

**"Function not showing up in dashboard"** — Usually a stale dev
relay. Hit Ctrl+C, re-run `npx inngest-cli@latest dev`.

**"Event fired but function didn't run"** — Check that the event
`name` in `client.ts` exactly matches what you're sending. Inngest is
string-match.

**"Signature verification failed in prod"** — The `INNGEST_SIGNING_KEY`
env var doesn't match what Inngest expects. Rotate in the dashboard and
copy the new value into Vercel.
