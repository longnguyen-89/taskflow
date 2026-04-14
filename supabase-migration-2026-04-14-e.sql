-- Migration: 2026-04-14 (e) — Branch-level permissions cho Nail (4 chi nhánh)
-- Thêm phân quyền theo chi nhánh: Bến Cát, Thuận An, Thủ Dầu Một, VSIP.
-- Hotel vẫn dùng department='hotel', không cần branch.
--
-- Quy tắc:
--   - Tổng GĐ, Kế toán: branches = NULL → thấy toàn bộ
--   - Quản lý (admin): branches = array chi nhánh phụ trách (1 hoặc nhiều)
--   - Nhân viên (member): branches = array 1 chi nhánh
--   - Hotel staff: branches = NULL, department='hotel' đã đủ để tách
--
-- Không xoá dữ liệu cũ. Các task/proposal cũ sẽ được gán branch dựa trên
-- assignee hoặc creator (nếu khớp nhân sự đã biết).

-- 1. Thêm cột branches cho profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branches TEXT[];

-- 2. Thêm cột branch cho tasks / proposals / task_groups
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE task_groups ADD COLUMN IF NOT EXISTS branch TEXT;

-- Index phụ trợ cho query theo branch
CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(branch);
CREATE INDEX IF NOT EXISTS idx_proposals_branch ON proposals(branch);

-- 3. Gán chi nhánh cho các nhân sự đã biết (khớp theo tên gần đúng)
--    Nếu sai tên, anh chỉnh trong Admin Panel sau.
UPDATE profiles SET branches = ARRAY['ben_cat']
  WHERE department = 'nail' AND branches IS NULL
    AND (name ILIKE '%Thảo%' OR name ILIKE '%Thao%');

UPDATE profiles SET branches = ARRAY['thuan_an']
  WHERE department = 'nail' AND branches IS NULL
    AND (name ILIKE '%Nhân%' OR name ILIKE '%Nhan%');

UPDATE profiles SET branches = ARRAY['thu_dau_mot']
  WHERE department = 'nail' AND branches IS NULL
    AND (name ILIKE '%Phương%' OR name ILIKE '%Phuong%');

-- 4. Migrate tasks cũ: lấy branch từ assignee đầu tiên, fallback creator
UPDATE tasks t SET branch = (
  SELECT p.branches[1]
  FROM task_assignees ta
  JOIN profiles p ON p.id = ta.user_id
  WHERE ta.task_id = t.id AND p.branches IS NOT NULL AND array_length(p.branches,1) >= 1
  LIMIT 1
)
WHERE t.department = 'nail' AND t.branch IS NULL;

UPDATE tasks t SET branch = (
  SELECT p.branches[1] FROM profiles p
  WHERE p.id = t.created_by AND p.branches IS NOT NULL AND array_length(p.branches,1) >= 1
)
WHERE t.department = 'nail' AND t.branch IS NULL;

-- 5. Migrate proposals cũ: lấy branch từ creator
UPDATE proposals pr SET branch = (
  SELECT p.branches[1] FROM profiles p
  WHERE p.id = pr.created_by AND p.branches IS NOT NULL AND array_length(p.branches,1) >= 1
)
WHERE pr.department = 'nail' AND pr.branch IS NULL;

-- 6. Các task/đề xuất nail chưa có branch (creator/assignee chưa được gán) → để NULL.
--    Anh vào Admin Panel gán thủ công hoặc chạy update trực tiếp sau.

-- Kiểm tra kết quả:
-- SELECT name, role, department, branches FROM profiles ORDER BY department, name;
-- SELECT branch, count(*) FROM tasks WHERE department='nail' GROUP BY branch;
-- SELECT branch, count(*) FROM proposals WHERE department='nail' GROUP BY branch;
