import { eq } from 'drizzle-orm';

import { getActiveClientCount, getTier } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';

import { inngest } from '../client';

/**
 * Nightly job — for every workspace, recompute the active-client count
 * and warn the owner when they're near or over their tier limit.
 *
 * Runs at 09:00 UTC daily (late evening Pacific, safe window for a
 * non-user-blocking chore).
 *
 * The actual tier gate in `@phloz/billing/gates` computes this live on
 * every add-client attempt, so correctness doesn't depend on this
 * function — it's purely for notifications + telemetry.
 */
export const recomputeActiveClientCount = inngest.createFunction(
  {
    id: 'recompute-active-client-count',
    name: 'Recompute active-client counts (nightly)',
    concurrency: { limit: 4 },
    retries: 2,
    triggers: [
      { cron: 'TZ=UTC 0 9 * * *' },
      { event: 'billing/recompute-active-clients' },
    ],
  },
  async ({ event, step }) => {
    const db = getDb();

    // Either run for one workspace (manual trigger) or every workspace
    // (cron trigger with no event data).
    const eventData = (event?.data ?? {}) as { workspaceId?: string };
    const targetedWorkspaceId =
      event?.name === 'billing/recompute-active-clients'
        ? eventData.workspaceId
        : undefined;

    const workspaces = await step.run('load-workspaces', async () => {
      const rows = targetedWorkspaceId
        ? await db
            .select({ id: schema.workspaces.id, tier: schema.workspaces.tier })
            .from(schema.workspaces)
            .where(eq(schema.workspaces.id, targetedWorkspaceId))
        : await db
            .select({ id: schema.workspaces.id, tier: schema.workspaces.tier })
            .from(schema.workspaces);
      return rows;
    });

    const results: Array<{
      workspaceId: string;
      tier: string;
      activeCount: number;
      limit: number | 'unlimited';
      overLimit: boolean;
      approachingLimit: boolean;
    }> = [];

    for (const ws of workspaces) {
      const count = await step.run(`count-${ws.id}`, () =>
        getActiveClientCount(ws.id),
      );
      const tier = getTier(ws.tier);
      const overLimit =
        tier.clientLimit !== 'unlimited' && count >= tier.clientLimit;
      const approachingLimit =
        tier.clientLimit !== 'unlimited' &&
        count >= Math.ceil(tier.clientLimit * 0.8) &&
        count < tier.clientLimit;
      results.push({
        workspaceId: ws.id,
        tier: ws.tier,
        activeCount: count,
        limit: tier.clientLimit,
        overLimit,
        approachingLimit,
      });
    }

    return {
      scanned: workspaces.length,
      overLimit: results.filter((r) => r.overLimit).length,
      approachingLimit: results.filter((r) => r.approachingLimit).length,
      results,
    };
  },
);
