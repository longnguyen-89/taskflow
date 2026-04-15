-- 2026-04-15-b: Thêm file đính kèm mặc định cho task lặp lại
-- Mỗi lần task được sinh, các file này sẽ tự copy sang task_files.
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS default_files JSONB DEFAULT '[]'::jsonb;
