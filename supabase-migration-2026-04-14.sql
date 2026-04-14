-- Migration: 2026-04-14
-- Adds: task_checklist, recurring_tasks, tasks.overdue_reason

-- ============================================================
-- 1. CHECKLIST trong task (tick nhanh, không cần giao ai)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_by UUID REFERENCES profiles(id),
  done_at TIMESTAMPTZ,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_task ON task_checklist(task_id);

ALTER TABLE task_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_all_authenticated" ON task_checklist;
CREATE POLICY "checklist_all_authenticated" ON task_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 2. RECURRING TASKS — template tự sinh task mỗi ngày/tuần/tháng
-- ============================================================
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  department TEXT NOT NULL DEFAULT 'nail',
  group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL,
  -- Lặp lại
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  weekday INT,                  -- 0=CN..6=T7 (cho weekly)
  monthday INT,                 -- 1..31 (cho monthly)
  deadline_hour INT NOT NULL DEFAULT 18,    -- giờ deadline (0-23)
  deadline_minute INT NOT NULL DEFAULT 0,
  -- Người được giao mặc định (lưu mảng UUID)
  assignee_ids UUID[] DEFAULT '{}',
  -- Checklist mặc định (mảng text — sẽ copy vào task_checklist khi sinh)
  default_checklist TEXT[] DEFAULT '{}',
  -- Quản lý
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_date DATE,     -- tránh sinh trùng trong cùng 1 ngày
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_dept_active ON recurring_tasks(department, active);

ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_all_authenticated" ON recurring_tasks;
CREATE POLICY "recurring_all_authenticated" ON recurring_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 3. LÝ DO QUÁ HẠN — bắt nhân viên chọn lý do khi task trễ
-- ============================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_reason_note TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_reason_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS overdue_reason_by UUID REFERENCES profiles(id);

-- Đánh dấu task được sinh từ recurring (để báo cáo)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_tasks(id) ON DELETE SET NULL;
