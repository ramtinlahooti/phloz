'use client';

import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import type { TaskVisibility } from '@phloz/config';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  toast,
} from '@phloz/ui';

import {
  createCommentAction,
  deleteCommentAction,
  listCommentsAction,
  type CommentView,
} from './comments-actions';
import type { TaskRowModel } from './task-row';

/**
 * Task detail + comments thread. Lazy-loads comments on open so the
 * task list stays cheap. Compose textarea at the bottom creates an
 * internal comment by default; a checkbox toggles client-visible
 * comments (these render on the client portal in a later session).
 */
export function TaskDetailDialog({
  workspaceId,
  task,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  task: TaskRowModel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<TaskVisibility>('internal');
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await listCommentsAction({
        workspaceId,
        parentType: 'task',
        parentId: task.id,
      });
      if (cancelled) return;
      if (res.ok) {
        setComments(res.comments);
        setLoadError(null);
      } else {
        setLoadError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, task.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await createCommentAction({
        workspaceId,
        parentType: 'task',
        parentId: task.id,
        body: body.trim(),
        visibility,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Optimistic append so the thread feels instant.
      setComments((prev) => [
        ...(prev ?? []),
        {
          id: res.id,
          body: body.trim(),
          authorName: 'You',
          authorType: 'member',
          visibility,
          createdAt: new Date(),
          canDelete: true,
        },
      ]);
      setBody('');
    } finally {
      setSending(false);
    }
  }

  function remove(id: string) {
    if (!confirm('Delete this comment?')) return;
    startTransition(async () => {
      const res = await deleteCommentAction({ workspaceId, commentId: id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{task.title}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {task.status.replace('_', ' ')}
            </Badge>
            {task.visibility === 'client_visible' && (
              <Badge variant="outline" className="text-[10px]">
                Client-visible
              </Badge>
            )}
          </DialogTitle>
          {task.clientName && (
            <DialogDescription>
              <span>{task.clientName}</span>
              {task.dueDate && (
                <>
                  {' · '}
                  Due {task.dueDate.toLocaleDateString()}
                </>
              )}
              {' · '}
              <span className="capitalize">{task.priority}</span> priority
              {' · '}
              <span className="capitalize">
                {task.department.replace('_', ' ')}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="size-3.5" />
            Comments
            {comments && (
              <span className="font-normal normal-case text-muted-foreground">
                · {comments.length}
              </span>
            )}
          </h3>

          {loadError ? (
            <p className="rounded-md border border-border bg-card/30 p-3 text-sm text-[var(--color-destructive)]">
              {loadError}
            </p>
          ) : comments === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-card/30 p-4 text-center text-xs text-muted-foreground">
              No comments yet. Start the thread.
            </p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-md border p-3 text-sm ${
                    c.visibility === 'client_visible'
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-card/30'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {c.authorName}
                    </span>
                    {c.visibility === 'client_visible' && (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-[10px] text-primary"
                      >
                        Client-visible
                      </Badge>
                    )}
                    <span>·</span>
                    <time dateTime={c.createdAt.toISOString()}>
                      {c.createdAt.toLocaleString()}
                    </time>
                    {c.canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="ml-auto text-xs text-muted-foreground hover:text-red-400"
                        title="Delete comment"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Write a comment…"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            maxLength={10_000}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={visibility === 'client_visible'}
                onChange={(e) =>
                  setVisibility(
                    e.target.checked ? 'client_visible' : 'internal',
                  )
                }
              />
              Client-visible (shown on the portal)
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={sending || !body.trim()}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {sending ? 'Posting…' : 'Post comment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
