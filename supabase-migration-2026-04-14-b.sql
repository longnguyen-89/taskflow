-- Migration: 2026-04-14 (b)
-- Add deadline_days_offset to recurring_tasks so a recurring task
-- can have a deadline N days AFTER it is generated (not just same-day).

ALTER TABLE recurring_tasks
  ADD COLUMN IF NOT EXISTS deadline_days_offset INT NOT NULL DEFAULT 0;

-- Meaning:
--   0 = deadline is on the same day the task is generated (current behavior)
--   1 = deadline is 1 day later, 2 = 2 days later, ...
