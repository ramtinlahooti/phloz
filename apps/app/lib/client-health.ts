/**
 * Client health scoring. Pure computation — no DB access here; callers
 * pass already-fetched aggregates. Keeps the scoring testable and
 * lets callers batch the reads that feed it.
 *
 * Score is 0–100. Semantics:
 *   - 70–100 → healthy (green)
 *   - 40–69  → at_risk (amber)
 *   - 0–39   → needs_attention (red)
 *
 * Archived clients always score 0 with tier `needs_attention` — they
 * shouldn't factor into "who do I owe work to" rollups. Callers can
 * filter them out at render time if they don't want to show them at all.
 *
 * Keep the weights here conservative and explainable. A `reasons` array
 * comes back with every score so the UI can show *why* a client is red
 * — agencies trust a scoring system more when it justifies itself.
 */

export type HealthTier = 'healthy' | 'at_risk' | 'needs_attention';

export interface HealthInputs {
  /** Archived clients short-circuit to score 0. */
  archived: boolean;
  /** Most recent `clients.last_activity_at`. `null` = never active. */
  lastActivityAt: Date | null;
  /** Open (non-done, non-archived) tasks past their due_date. */
  overdueTaskCount: number;
  /** Inbound messages in the last 30 days newer than the last outbound. */
  unrepliedInboundCount: number;
  /** Tracking-map nodes currently flagged `broken`. */
  brokenNodeCount: number;
  /** Tracking-map nodes currently flagged `missing`. */
  missingNodeCount: number;
}

export interface HealthResult {
  score: number;
  tier: HealthTier;
  reasons: string[];
}

/** Days since a Date; `null` → very large number so callers can treat
 *  "never" as "maximally stale". */
function ageDays(d: Date | null): number {
  if (d === null) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeClientHealth(inputs: HealthInputs): HealthResult {
  if (inputs.archived) {
    return { score: 0, tier: 'needs_attention', reasons: ['Archived'] };
  }

  let score = 100;
  const reasons: string[] = [];

  // Inactivity: the nightly cron maintains `last_activity_at`, so this
  // captures "no task, message, file, or map edit recently". Penalties
  // are stepped so a 10-day quiet window is a small nudge, not alarm.
  const days = ageDays(inputs.lastActivityAt);
  if (days >= 60) {
    score -= 60;
    reasons.push(
      days === Number.POSITIVE_INFINITY
        ? 'Never active'
        : `No activity for ${days}d`,
    );
  } else if (days >= 30) {
    score -= 30;
    reasons.push(`No activity for ${days}d`);
  } else if (days >= 7) {
    score -= 10;
    reasons.push(`Quiet for ${days}d`);
  }

  // Overdue tasks: capped so a backlog of 20 overdue tasks doesn't
  // drown out other signals. Each is -10 up to -30.
  if (inputs.overdueTaskCount > 0) {
    score -= Math.min(30, inputs.overdueTaskCount * 10);
    reasons.push(
      `${inputs.overdueTaskCount} overdue task${
        inputs.overdueTaskCount === 1 ? '' : 's'
      }`,
    );
  }

  // Unreplied inbound: -5 each up to -20.
  if (inputs.unrepliedInboundCount > 0) {
    score -= Math.min(20, inputs.unrepliedInboundCount * 5);
    reasons.push(
      `${inputs.unrepliedInboundCount} unreplied message${
        inputs.unrepliedInboundCount === 1 ? '' : 's'
      }`,
    );
  }

  // Broken tracking nodes: -5 each up to -20. "Broken" is the strongest
  // tracking signal ("pixel is firing but conversions aren't arriving").
  if (inputs.brokenNodeCount > 0) {
    score -= Math.min(20, inputs.brokenNodeCount * 5);
    reasons.push(
      `${inputs.brokenNodeCount} broken tracking node${
        inputs.brokenNodeCount === 1 ? '' : 's'
      }`,
    );
  }

  // Missing nodes: softer than broken (-3 each up to -12). They're
  // "we haven't set this up yet" rather than "live and failing".
  if (inputs.missingNodeCount > 0) {
    score -= Math.min(12, inputs.missingNodeCount * 3);
    reasons.push(
      `${inputs.missingNodeCount} missing tracking node${
        inputs.missingNodeCount === 1 ? '' : 's'
      }`,
    );
  }

  const bounded = Math.max(0, Math.min(100, score));
  const tier: HealthTier =
    bounded >= 70 ? 'healthy' : bounded >= 40 ? 'at_risk' : 'needs_attention';

  return { score: bounded, tier, reasons };
}

/** Tailwind class suffixes per tier. Used by the row dot + badge. */
export const HEALTH_COLORS: Record<
  HealthTier,
  { dot: string; badge: string; label: string }
> = {
  healthy: {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-400/50 text-emerald-400',
    label: 'Healthy',
  },
  at_risk: {
    dot: 'bg-amber-400',
    badge: 'border-amber-400/50 text-amber-400',
    label: 'At risk',
  },
  needs_attention: {
    dot: 'bg-red-400',
    badge: 'border-red-400/50 text-red-400',
    label: 'Needs attention',
  },
};
