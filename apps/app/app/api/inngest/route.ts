import { serve } from 'inngest/next';

import { inngest, inngestFunctions } from '@/inngest';

/**
 * Inngest HTTP endpoint. Serves every registered function plus the
 * introspection handshake Inngest uses for deploy-time registration.
 *
 * In dev, run `npx inngest-cli@latest dev` alongside `pnpm dev`.
 * See `docs/INNGEST-SETUP.md`.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

// v4: `INNGEST_SIGNING_KEY` is read from the environment automatically
// — no need to pass it here.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...inngestFunctions],
});
