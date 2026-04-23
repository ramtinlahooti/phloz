import { customAlphabet } from 'nanoid';

import { getDb, schema } from '@phloz/db/client';

import { inngest } from '../client';

const INBOUND_DOMAIN =
  process.env.INBOUND_EMAIL_DOMAIN ?? 'inbound.phloz.com';

// Opaque 12-char ids (see ARCHITECTURE §10.1): drop vowels + ambiguous chars.
const inboundLocalPart = customAlphabet('bcdfghjkmnpqrstvwxz23456789', 12);

/**
 * After a workspace is created, seed any per-workspace defaults that
 * don't block the onboarding flow.
 *
 * Runs async via Inngest rather than inline in the create-workspace
 * server action so onboarding stays snappy and we retry on failure.
 *
 * V1 scope: nothing yet (each client gets its own inbound address when
 * added, not at workspace creation). This function is here to claim the
 * wiring — when later phases add workspace-scoped defaults (e.g. a
 * starter tracking-map template, a demo client), they plug in here.
 */
export const onWorkspaceCreated = inngest.createFunction(
  {
    id: 'on-workspace-created',
    name: 'Workspace created — seed defaults',
    retries: 2,
    triggers: [{ event: 'workspace/created' }],
  },
  async ({ event, step }) => {
    const { workspaceId } = (event?.data ?? {}) as { workspaceId: string };

    // V2 hook: seed tracking-map template + demo client here.
    // For now the function is a no-op beyond echoing the workspace id,
    // which keeps the Inngest dashboard showing the event firing.
    await step.run('noop-v1', async () => ({ workspaceId }));

    return { workspaceId };
  },
);

/**
 * When a client is added, mint and store its opaque inbound email
 * address so forwarded emails can route back to the right client.
 */
export const onClientAdded = inngest.createFunction(
  {
    id: 'on-client-added-provision-inbound',
    name: 'Provision inbound email address for new client',
    retries: 2,
    triggers: [{ event: 'workspace/client-added' }],
  },
  async ({ event, step }) => {
    const { workspaceId, clientId } = (event?.data ?? {}) as {
      workspaceId: string;
      clientId: string;
    };
    const db = getDb();

    const address = `client-${inboundLocalPart()}@${INBOUND_DOMAIN}`;

    await step.run('insert-inbound-address', async () =>
      db.insert(schema.inboundEmailAddresses).values({
        workspaceId,
        clientId,
        address,
        active: true,
      }),
    );

    return { address };
  },
);

