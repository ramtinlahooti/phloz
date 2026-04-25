-- Per-sibling display order. Subtask drag-to-reorder writes to this
-- column; top-level tasks leave it at 0 and sort by priority + due
-- date as before. Backfills existing subtasks with sequential
-- sort_order values based on creation time so the first user to
-- drag-reorder a parent doesn't see siblings collapse to "all 0".

ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

WITH ordered AS (
  SELECT id,
         (ROW_NUMBER() OVER (PARTITION BY parent_task_id ORDER BY created_at) - 1) * 1024 AS new_order
  FROM "tasks"
  WHERE parent_task_id IS NOT NULL
)
UPDATE "tasks" t
SET sort_order = ordered.new_order
FROM ordered
WHERE t.id = ordered.id;
