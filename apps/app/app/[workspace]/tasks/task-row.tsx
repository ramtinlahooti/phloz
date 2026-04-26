'use client';

import { AlertCircle, CheckCircle2, Circle, CircleDashed, Clock, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@phloz/ui';
import type {
  ApprovalState,
  Department,
  TaskPriority,
  TaskStatus,
  TaskVisibility,
} from '@phloz/config';
import { TASK_STATUSES } from '@phloz/config';

import type { MentionMember } from '@/components/mention-composer';

import { TaskDetailDialog } from './task-detail-dialog';
import {
  deleteTaskAction,
  setTaskApprovalAction,
  updateTaskAction,
} from './actions';

export type TaskRowModel = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  department: Department;
  visibility: TaskVisibility;
  dueDate: Date | null;
  clientId: string | null;
  clientName: string | null;
  approvalState: ApprovalState;
  /** Membership id of the current assignee, if any. */
  assigneeMembershipId: string | null;
  /**
   * Display name of the assignee for the row (e.g. "Sarah", "You").
   * Derived server-side by the page builder so TaskRow doesn't need
   * to re-fetch names. `null` = unassigned.
   */
  assigneeLabel: string | null;
  /** `true` when the assignee is the current viewer. Used to render a
   *  primary-tinted pill rather than a neutral avatar. */
  assigneeIsSelf: boolean;
  /**
   * Subtask rollup. `undefined` / `total === 0` means no subtasks — the
   * pill doesn't render. Aggregated server-side by the page builder.
   */
  subtaskStats?: { total: number; done: number };
};

/** Lightweight member option for assignee pickers. Built in the server
 *  component that renders the task list and threaded through TaskRow so
 *  TaskDetailDialog can show names in edit mode. */
export type MemberOption = { id: string; label: string };

const APPROVAL_BADGE: Record<
  ApprovalState,
  { label: string; className: string } | null
> = {
  none: null,
  pending: { label: 'Pending client', className: 'border-amber-400/50 text-amber-400' },
  approved: {
    label: 'Approved',
    className: 'border-emerald-400/50 text-emerald-400',
  },
  rejected: { label: 'Rejected', className: 'border-red-400/50 text-red-400' },
  needs_changes: {
    label: 'Changes requested',
    className: 'border-orange-400/50 text-orange-400',
  },
};

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: CircleDashed,
  blocked: AlertCircle,
  done: CheckCircle2,
  archived: Circle,
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: 'text-muted-foreground',
  medium: 'text-foreground/80',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

/** Single-character initial for the assignee avatar. "You" and UUID
 *  prefixes are handled by taking the first non-whitespace char. */
function assigneeInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';
  return trimmed[0]?.toUpperCase() ?? '?';
}

export function TaskRow({
  workspaceId,
  task,
  members,
  mentionMembers,
}: {
  workspaceId: string;
  task: TaskRowModel;
  /** Passed to TaskDetailDialog so its edit mode can offer an assignee
   *  picker. Omit when the caller hasn't fetched members (picker hidden). */
  members?: MemberOption[];
  /** Richer member list for the comment composer's `@` autocomplete.
   *  Forwarded as-is to TaskDetailDialog. */
  mentionMembers?: MentionMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const deepLinkedTaskId = urlParams?.get('task') ?? null;
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatus>(task.status);
  const [detailOpen, setDetailOpen] = useState(false);
  const StatusIcon = STATUS_ICONS[optimisticStatus];

  // Deep-link support: when `?task=<id>` matches this row, auto-open
  // the detail dialog. Clearing the param on close keeps the URL
  // tidy when the user dismisses via the X or Escape. `router.replace`
  // avoids piling up back-button history as users browse tasks.
  useEffect(() => {
    if (deepLinkedTaskId === task.id) {
      setDetailOpen(true);
    }
  }, [deepLinkedTaskId, task.id]);

  function handleOpenChange(next: boolean) {
    setDetailOpen(next);
    // Only clear `?task=` when we were the deep-linked target — don't
    // strip someone else's param if this row's dialog was opened via
    // a direct click instead of the URL.
    if (!next && deepLinkedTaskId === task.id) {
      const params = new URLSearchParams(urlParams?.toString() ?? '');
      params.delete('task');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  async function changeStatus(next: TaskStatus) {
    setOptimisticStatus(next);
    startTransition(async () => {
      const res = await updateTaskAction({
        workspaceId,
        id: task.id,
        status: next,
      });
      if (!res.ok) {
        toast.error(res.error);
        setOptimisticStatus(task.status);
        return;
      }
      router.refresh();
    });
  }

  async function remove() {
    if (!confirm('Delete this task?')) return;
    const res = await deleteTaskAction({ workspaceId, id: task.id });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Deleted');
    router.refresh();
  }

  async function toggleApproval(next: 'pending' | 'none') {
    const res = await setTaskApprovalAction({
      workspaceId,
      id: task.id,
      state: next,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      next === 'pending'
        ? 'Approval requested — visible in the portal'
        : 'Approval reset',
    );
    router.refresh();
  }

  const overdue =
    task.dueDate !== null &&
    optimisticStatus !== 'done' &&
    task.dueDate.getTime() < Date.now();

  return (
    <>
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-muted"
          title={optimisticStatus.replace('_', ' ')}
        >
          <StatusIcon
            className={`size-4 ${
              optimisticStatus === 'done'
                ? 'text-[var(--color-health-working)]'
                : 'text-muted-foreground'
            }`}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {TASK_STATUSES.map((s) => {
            const I = STATUS_ICONS[s];
            return (
              <DropdownMenuItem
                key={s}
                onClick={() => changeStatus(s)}
                className="capitalize"
              >
                <I className="size-4" />
                {s.replace('_', ' ')}
              </DropdownMenuItem>
            );
          })}
          {task.visibility === 'client_visible' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Client approval</DropdownMenuLabel>
              {task.approvalState === 'none' ? (
                <DropdownMenuItem onClick={() => toggleApproval('pending')}>
                  Request client approval
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => toggleApproval('none')}>
                  Reset approval
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={remove} className="text-red-400">
            Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className={`truncate text-left transition-colors hover:text-primary ${
              optimisticStatus === 'done'
                ? 'text-muted-foreground line-through'
                : ''
            }`}
          >
            {task.title}
          </button>
          {task.visibility === 'client_visible' && (
            <Badge variant="outline" className="text-[10px]">
              Client-visible
            </Badge>
          )}
          {APPROVAL_BADGE[task.approvalState] && (
            <Badge
              variant="outline"
              className={`text-[10px] ${APPROVAL_BADGE[task.approvalState]!.className}`}
            >
              {APPROVAL_BADGE[task.approvalState]!.label}
            </Badge>
          )}
          {overdue && (
            <Badge variant="outline" className="border-red-400/50 text-[10px] text-red-400">
              Overdue
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {task.clientName && task.clientId && (
            <>
              <Link
                href={`/${workspaceId}/clients/${task.clientId}`}
                className="hover:text-foreground"
              >
                {task.clientName}
              </Link>
              <span>·</span>
            </>
          )}
          <span className="capitalize">{task.department.replace('_', ' ')}</span>
          <span>·</span>
          <span className={PRIORITY_TONE[task.priority]}>{task.priority}</span>
          {task.dueDate && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {task.dueDate.toLocaleDateString()}
              </span>
            </>
          )}
          {task.subtaskStats && task.subtaskStats.total > 0 && (
            <>
              <span>·</span>
              <span
                className={`inline-flex items-center gap-1 ${
                  task.subtaskStats.done === task.subtaskStats.total
                    ? 'text-[var(--color-health-working)]'
                    : ''
                }`}
                title={`${task.subtaskStats.done} of ${task.subtaskStats.total} subtasks done`}
              >
                <ListTodo className="size-3" />
                {task.subtaskStats.done}/{task.subtaskStats.total}
              </span>
            </>
          )}
          {task.assigneeLabel && (
            <>
              <span>·</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                  task.assigneeIsSelf
                    ? 'border-primary/40 text-primary'
                    : 'border-border text-muted-foreground'
                }`}
                title={`Assigned to ${task.assigneeLabel}`}
              >
                <span
                  className={`inline-flex size-3 items-center justify-center rounded-full text-[8px] font-semibold ${
                    task.assigneeIsSelf
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  aria-hidden
                >
                  {assigneeInitial(task.assigneeLabel)}
                </span>
                {task.assigneeLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </li>

    <TaskDetailDialog
      workspaceId={workspaceId}
      task={task}
      members={members}
      mentionMembers={mentionMembers}
      open={detailOpen}
      onOpenChange={handleOpenChange}
    />
    </>
  );
}
