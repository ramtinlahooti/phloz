# @phloz/auth

Supabase auth helpers, session + role checks, and the client-portal
magic-link flow.

## Usage

```ts
// server component or server action
import { requireUser, requireAdminOrOwner } from '@phloz/auth';

const user = await requireUser();                 // throws AuthError if unauth
const { role } = await requireAdminOrOwner(wsId); // throws if not owner/admin
```

```ts
// middleware.ts
import { updateSession } from '@phloz/auth';

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  // route-guard logic using `user`
  return response;
}
```

```ts
// browser client
'use client';
import { createBrowserSupabase } from '@phloz/auth';

const supabase = createBrowserSupabase();
await supabase.auth.signInWithPassword({ email, password });
```

## Custom JWT claims

`user_metadata.active_workspace_id` is mirrored into the JWT as a custom
claim via the Supabase Custom Access Token hook. Install it once per
Supabase project:

1. Apply `src/hooks/custom-access-token-hook.sql` to Postgres.
2. Supabase Dashboard → Authentication → Hooks → Custom Access Token →
   select `public.phloz_custom_access_token_hook`.

`switchWorkspace(id)` updates the metadata and forces a session refresh
so the new claim is visible on the next request.

## Client portal

```ts
import { generatePortalMagicLink, validatePortalMagicLink } from '@phloz/auth';

const { url } = await generatePortalMagicLink(contactId);
// email url to the client; on click:
const link = await validatePortalMagicLink(token);
if (!link) return notFound();
```

Magic links expire after 7 days (see `PORTAL_MAGIC_LINK_TTL_DAYS` in
`@phloz/config`).

## Errors

All throw `AuthError` with a typed `code`:

- `unauthenticated` — no session cookie
- `forbidden` — generic denied
- `not_a_member` — user isn't in that workspace
- `role_denied` — user's role not allowed
- `invalid_workspace` — no active workspace set
- `portal_link_expired` / `portal_link_invalid` — magic-link issues

Catch in the route handler / server action and map to a friendly response.
