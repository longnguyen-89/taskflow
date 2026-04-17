-- 2026-04-17: 4 feature upgrades
-- 1. Activity Log table
-- 2. Branches table (dynamic, replace hardcoded)
-- Safe migration: IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ═══════════ 1. ACTIVITY LOG ═══════════
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_title TEXT,
  details JSONB,
  department TEXT,
  branch TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_dept ON activity_log(department);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_sel') THEN
    CREATE POLICY "activity_sel" ON activity_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_ins') THEN
    CREATE POLICY "activity_ins" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ═══════════ 2. BRANCHES TABLE ═══════════
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'nail',
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing hardcoded branches
INSERT INTO branches (id, label, department, sort_order) VALUES
  ('ben_cat', 'Bến Cát', 'nail', 1),
  ('thuan_an', 'Thuận An', 'nail', 2),
  ('thu_dau_mot', 'Thủ Dầu Một', 'nail', 3),
  ('vsip', 'VSIP', 'nail', 4)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branch_sel') THEN
    CREATE POLICY "branch_sel" ON branches FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branch_ins') THEN
    CREATE POLICY "branch_ins" ON branches FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branch_upd') THEN
    CREATE POLICY "branch_upd" ON branches FOR UPDATE TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branch_del') THEN
    CREATE POLICY "branch_del" ON branches FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
    );
  END IF;
END $$;
