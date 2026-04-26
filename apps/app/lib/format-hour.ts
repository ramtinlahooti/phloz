/**
 * Format an hour-of-day (0-23) as a 12-hour AM/PM string. Used by
 * the digest hour selector + the Team page's per-member badge so
 * both surfaces speak the same language ("9 AM" not "09:00").
 */
export function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

/** Workspace-default digest hour. Null on `workspace_members.digest_hour`
 *  means "use this constant". Mirrored in the cron's
 *  DIGEST_DEFAULT_HOUR — keep in sync. */
export const DEFAULT_DIGEST_HOUR = 9;
