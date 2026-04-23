import { eq } from 'drizzle-orm';

import { createServiceRoleSupabase } from '@phloz/auth/server';
import { getStripe, isStripeConfigured } from '@phloz/billing';
import { getDb, schema } from '@phloz/db/client';
import { sendPasswordReset } from '@phloz/email'; // placeholder — replace when trial-ending template ships

import { inngest } from '../client';

/**
 * Daily reminder for workspaces whose trial ends in ~3 days.
 *
 * We don't store `trial_ends_at` locally — we ask Stripe. That keeps the
 * source of truth in one place and means we pick up trial extensions
 * the dashboard operator might grant manually.
 *
 * The actual email template for "trial ending" ships with the
 * observability step (Step 11). For now we log the intent so the
 * function is wired end-to-end.
 */
export const sendTrialEndingReminder = inngest.createFunction(
  {
    id: 'send-trial-ending-reminder',
    name: 'Send trial-ending reminder (daily)',
    retries: 2,
    // 15:00 UTC = mid-morning Pacific
    triggers: [{ cron: 'TZ=UTC 0 15 * * *' }],
  },
  async ({ step }) => {
    if (!isStripeConfigured()) {
      return { skipped: true, reason: 'stripe_not_configured' };
    }

    const db = getDb();

    // Step 1: find every workspace currently marked as trialing.
    const trialingWorkspaces = await step.run('load-trialing', async () => {
      return db
        .select({
          id: schema.workspaces.id,
          ownerUserId: schema.workspaces.ownerUserId,
          stripeSubscriptionId: schema.workspaces.stripeSubscriptionId,
          name: schema.workspaces.name,
        })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.subscriptionStatus, 'trialing'));
    });

    if (trialingWorkspaces.length === 0) {
      return { scanned: 0, reminded: 0 };
    }

    const stripe = getStripe();
    const supabase = await createServiceRoleSupabase();
    const now = Math.floor(Date.now() / 1000);
    const THREE_DAYS = 3 * 24 * 60 * 60;

    let reminded = 0;

    for (const ws of trialingWorkspaces) {
      if (!ws.stripeSubscriptionId) continue;

      // Step 2: fetch the live subscription from Stripe to get trial_end.
      const sub = await step.run(`stripe-${ws.id}`, async () =>
        stripe.subscriptions.retrieve(ws.stripeSubscriptionId!),
      );

      if (!sub.trial_end) continue;
      const secondsLeft = sub.trial_end - now;
      if (secondsLeft <= 0 || secondsLeft > THREE_DAYS) continue;

      // Step 3: look up the owner's email via the Supabase Admin API.
      const { data: userData } = await step.run(`user-${ws.id}`, async () => {
        if (!ws.ownerUserId) return { data: { user: null } };
        return supabase.auth.admin.getUserById(ws.ownerUserId);
      });
      const email = userData?.user?.email;
      if (!email) continue;

      // Step 4: emit the reminder. Using sendPasswordReset as a stand-in
      // until the dedicated "trial ending" template lands in Step 11.
      await step.run(`email-${ws.id}`, async () =>
        sendPasswordReset({
          to: email,
          resetUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com'}/${ws.id}/billing`,
        }),
      );

      await step.sendEvent(`fanout-${ws.id}`, {
        name: 'billing/trial-ending',
        data: {
          workspaceId: ws.id,
          daysLeft: Math.ceil(secondsLeft / 86400),
        },
      });

      reminded++;
    }

    return {
      scanned: trialingWorkspaces.length,
      reminded,
    };
  },
);
