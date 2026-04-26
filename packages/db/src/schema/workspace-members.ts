import {
  boolean,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { Role } from '@phloz/config';

import { pkUuid, userIdRef } from './_helpers';
import { savedViews } from './saved-views';
import { workspaces } from './workspaces';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: userIdRef('user_id'),
    role: text('role').$type<Role>().notNull(),
    /**
     * Cached copy of `auth.users.user_metadata.full_name`. Kept in sync on
     * insert (invite accept / onboarding) + on profile updates. Nullable so
     * pre-existing rows don't break when this migration lands; reads fall
     * back to email → `Member` → UUID prefix.
     */
    displayName: text('display_name'),
    /**
     * Cached copy of `auth.users.email`. Backfilled from Supabase at insert
     * time. Duplicated here because joining against `auth.users` from app
     * queries requires service-role + a schema crossing — expensive for a
     * value that mutates rarely.
     */
    email: text('email'),
    /**
     * Per-member opt-in for the daily digest email. Defaults to true so
     * existing memberships keep getting it — explicitly off only when the
     * user disabled it from Settings → Notifications.
     */
    digestEnabled: boolean('digest_enabled').notNull().default(true),
    /**
     * Per-member preferred hour-of-day for the daily digest, in the
     * workspace's timezone. Null means "use the workspace default of
     * 9 AM" so existing memberships keep their behaviour. The cron
     * fires hourly and digests members whose `digestHour` matches the
     * current local hour. CHECK constraint at the DB level keeps the
     * range valid (0–23).
     */
    digestHour: smallint('digest_hour'),
    /**
     * Vacation mode. While set in the future, the digest cron and any
     * per-event notification helpers skip this member entirely. Null
     * (the default) means "not paused". Members clear it explicitly
     * via Settings → Notifications, or set it to a date and forget.
     */
    pausedUntil: timestamp('paused_until', {
      withTimezone: true,
      mode: 'date',
    }),
    /**
     * Last time the member visited /[workspace]/mentions. The
     * sidebar Mentions badge counts comments + internal notes
     * created after this timestamp. NULL = never visited (every
     * mention counts as unread until they open the inbox).
     * Updated by `markMentionsSeenAction` on every visit.
     */
    mentionsSeenAt: timestamp('mentions_seen_at', {
      withTimezone: true,
      mode: 'date',
    }),
    /**
     * Per-member auto-applied saved view for `/tasks`. When set, a
     * bare `/tasks` landing redirects to `/tasks?<view.searchParams>`
     * (the "All" pill goes to `/tasks?view=all` to bypass).
     * Set to null on FK target delete so removing a saved view
     * doesn't leave members with a dangling default.
     */
    defaultSavedViewId: uuid('default_saved_view_id').references(
      (): AnyPgColumn => savedViews.id,
      { onDelete: 'set null' },
    ),
    invitedAt: timestamp('invited_at', { withTimezone: true, mode: 'date' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMembership: uniqueIndex('workspace_members_workspace_user_key').on(
      table.workspaceId,
      table.userId,
    ),
    workspaceIdx: index('workspace_members_workspace_id_idx').on(table.workspaceId),
    userIdx: index('workspace_members_user_id_idx').on(table.userId),
  }),
);

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
