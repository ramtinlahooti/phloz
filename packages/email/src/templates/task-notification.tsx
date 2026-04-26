import { Button, Heading, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './layout';

/**
 * Generic per-task notification email. Used by every event kind
 * that's "something happened on a task" — assignment, mention,
 * approval state change, recurring spawn — with the variant string
 * controlling the headline + body copy. Keeping one template (with
 * variant text) instead of one per event keeps the visual identity
 * consistent and the email package small.
 */
export type TaskNotificationVariant =
  | 'task_assignment'
  | 'task_mention'
  | 'task_approval'
  | 'recurring_task_created';

export interface TaskNotificationEmailProps {
  variant: TaskNotificationVariant;
  /** The recipient's display name, used in the greeting. */
  recipientName: string;
  /** The agency workspace name, used for context. */
  workspaceName: string;
  /** Who triggered the event. `null` for system events (recurring
   *  spawn, approval state from a portal user, etc.). */
  actorName: string | null;
  taskTitle: string;
  /** Optional human-readable client name; null for workspace tasks. */
  clientName: string | null;
  /** ISO date string or pre-formatted "Apr 28"; the template just
   *  renders it as-is. Null when the task has no due date. */
  dueLabel: string | null;
  /** Deep link to the task in the product app. */
  taskUrl: string;
  /** Optional context line below the headline (e.g. an approval
   *  comment or a mention excerpt). Skipped when null. */
  contextLine: string | null;
}

const HEADLINES: Record<TaskNotificationVariant, (p: TaskNotificationEmailProps) => string> = {
  task_assignment: (p) =>
    p.actorName
      ? `${p.actorName} assigned you a task`
      : 'A task was assigned to you',
  task_mention: (p) =>
    p.actorName ? `${p.actorName} mentioned you` : 'You were mentioned',
  task_approval: () => 'Client approval state changed',
  recurring_task_created: () => 'A recurring task is due',
};

const BODIES: Record<TaskNotificationVariant, string> = {
  task_assignment:
    'You can view the task, change its priority, or reassign it from your Phloz dashboard.',
  task_mention:
    'Open the task to see the full context and reply with a comment.',
  task_approval:
    'Open the task to see the latest approval state and any comment from the client.',
  recurring_task_created:
    'A recurring template just spawned this task instance. Update the status when you have a moment.',
};

export function TaskNotificationEmail(props: TaskNotificationEmailProps) {
  const headline = HEADLINES[props.variant](props);
  const body = BODIES[props.variant];

  return (
    <EmailLayout preview={`${headline} — ${props.taskTitle}`}>
      <Heading className="m-0 mb-2 text-2xl font-semibold tracking-tight">
        {headline}
      </Heading>
      <Text className="m-0 mb-4 text-sm leading-6 text-neutral-700">
        Hi {props.recipientName} — heads up from {props.workspaceName}.
      </Text>
      <div className="mb-5 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <Text className="m-0 text-base font-semibold text-neutral-900">
          {props.taskTitle}
        </Text>
        <Text className="m-0 mt-1 text-xs text-neutral-600">
          {[
            props.clientName,
            props.dueLabel ? `Due ${props.dueLabel}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Workspace task'}
        </Text>
        {props.contextLine && (
          <Text className="m-0 mt-2 text-xs italic text-neutral-600">
            “{props.contextLine}”
          </Text>
        )}
      </div>
      <Text className="m-0 mb-5 text-sm leading-6 text-neutral-700">
        {body}
      </Text>
      <Button
        href={props.taskUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        View task
      </Button>
      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        Or open this link directly:
        <br />
        <Link href={props.taskUrl} className="text-neutral-500 underline">
          {props.taskUrl}
        </Link>
      </Text>
      <Text className="m-0 mt-4 text-xs leading-5 text-neutral-500">
        Don&apos;t want these? Adjust your preferences at
        Settings → Notifications inside Phloz.
      </Text>
    </EmailLayout>
  );
}

TaskNotificationEmail.PreviewProps = {
  variant: 'task_assignment',
  recipientName: 'Alex',
  workspaceName: 'Acme Agency',
  actorName: 'Ramtin Lahooti',
  taskTitle: 'Review PPC creative for ClientCo',
  clientName: 'ClientCo',
  dueLabel: 'Apr 28',
  taskUrl: 'https://app.phloz.com/<workspace>/tasks?task=abc',
  contextLine: null,
} satisfies TaskNotificationEmailProps;

export default TaskNotificationEmail;
