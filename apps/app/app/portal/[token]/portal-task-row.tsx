'use client';

import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Circle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useState, useTransition } from 'react';

import type { ApprovalState, TaskStatus } from '@phloz/config';
import { Badge, Button, toast } from '@phloz/ui';

import { setClientApprovalAction } from './actions';

export type PortalTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  dueDate: Date | null;
  approvalState: ApprovalState;
  approvalComment: string | null;
};

const APPROVAL_TONE: Record<
  ApprovalState,
  { label: string; className: string }
> = {
  none: { label: '', className: '' },
  pending: {
    label: 'Awaiting your review',
    className: 'border-amber-400/50 text-amber-400',
  },
  approved: {
    label: 'Approved',
    className: 'border-emerald-400/50 text-emerald-400',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-400/50 text-red-400',
  },
  needs_changes: {
    label: 'Changes requested',
    className: 'border-orange-400/50 text-orange-400',
  },
};

export function PortalTaskCard({
  token,
  task,
}: {
  token: string;
  task: PortalTaskRow;
}) {
  const [approvalState, setApprovalState] = useState(task.approvalState);
  const [showCommentFor, setShowCommentFor] = useState<
    'rejected' | 'needs_changes' | null
  >(null);
  const [comment, setComment] = useState('');
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function submitApproval(
    nextState: 'approved' | 'rejected' | 'needs_changes',
  ) {
    // If rejecting or requesting changes, open the comment row first.
    if (
      (nextState === 'rejected' || nextState === 'needs_changes') &&
      showCommentFor !== nextState
    ) {
      setShowCommentFor(nextState);
      return;
    }

    const prev = approvalState;
    setApprovalState(nextState);
    setBusy(true);
    startTransition(async () => {
      const res = await setClientApprovalAction({
        token,
        taskId: task.id,
        state: nextState,
        comment: comment.trim() || undefined,
      });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        setApprovalState(prev);
        return;
      }
      if (nextState === 'approved') toast.success('Approved');
      else if (nextState === 'rejected') toast.success('Feedback sent');
      else toast.success('Change request sent');
      setShowCommentFor(null);
      setComment('');
    });
  }

  const tone = APPROVAL_TONE[approvalState];
  const Icon = statusIcon(task.status);

  return (
    <li className="space-y-3 rounded-lg border border-border bg-card/30 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{task.title}</span>
            {task.priority === 'urgent' && (
              <Badge
                variant="outline"
                className="border-red-400/50 text-[10px] text-red-400"
              >
                Urgent
              </Badge>
            )}
            {tone.label && (
              <Badge variant="outline" className={`text-[10px] ${tone.className}`}>
                {tone.label}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {task.description}
            </p>
          )}
          {task.dueDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              Due {task.dueDate.toLocaleDateString()}
            </p>
          )}
          {task.approvalComment && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs italic text-muted-foreground">
              &ldquo;{task.approvalComment}&rdquo;
            </p>
          )}
        </div>
      </div>

      {approvalState === 'pending' && (
        <>
          {showCommentFor && (
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                showCommentFor === 'rejected'
                  ? 'Why are you rejecting this? (optional)'
                  : 'What changes would you like? (optional)'
              }
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => submitApproval('approved')}
              disabled={busy}
            >
              <CheckCircle2 className="size-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => submitApproval('needs_changes')}
              disabled={busy}
            >
              <RefreshCw className="size-3.5" />
              {showCommentFor === 'needs_changes' ? 'Send' : 'Request changes'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => submitApproval('rejected')}
              disabled={busy}
              className="border-red-400/40 text-red-400 hover:bg-red-400/10"
            >
              <XCircle className="size-3.5" />
              {showCommentFor === 'rejected' ? 'Send' : 'Reject'}
            </Button>
            {showCommentFor && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCommentFor(null);
                  setComment('');
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function statusIcon(status: TaskStatus) {
  if (status === 'done') return CheckCircle2;
  if (status === 'in_progress') return CircleDashed;
  if (status === 'blocked') return AlertCircle;
  return Circle;
}
