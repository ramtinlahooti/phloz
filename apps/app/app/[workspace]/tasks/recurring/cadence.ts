/**
 * Cadence helpers shared by the create form, the list rendering,
 * and the Inngest cron that fires recurring tasks.
 *
 * Templates fire at 06:00 in the workspace's local timezone. The
 * cron runs hourly; on the matching local hour, it checks each
 * template's cadence predicate against today's local date and fires
 * if `last_run_at` isn't already on the same local date.
 */

export const RECURRING_CADENCES = ['daily', 'weekly', 'monthly'] as const;
export type RecurringCadence = (typeof RECURRING_CADENCES)[number];

export const RECURRING_LOCAL_HOUR = 6;

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * One-line human description of a cadence — used in lists, emails,
 * and the dialog preview line. Intentionally short.
 */
export function describeCadence(input: {
  cadence: RecurringCadence;
  weekday: number | null;
  dayOfMonth: number | null;
}): string {
  switch (input.cadence) {
    case 'daily':
      return 'Every day at 6 AM';
    case 'weekly': {
      const day =
        typeof input.weekday === 'number' && input.weekday >= 0 && input.weekday <= 6
          ? WEEKDAYS[input.weekday]
          : 'Monday';
      return `Every ${day} at 6 AM`;
    }
    case 'monthly': {
      const d = typeof input.dayOfMonth === 'number' ? input.dayOfMonth : 1;
      return `Every month on the ${ordinal(d)} at 6 AM`;
    }
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
}

/**
 * Local date parts (year/month/day/hour) for the given UTC moment in
 * the supplied IANA timezone. Falls back to UTC on bad input. Used
 * by the Inngest cron to decide whether each template's predicate
 * matches "today" in the workspace's clock.
 */
export function localDateParts(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; weekday: number } {
  const tz = (timezone ?? '').trim() || 'UTC';
  let parts: Record<string, string> = {};
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    parts = Object.fromEntries(
      fmt
        .formatToParts(date)
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value]),
    );
  } catch {
    return localDateParts(date, 'UTC');
  }
  const weekdayIndex = (WEEKDAY_SHORT as readonly string[]).indexOf(
    parts.weekday ?? 'Sun',
  );
  return {
    year: parseInt(parts.year ?? '1970', 10),
    month: parseInt(parts.month ?? '1', 10),
    day: parseInt(parts.day ?? '1', 10),
    hour: parseInt(parts.hour ?? '0', 10) % 24,
    weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
  };
}

const WEEKDAY_SHORT = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/**
 * Does the cadence match the supplied local date?
 *
 * Monthly cadence is end-of-month-aware: if `day_of_month` is 31 and
 * the current month only has 30 days, the predicate fires on the 30th
 * (last day) so January-style configurations don't silently skip
 * shorter months.
 */
export function cadenceMatches(input: {
  cadence: RecurringCadence;
  weekday: number | null;
  dayOfMonth: number | null;
  local: { year: number; month: number; day: number; weekday: number };
}): boolean {
  switch (input.cadence) {
    case 'daily':
      return true;
    case 'weekly':
      return input.weekday !== null && input.local.weekday === input.weekday;
    case 'monthly': {
      if (input.dayOfMonth === null) return false;
      const lastDay = lastDayOfMonth(input.local.year, input.local.month);
      const target = Math.min(input.dayOfMonth, lastDay);
      return input.local.day === target;
    }
  }
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-12; Date(yr, month, 0) is the last day of `month` in 1-indexed terms.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Was the last run on the same local-date as the current local-date?
 * Used to suppress double-fires inside the same hour-window when
 * Inngest retries a step.
 */
export function sameLocalDate(
  lastRunAt: Date | null,
  now: Date,
  timezone: string,
): boolean {
  if (!lastRunAt) return false;
  const a = localDateParts(lastRunAt, timezone);
  const b = localDateParts(now, timezone);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Next firing local-date for a template. Returns a Y-M-D triple in
 * the supplied timezone — purely for display in the per-template
 * cards. The cron's authoritative fire decision is still
 * `cadenceMatches` + `sameLocalDate` at run-time.
 *
 * Walks forward day-by-day from `now` (capped at 366 lookups) and
 * returns the first day whose cadence matches AND comes after
 * `lastRunAt` if it's already today. Returns null when nothing
 * matches inside the lookahead window — should never happen for
 * valid daily/weekly/monthly templates but the guard keeps callers
 * safe from infinite loops on malformed data.
 */
export function nextFireLocalDate(input: {
  cadence: RecurringCadence;
  weekday: number | null;
  dayOfMonth: number | null;
  lastRunAt: Date | null;
  now: Date;
  timezone: string;
}): { year: number; month: number; day: number } | null {
  const tzNow = localDateParts(input.now, input.timezone);
  // If we haven't fired today yet AND today matches, today is next.
  const todayMatches = cadenceMatches({
    cadence: input.cadence,
    weekday: input.weekday,
    dayOfMonth: input.dayOfMonth,
    local: tzNow,
  });
  const ranToday = sameLocalDate(input.lastRunAt, input.now, input.timezone);
  if (todayMatches && !ranToday) {
    return { year: tzNow.year, month: tzNow.month, day: tzNow.day };
  }
  // Otherwise walk forward up to 366 days. UTC-millisecond addition
  // is fine because we re-resolve in the workspace timezone after
  // each step.
  for (let i = 1; i <= 366; i += 1) {
    const stepped = new Date(input.now.getTime() + i * 86_400_000);
    const local = localDateParts(stepped, input.timezone);
    if (
      cadenceMatches({
        cadence: input.cadence,
        weekday: input.weekday,
        dayOfMonth: input.dayOfMonth,
        local,
      })
    ) {
      return { year: local.year, month: local.month, day: local.day };
    }
  }
  return null;
}

/** Human-friendly "next fire" string. e.g. "Mon, Apr 27" or "Today". */
export function describeNextFire(input: {
  cadence: RecurringCadence;
  weekday: number | null;
  dayOfMonth: number | null;
  lastRunAt: Date | null;
  now: Date;
  timezone: string;
}): string | null {
  const next = nextFireLocalDate(input);
  if (!next) return null;
  // Build a Date in the target tz at noon — noon avoids DST edge
  // cases where midnight could roll into the previous day in the
  // formatter's UTC interpretation.
  const probe = new Date(
    Date.UTC(next.year, next.month - 1, next.day, 12, 0, 0),
  );
  const tzToday = localDateParts(input.now, input.timezone);
  const isToday =
    next.year === tzToday.year &&
    next.month === tzToday.month &&
    next.day === tzToday.day;
  if (isToday) return 'Today';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(probe);
}
