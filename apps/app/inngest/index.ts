/**
 * Inngest function registry. Export every function here so the
 * `/api/inngest` route handler can serve them in one place.
 *
 * Add a new function: create the file in `./functions/`, export the
 * function, then add it to the array below.
 */
import { onClientAdded, onWorkspaceCreated } from './functions/on-workspace-created';
import { recomputeActiveClientCount } from './functions/recompute-active-client-count';
import { sendTrialEndingReminder } from './functions/send-trial-ending-reminder';

export { inngest } from './client';
export type { PhlozInngestEvents } from './client';

export const inngestFunctions = [
  recomputeActiveClientCount,
  sendTrialEndingReminder,
  onWorkspaceCreated,
  onClientAdded,
] as const;
