'use client';

import { AlertCircle, CheckCircle2, Circle, CircleDashed, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
};

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

export function TaskRow({
  workspaceId,
  task,
}: {
  workspaceId: string;
  task: TaskRowModel;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatus>(task.status);
  const StatusIcon = STATUS_ICONS[optimisticStatus];

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
          <span
            className={`truncate ${
              optimisticStatus === 'done' ? 'text-muted-foreground line-through' : ''
            }`}
          >
            {task.title}
          </span>
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
        </div>
      </div>
    </li>
  );
}
