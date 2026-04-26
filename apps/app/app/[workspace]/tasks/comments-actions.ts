'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@phloz/auth/roles';
import { requireUser } from '@phloz/auth/session';
import { COMMENT_PARENT_TYPES, TASK_VISIBILITIES } from '@phloz/config';
import { getDb, schema } from '@phloz/db/client';

import {
  extractMentionTokens,
  resolveMentionTokens,
} from '@/lib/mentions';
import { sendTaskNotificationToMember } from '@/lib/notify-task';

/**
 * Comments are polymorphic — `parent_type` + `parent_id` points at a
 * task, tracking_node, message, or client. For now only the task
 * surface consumes them; other parent types plug in the same actions.
 */
const uuid = z.string().uuid();

// --- list --------------------------------------------------------------
const listSchema = z.object({
  workspaceId: uuid,
  parentType: z.enum(COMMENT_PARENT_TYPES),
  parentId: uuid,
});

export type CommentView = {
  id: string;
  body: string;
  authorName: string;
  authorType: 'member' | 'contact' | 'system';
  visibility: 'internal' | 'client_visible';
  createdAt: Date;
  /** The auth.users.id of the current viewer, if they can delete. */
  canDelete: boolean;
};

export async function listCommentsAction(
  input: z.infer<typeof listSchema>,
): Promise<
  | { ok: true; comments: CommentView[] }
  | { ok: false; error: string }
> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, [
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: schema.comments.id,
      body: schema.comments.body,
      authorId: schema.comments.authorId,
      authorType: schema.comments.authorType,
      visibility: schema.comments.visibility,
      createdAt: schema.comments.createdAt,
    })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.workspaceId, parsed.data.workspaceId),
        eq(schema.comments.parentType, parsed.data.parentType),
        eq(schema.comments.parentId, parsed.data.parentId),
      ),
    )
    .orderBy(asc(schema.comments.createdAt));

  // Resolve author names — members come via workspace_members.userId,
  // contacts via client_contacts.id. Batched lookups.
  const memberIds = [
    ...new Set(rows.filter((r) => r.authorType === 'member').map((r) => r.authorId)),
  ];
  const contactIds = [
    ...new Set(
      rows.filter((r) => r.authorType === 'contact').map((r) => r.authorId),
    ),
  ];

  const memberNames = memberIds.length
    ? await db
        .select({
          id: schema.workspaceMembers.id,
          userId: schema.workspaceMembers.userId,
        })
        .from(schema.workspaceMembers)
        .where(
          eq(
            schema.workspaceMembers.workspaceId,
            parsed.data.workspaceId,
          ),
        )
    : [];
  const memberUserIdByMemberId = new Map(
    memberNames.map((m) => [m.id, m.userId] as const),
  );

  const contactNames = contactIds.length
    ? await db
        .select({
          id: schema.clientContacts.id,
          name: schema.clientContacts.name,
        })
        .from(schema.clientContacts)
        .where(
          eq(
            schema.clientContacts.workspaceId,
            parsed.data.workspaceId,
          ),
        )
    : [];
  const contactNameById = new Map(
    contactNames.map((c) => [c.id, c.name] as const),
  );

  const viewerMembership = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  const comments: CommentView[] = rows.map((r) => {
    let authorName = 'Unknown';
    if (r.authorType === 'member') {
      const userId = memberUserIdByMemberId.get(r.authorId);
      authorName = userId === user.id ? 'You' : 'Teammate';
    } else if (r.authorType === 'contact') {
      authorName = contactNameById.get(r.authorId) ?? 'Client';
    } else {
      authorName = 'System';
    }
    return {
      id: r.id,
      body: r.body,
      authorName,
      authorType: r.authorType,
      visibility: r.visibility,
      createdAt: r.createdAt,
      canDelete:
        r.authorType === 'member' && r.authorId === viewerMembership?.id,
    };
  });

  return { ok: true, comments };
}

// --- create ------------------------------------------------------------
const createSchema = z.object({
  workspaceId: uuid,
  parentType: z.enum(COMMENT_PARENT_TYPES),
  parentId: uuid,
  body: z.string().trim().min(1).max(10_000),
  visibility: z.enum(TASK_VISIBILITIES).default('internal'),
});

export async function createCommentAction(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  try {
    await requireRole(parsed.data.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  const membership = await db
    .select({ id: schema.workspaceMembers.id })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!membership) return { ok: false, error: 'not_a_member' };

  const [row] = await db
    .insert(schema.comments)
    .values({
      workspaceId: parsed.data.workspaceId,
      authorId: membership.id,
      authorType: 'member',
      parentType: parsed.data.parentType,
      parentId: parsed.data.parentId,
      body: parsed.data.body,
      visibility: parsed.data.visibility,
    })
    .returning({ id: schema.comments.id });

  if (!row) return { ok: false, error: 'insert_failed' };

  // Mention fan-out — only meaningful on task comments today
  // (mentions on tracking_node / message / client comments use the
  // same parser but don't fire emails until those surfaces grow
  // their own templates). Best-effort + fire-and-forget.
  if (parsed.data.parentType === 'task') {
    void fanOutMentions({
      workspaceId: parsed.data.workspaceId,
      taskId: parsed.data.parentId,
      body: parsed.data.body,
      actorUserId: user.id,
      commentId: row.id,
    }).catch((err: unknown) => {
      console.error('[comments] mention fan-out failed', err);
    });
  }

  // Revalidate the most likely surface — the task lives on both the
  // workspace tasks page and the client detail page.
  revalidatePath(`/${parsed.data.workspaceId}/tasks`);
  return { ok: true, id: row.id };
}

/**
 * Parse `@<token>` mentions from a comment body and email each
 * matched workspace member, gated by their notification prefs.
 *
 * Match strategy: extract every `@<token>` (alphanumerics + dot
 * + hyphen) and try to resolve each token to a workspace member
 * via two paths:
 *
 *   1. Email exact match (case-insensitive) — the user typed
 *      `@alex@agency.com`.
 *   2. Email local-part match — `@alex` matches `alex@agency.com`
 *      so people don't have to type the full address.
 *
 * Display-name matching is skipped to keep ambiguity manageable;
 * a future autocomplete in the comment composer will collapse
 * these heuristics into a single canonical token.
 *
 * Mentions are also persisted to `comments.mentions` (array of
 * user_ids) so future surfaces — a "mentioned me" inbox, audit
 * trail — can read them without re-parsing the body.
 */
async function fanOutMentions(input: {
  workspaceId: string;
  taskId: string;
  body: string;
  actorUserId: string;
  commentId: string;
}): Promise<void> {
  const tokens = extractMentionTokens(input.body);
  if (tokens.length === 0) return;

  const matched = await resolveMentionTokens({
    workspaceId: input.workspaceId,
    tokens,
  });
  if (matched.length === 0) return;

  const db = getDb();

  // Persist resolved user_ids on the comment row for future
  // surfaces. Filter out null user_ids (members invited but not
  // yet accepted).
  const userIds = matched
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);
  if (userIds.length > 0) {
    await db
      .update(schema.comments)
      .set({ mentions: userIds })
      .where(eq(schema.comments.id, input.commentId));
  }

  // Resolve the task + workspace + actor for the email payload.
  const [task, workspace, actor] = await Promise.all([
    db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        clientId: schema.tasks.clientId,
        dueDate: schema.tasks.dueDate,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, input.taskId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ name: schema.workspaces.name })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, input.workspaceId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        displayName: schema.workspaceMembers.displayName,
        email: schema.workspaceMembers.email,
      })
      .from(schema.workspaceMembers)
      .where(
        and(
          eq(schema.workspaceMembers.workspaceId, input.workspaceId),
          eq(schema.workspaceMembers.userId, input.actorUserId),
        ),
      )
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!task || !workspace) return;

  const actorName =
    actor?.displayName?.trim() || actor?.email || null;
  const contextLine = input.body.slice(0, 200).trim();

  // Fan out — skip self-mentions (a user mentioning themselves
  // shouldn't email themselves).
  for (const m of matched) {
    if (m.userId === input.actorUserId) continue;
    void sendTaskNotificationToMember({
      workspaceId: input.workspaceId,
      workspaceName: workspace.name,
      recipientMemberId: m.membershipId,
      eventType: 'task_mention',
      task: {
        id: task.id,
        title: task.title,
        clientId: task.clientId,
        dueDate: task.dueDate,
      },
      actorName,
      contextLine,
    });
  }
}

// --- delete ------------------------------------------------------------
export async function deleteCommentAction(input: {
  workspaceId: string;
  commentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (
    !uuid.safeParse(input.workspaceId).success ||
    !uuid.safeParse(input.commentId).success
  ) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    await requireRole(input.workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const user = await requireUser();
  const db = getDb();

  const comment = await db
    .select({
      id: schema.comments.id,
      authorId: schema.comments.authorId,
      authorType: schema.comments.authorType,
    })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.id, input.commentId),
        eq(schema.comments.workspaceId, input.workspaceId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!comment) return { ok: false, error: 'not_found' };

  const viewerMembership = await db
    .select({ id: schema.workspaceMembers.id, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, input.workspaceId),
        eq(schema.workspaceMembers.userId, user.id),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!viewerMembership) return { ok: false, error: 'forbidden' };

  const canDelete =
    (comment.authorType === 'member' &&
      comment.authorId === viewerMembership.id) ||
    viewerMembership.role === 'owner' ||
    viewerMembership.role === 'admin';

  if (!canDelete) return { ok: false, error: 'forbidden' };

  await db
    .delete(schema.comments)
    .where(eq(schema.comments.id, input.commentId));

  revalidatePath(`/${input.workspaceId}/tasks`);
  return { ok: true };
}
