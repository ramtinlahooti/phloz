import type { HealthStatus } from '@phloz/config';

/**
 * Single source of truth for how each health status is styled in the
 * canvas. The CSS variables come from `packages/ui/styles/globals.css`
 * `@theme` block — keep the names in sync.
 */
export const HEALTH_STATUS_CONFIG: Record<
  HealthStatus,
  { label: string; color: string; dotVar: string; description: string }
> = {
  working: {
    label: 'Working',
    color: 'var(--color-health-working)',
    dotVar: '--color-health-working',
    description: 'Verified recently; data is flowing.',
  },
  broken: {
    label: 'Broken',
    color: 'var(--color-health-broken)',
    dotVar: '--color-health-broken',
    description: 'Known to be failing — flagged by a teammate.',
  },
  missing: {
    label: 'Missing',
    color: 'var(--color-health-missing)',
    dotVar: '--color-health-missing',
    description: 'Should exist but hasn\'t been set up.',
  },
  unverified: {
    label: 'Unverified',
    color: 'var(--color-health-unverified)',
    dotVar: '--color-health-unverified',
    description: 'No recent verification — trust with caution.',
  },
};

/** Format a `lastVerifiedAt` timestamp as a compact relative string. */
export function formatLastVerified(ts: Date | null | undefined): string {
  if (!ts) return 'Never';
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - ts.getTime()) / 1000),
  );
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}
