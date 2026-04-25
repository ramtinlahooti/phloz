import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { pkUuid, timestamps, userIdRef } from './_helpers';
import { workspaces } from './workspaces';

/**
 * Per-user persisted filter combos. V1 surfaces only the `tasks`
 * scope — name + the URL search-params string that produced the
 * current `/tasks` view, so re-clicking the saved view is a single
 * `Link` navigation.
 *
 * `(workspace_id, user_id, scope, name)` is unique so re-saving the
 * same name in the same scope upserts cleanly without polluting the
 * picker with duplicates.
 */
export const savedViews = pgTable(
  'saved_views',
  {
    id: pkUuid(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: userIdRef('user_id'),
    /** Free-form name shown in the picker. */
    name: text('name').notNull(),
    /** Page the view applies to. V1 only emits `tasks`. */
    scope: text('scope').notNull(),
    /**
     * Encoded filter state — the URL query string that produced the
     * view (e.g. `department=ppc&status=todo&sort=due_soonest`).
     * Stored verbatim because every consumer of saved views ends up
     * navigating to `/tasks?<this>` anyway.
     */
    searchParams: text('search_params').notNull(),
    /**
     * When true, every workspace member sees this view in their
     * picker. The creator (`user_id`) still owns the row — only they
     * can rename/delete. Owner/admin only — gated server-side in
     * `createSavedViewAction`.
     */
    isShared: boolean('is_shared').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    workspaceIdx: index('saved_views_workspace_id_idx').on(table.workspaceId),
    userIdx: index('saved_views_user_id_idx').on(table.userId),
    uniqueName: uniqueIndex('saved_views_unique_name').on(
      table.workspaceId,
      table.userId,
      table.scope,
      table.name,
    ),
  }),
);

export type SavedView = typeof savedViews.$inferSelect;
export type NewSavedView = typeof savedViews.$inferInsert;
