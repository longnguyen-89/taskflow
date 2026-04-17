-- 2026-04-17 (late): Feature 9 — Task Pin (ghim task uu tien)
-- Them cot pinned de danh dau task uu tien hien len dau danh sach
-- Safe migration: IF NOT EXISTS, default false, khong anh huong data cu

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- Index de truy van sort nhanh hon khi danh sach task lon
CREATE INDEX IF NOT EXISTS idx_tasks_pinned ON tasks(pinned) WHERE pinned = true;

COMMENT ON COLUMN tasks.pinned IS 'Ghim task len dau danh sach (admin/director only). Sort pinned tasks truoc, sau do theo created_at DESC.';
