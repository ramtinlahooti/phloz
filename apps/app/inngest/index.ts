/**
 * Inngest function registry. Export every function here so the
 * `/api/inngest` route handler can serve them in one place.
 *
 * Add a new function: create the file in `./functions/`, export the
 * function, then add it to the array below.
 */
import { auditWeeklyFunction } from './functions/audit-weekly';
import { onClientAdded, onWorkspaceCreated } from './functions/on-workspace-created';
import { processRecurringTasksFunction } from './functions/process-recurring-tasks';
import { recomputeActiveClientCount } from './functions/recompute-active-client-count';
import { sendDailyDigestFunction } from './functions/send-daily-digest';
import { sendTrialEndingReminder } from './functions/send-trial-ending-reminder';

export { inngest, INNGEST_EVENT_NAMES } from './client';
export type { PhlozInngestEventName } from './client';

export const inngestFunctions = [
  recomputeActiveClientCount,
  sendTrialEndingReminder,
  sendDailyDigestFunction,
  processRecurringTasksFunction,
  auditWeeklyFunction,
  onWorkspaceCreated,
  onClientAdded,
] as const;
