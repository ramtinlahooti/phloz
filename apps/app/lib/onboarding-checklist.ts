/**
 * Onboarding checklist: the six things a new workspace owner should
 * do in their first week so Phloz actually "clicks." Each step is
 * derived from live DB state — never a persisted flag — so the
 * checklist can't drift out of sync with reality.
 *
 * We only surface this on the workspace dashboard. When all six are
 * complete, the caller should hide the component entirely; there's no
 * value in showing a fully-ticked checklist forever.
 *
 * Ordering matters: each step builds on the previous one. "Add your
 * first client" is the gate to everything else (tasks/messages/nodes
 * are scoped to clients). Invite teammate is last because it's
 * collaborative, and a solo owner can get real value from Phloz
 * before inviting anyone.
 */

export type OnboardingStepId =
  | 'add_client'
  | 'add_contact'
  | 'create_task'
  | 'create_tracking_node'
  | 'send_message'
  | 'invite_teammate';

export interface OnboardingStep {
  id: OnboardingStepId;
  /** Action phrase: imperative. */
  title: string;
  /** Short one-liner shown under the title. */
  description: string;
  /** Deep-link the user should land on when they click the row. */
  href: string;
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  doneCount: number;
  totalCount: number;
  /** `true` when every step is checked. Caller typically hides the
   *  whole card in that case. */
  complete: boolean;
  /** The first not-yet-done step, or `null` when complete. UI can
   *  highlight this as "next up". */
  nextStep: OnboardingStep | null;
}

/**
 * Inputs are raw booleans/counts derived from the existing dashboard
 * queries — no extra DB reads here beyond what's already fetched.
 */
export interface OnboardingInputs {
  workspaceId: string;
  clientCount: number;
  /** Any `client_contacts` row in this workspace. */
  hasContact: boolean;
  /** Any `tasks` row, any status. */
  hasTask: boolean;
  /** Any `tracking_nodes` row in this workspace. */
  hasTrackingNode: boolean;
  /** Any `messages` row (inbound or outbound, any channel). */
  hasMessage: boolean;
  /** Member count > 1 (i.e. someone beyond the owner has joined).
   *  Pending invitations don't count — we want the *accepted* signal. */
  memberCount: number;
}

export function computeOnboardingState(
  i: OnboardingInputs,
): OnboardingState {
  const base = `/${i.workspaceId}`;
  const firstClientId: string | null = null; // unused here; UI links to /clients

  const steps: OnboardingStep[] = [
    {
      id: 'add_client',
      title: 'Add your first client',
      description: 'Clients are the root of everything else in Phloz.',
      href: `${base}/clients/new`,
      done: i.clientCount > 0,
    },
    {
      id: 'add_contact',
      title: 'Add a contact for that client',
      description:
        'Contacts let you send messages and hand out portal access.',
      href: `${base}/clients`,
      done: i.hasContact,
    },
    {
      id: 'create_task',
      title: 'Create a task',
      description:
        'Start tracking work — a kickoff checklist, an SEO audit, anything.',
      href: `${base}/tasks`,
      done: i.hasTask,
    },
    {
      id: 'create_tracking_node',
      title: 'Map one client\'s tracking setup',
      description:
        'Drop a GA4 property or GTM container onto the map — this is the Phloz moat.',
      href: `${base}/clients`,
      done: i.hasTrackingNode,
    },
    {
      id: 'send_message',
      title: 'Send a client message',
      description:
        'Email or internal note — once the first goes out, the inbox fills itself.',
      href: `${base}/messages`,
      done: i.hasMessage,
    },
    {
      id: 'invite_teammate',
      title: 'Invite a teammate',
      description: 'Get someone else in here so you can delegate.',
      href: `${base}/team`,
      done: i.memberCount > 1,
    },
  ];

  void firstClientId;

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    doneCount,
    totalCount: steps.length,
    complete: doneCount === steps.length,
    nextStep,
  };
}
