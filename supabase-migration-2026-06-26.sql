-- 2026-06-26 — Thêm trạng thái hoạt động cho tài khoản (ngừng hoạt động / kích hoạt lại)
-- An toàn: chỉ THÊM cột, mặc định TRUE -> mọi tài khoản hiện có vẫn đang hoạt động bình thường.
-- Tài khoản nhân viên đã nghỉ sẽ được set active = false (vào danh sách "Ngừng hoạt động"),
-- giữ nguyên lịch sử task/đề xuất (không xoá khoá ngoại).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Đảm bảo các dòng cũ (nếu có NULL) đều coi là đang hoạt động.
UPDATE profiles SET active = true WHERE active IS NULL;
