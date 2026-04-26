'use client';

import { Bell, BellOff, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';

import { MentionBody } from '@/components/mention-body';
import {
  MentionComposer,
  type MentionMember,
} from '@/components/mention-composer';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import type {
  Department,
  TaskPriority,
  TaskVisibility,
} from '@phloz/config';
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_VISIBILITIES,
} from '@phloz/config';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@phloz/ui';

import {
  createCommentAction,
  deleteCommentAction,
  listCommentsAction,
  type CommentView,
} from './comments-actions';
import { updateTaskAction } from './actions';
import {
  getTaskMuteStateAction,
  setNotificationSubscriptionAction,
} from '../settings/notifications-actions';
import { SubtaskList } from './subtask-list';
import type { MemberOption, TaskRowModel } from './task-row';

const UNASSIGNED = '__unassigned__';

/**
 * Task detail + comments thread. Lazy-loads comments on open so the
 * task list stays cheap. Compose textarea at the bottom creates an
 * internal comment by default; a checkbox toggles client-visible
 * comments (these render on the client portal in a later session).
 */
export function TaskDetailDialog({
  workspaceId,
  task,
  members,
  mentionMembers,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  task: TaskRowModel;
  /** Workspace members available to be assigned. Omitted when the caller
   *  didn't fetch members — the assignee picker is then hidden from edit
   *  mode and assignee stays unchanged on save. */
  members?: MemberOption[];
  /** Richer member list (id + displayName + email) for the
   *  comment composer's `@` autocomplete. Optional — when omitted
   *  the composer falls back to a plain textarea. */
  mentionMembers?: MentionMember[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<TaskVisibility>('internal');
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editDepartment, setEditDepartment] = useState<Department>(
    task.department,
  );
  const [editVisibility, setEditVisibility] = useState<TaskVisibility>(
    task.visibility,
  );
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? toDateInput(task.dueDate) : '',
  );
  const [editAssignee, setEditAssignee] = useState<string>(
    task.assigneeMembershipId ?? UNASSIGNED,
  );
  const [savingEdit, setSavingEdit] = useState(false);

  // Per-task mute state. Loaded lazily on dialog open via the
  // `notification_subscriptions` table (entity_type='task'). `null`
  // = not yet loaded; the toggle disables itself until we know the
  // current state so a click can't race the fetch.
  const [muted, setMuted] = useState<boolean | null>(null);
  const [muteToggling, setMuteToggling] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset edit state to reflect the latest task payload every time
    // we open (covers the case where the list was refreshed while the
    // dialog was closed).
    setEditMode(false);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDepartment(task.department);
    setEditVisibility(task.visibility);
    setEditDueDate(task.dueDate ? toDateInput(task.dueDate) : '');
    setEditAssignee(task.assigneeMembershipId ?? UNASSIGNED);
    setEditDescription(''); // description isn't on TaskRowModel — fetch below

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
    // Lazy-fetch the calling user's mute state for this task in
    // parallel with the comments load. Failures resolve to "not
    // muted" (the action returns `{muted: false}` on any error)
    // so the toggle can render without surfacing a read error.
    setMuted(null);
    (async () => {
      const res = await getTaskMuteStateAction({
        workspaceId,
        taskId: task.id,
      });
      if (cancelled) return;
      setMuted(res.muted);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    workspaceId,
    task.id,
    task.title,
    task.priority,
    task.department,
    task.visibility,
    task.dueDate,
    task.assigneeMembershipId,
  ]);

  async function toggleMute() {
    if (muted === null) return; // not yet loaded — guard against race
    const next = !muted;
    setMuted(next);
    setMuteToggling(true);
    try {
      const res = await setNotificationSubscriptionAction({
        workspaceId,
        entityType: 'task',
        entityId: task.id,
        mode: next ? 'mute' : null,
      });
      if (!res.ok) {
        setMuted(!next);
        toast.error(`Couldn't ${next ? 'mute' : 'unmute'} task: ${res.error}`);
        return;
      }
      toast.success(
        next
          ? "You'll stop getting emails about this task"
          : "You'll get emails about this task again",
      );
    } finally {
      setMuteToggling(false);
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      const res = await updateTaskAction({
        workspaceId,
        id: task.id,
        title: editTitle.trim(),
        description: editDescription.trim() ? editDescription.trim() : null,
        priority: editPriority,
        department: editDepartment,
        visibility: editVisibility,
        dueDate: editDueDate
          ? new Date(editDueDate).toISOString()
          : null,
        // Only include assignee in the update when we actually rendered
        // the picker — otherwise the caller hasn't given us members to
        // choose from and we don't want to silently null it out.
        ...(members
          ? {
              assigneeMembershipId:
                editAssignee === UNASSIGNED ? null : editAssignee,
            }
          : {}),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Saved');
      setEditMode(false);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

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
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {task.status.replace('_', ' ')}
            </Badge>
            {task.visibility === 'client_visible' && (
              <Badge variant="outline" className="text-[10px]">
                Client-visible
              </Badge>
            )}
            {!editMode && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={toggleMute}
                  disabled={muted === null || muteToggling}
                  className={`gap-1.5 ${muted ? 'text-amber-400' : 'text-muted-foreground'}`}
                  title={
                    muted
                      ? "You're not getting emails about this task. Click to unmute."
                      : "Click to stop getting emails about this task. Doesn't affect teammates."
                  }
                  aria-pressed={muted ?? false}
                >
                  {muted ? (
                    <>
                      <BellOff className="size-3.5" /> Muted
                    </>
                  ) : (
                    <>
                      <Bell className="size-3.5" /> Mute
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditMode(true)}
                  className="gap-1.5"
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </>
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

        {editMode && (
          <section className="space-y-4 border-y border-border py-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="What does this task cover?"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select
                  value={editPriority}
                  onValueChange={(v) => setEditPriority(v as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Select
                  value={editDepartment}
                  onValueChange={(v) => setEditDepartment(v as Department)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d} className="capitalize">
                        {d.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Visibility</Label>
                <Select
                  value={editVisibility}
                  onValueChange={(v) => setEditVisibility(v as TaskVisibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v === 'internal' ? 'Internal' : 'Client-visible'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              className={`grid gap-3 ${
                members && members.length > 0 ? 'sm:grid-cols-2' : ''
              }`}
            >
              <div className="space-y-1">
                <Label>Due date (optional)</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
              {members && members.length > 0 && (
                <div className="space-y-1">
                  <Label>Assignee</Label>
                  <Select value={editAssignee} onValueChange={setEditAssignee}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditMode(false)}
                disabled={savingEdit}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveEdit}
                disabled={savingEdit || !editTitle.trim()}
              >
                {savingEdit ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </section>
        )}

        <SubtaskList workspaceId={workspaceId} parentTaskId={task.id} />

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
                  <p className="text-foreground/90">
                    <MentionBody text={c.body} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={submit} className="space-y-2">
          {mentionMembers && mentionMembers.length > 0 ? (
            <MentionComposer
              value={body}
              onChange={setBody}
              members={mentionMembers}
              rows={3}
              maxLength={10_000}
              placeholder="Write a comment…  Type @ to mention a teammate."
            />
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Write a comment…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              maxLength={10_000}
            />
          )}
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

/** Convert a Date to the `YYYY-MM-DD` string the date input expects. */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
