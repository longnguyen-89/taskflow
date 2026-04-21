-- 2026-04-21: Them cot data JSONB vao notifications
-- Dung cho notification type='ceo_report' — luu KPI co cau truc (nail, hotel, totals)
-- de render card truc quan thay vi plain text block dai.
-- Safe migration: IF NOT EXISTS, nullable, khong anh huong notification cu.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;

COMMENT ON COLUMN notifications.data IS 'Optional structured payload. Dung cho type=ceo_report (KPI), future: reminders, rich messages. Null voi notifications thong thuong.';
