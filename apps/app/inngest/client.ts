import { EventSchemas, Inngest } from 'inngest';

/**
 * Strongly-typed Inngest event catalog. Add new events here first —
 * the `functions/` directory reads these types for `event.data` shape.
 *
 * Naming: `<domain>/<action>`. Keep verbs in past tense where it fits
 * ("workspace/client-added") and imperative when the event triggers work
 * ("billing/recompute-active-clients").
 */
type Events = {
  'workspace/created': {
    data: { workspaceId: string; ownerUserId: string };
  };
  'workspace/client-added': {
    data: { workspaceId: string; clientId: string };
  };
  'billing/recompute-active-clients': {
    data: { workspaceId?: string };
  };
  'billing/trial-ending': {
    data: { workspaceId: string; daysLeft: number };
  };
  'stripe/subscription-updated': {
    data: { workspaceId: string; subscriptionId: string; status: string };
  };
};

/**
 * Singleton Inngest client. `signingKey` only required in production —
 * local dev uses the `inngest dev` relay without a key.
 */
export const inngest = new Inngest({
  id: 'phloz',
  schemas: new EventSchemas().fromRecord<Events>(),
  eventKey: process.env.INNGEST_EVENT_KEY,
});

export type PhlozInngestEvents = Events;
