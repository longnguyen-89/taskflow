-- Migration: 2026-04-14 (d)
-- Add group_key to tasks so multi-assignee tasks can be split into
-- N independent tasks (one per person) but still linked by a shared key.
-- This lets each person complete their task independently without
-- auto-marking others as done.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS group_key UUID;

CREATE INDEX IF NOT EXISTS idx_tasks_group_key ON tasks(group_key);

-- NOTE: Existing tasks keep group_key = NULL (backward compatible).
-- Only newly created multi-assignee tasks will have group_key set.
