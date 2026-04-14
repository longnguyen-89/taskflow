-- Migration: 2026-04-14 (c)
-- Add watcher_ids to recurring_tasks so a template can include a list of
-- users who only watch (nhận notification) when task is auto-generated.

ALTER TABLE recurring_tasks
  ADD COLUMN IF NOT EXISTS watcher_ids UUID[] DEFAULT '{}';
