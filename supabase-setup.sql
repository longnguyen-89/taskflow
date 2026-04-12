-- ============================================================
-- CCE-TASKSFLOW DATABASE V3 - COMPLETE REBUILD
-- Chạy trong Supabase SQL Editor
-- ============================================================

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS proposal_approvers CASCADE;
DROP TABLE IF EXISTS proposal_watchers CASCADE;
DROP TABLE IF EXISTS proposal_files CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS task_files CASCADE;
DROP TABLE IF EXISTS task_watchers CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_groups CASCADE;
DROP TABLE IF EXISTS proposal_categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('director', 'admin', 'accountant', 'member')),
  position TEXT DEFAULT 'Kỹ thuật viên',
  department TEXT DEFAULT 'nail',
  avatar_color TEXT DEFAULT '#E6F1FB',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Task Groups
CREATE TABLE task_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'nail',
  color TEXT DEFAULT '#6366F1',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Proposal Categories (TGĐ quản lý)
CREATE TABLE proposal_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO proposal_categories (name) VALUES ('Mua sắm'), ('Sửa chữa'), ('Nhân sự'), ('Khác');

-- 4. Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'waiting')),
  deadline TIMESTAMPTZ,
  department TEXT NOT NULL DEFAULT 'nail',
  group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  note TEXT,
  approval_status TEXT NOT NULL DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Task assignees (nhiều người)
CREATE TABLE task_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(task_id, user_id)
);

-- 6. Task watchers
CREATE TABLE task_watchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(task_id, user_id)
);

-- 7. Task files
CREATE TABLE task_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Proposals
CREATE TABLE proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES proposal_categories(id) ON DELETE SET NULL,
  category_name TEXT DEFAULT 'Khác',
  department TEXT NOT NULL DEFAULT 'nail',
  estimated_cost DECIMAL(15,0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Proposal approvers
CREATE TABLE proposal_approvers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  decided_at TIMESTAMPTZ
);

-- 10. Proposal watchers
CREATE TABLE proposal_watchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE
);

-- 11. Proposal files
CREATE TABLE proposal_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Comments (for both tasks and proposals)
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_dept ON tasks(department);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_watchers_user ON task_watchers(user_id);
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_proposal ON comments(proposal_id);
CREATE INDEX idx_proposals_dept ON proposals(department);
CREATE INDEX idx_approvers_proposal ON proposal_approvers(proposal_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_profiles_dept ON profiles(department);
CREATE INDEX idx_profiles_role ON profiles(role);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Universal select for authenticated
CREATE POLICY "sel" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON task_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON task_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON task_watchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON task_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON proposal_approvers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON proposal_watchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON proposal_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "sel" ON proposal_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "notif_sel" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Insert policies
CREATE POLICY "ins" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "ins" ON task_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON task_assignees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON task_watchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON task_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ins" ON proposals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON proposal_approvers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON proposal_watchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON proposal_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON proposal_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ins" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Update policies
CREATE POLICY "upd" ON profiles FOR UPDATE TO authenticated USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('director'))
);
CREATE POLICY "upd" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "upd" ON proposals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "upd" ON proposal_approvers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "upd" ON proposal_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "upd" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Delete
CREATE POLICY "del" ON tasks FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('director', 'admin'))
);
CREATE POLICY "del" ON task_groups FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
);
CREATE POLICY "del" ON proposal_categories FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
);
CREATE POLICY "del" ON task_assignees FOR DELETE TO authenticated USING (true);
CREATE POLICY "del" ON task_watchers FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_approvers;

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'attachments');

-- ============================================================
-- DONE!
-- ============================================================
