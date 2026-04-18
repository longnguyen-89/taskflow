-- 2026-04-18: app_settings bảng cấu hình hệ thống
-- Dùng cho tính năng Phân quyền (permissions) - lưu toggle quyền hạn của TGĐ.
-- Safe migration: IF NOT EXISTS, không ảnh hưởng data cũ.
--
-- Key dùng hiện tại:
--   'permissions' → JSONB value: { member_create_task, admin_delete_tasks, ... }
-- Có thể mở rộng sau cho các setting khác (branding, defaults, feature flags, v.v.).

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Seed default permissions row (idempotent)
INSERT INTO app_settings (key, value) VALUES
  ('permissions', '{
    "member_create_task": false,
    "admin_delete_tasks": false,
    "admin_delete_proposals": false,
    "admin_approve_proposals": false,
    "admin_manage_users": false,
    "member_view_reports": true
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies: ai đăng nhập cũng đọc được (để AuthContext load permissions),
-- chỉ Director mới được ghi.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'settings_sel') THEN
    CREATE POLICY "settings_sel" ON app_settings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'settings_ins') THEN
    CREATE POLICY "settings_ins" ON app_settings FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'settings_upd') THEN
    CREATE POLICY "settings_upd" ON app_settings FOR UPDATE TO authenticated USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
    );
  END IF;
END $$;

COMMENT ON TABLE app_settings IS 'Cấu hình hệ thống (key-value JSONB). key=''permissions'' lưu toggle phân quyền.';
