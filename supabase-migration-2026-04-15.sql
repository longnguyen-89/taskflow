-- 2026-04-15: Mở rộng tần suất task lặp lại
-- Thêm: quarterly (3 tháng), semiannual (6 tháng), yearly (1 năm)

ALTER TABLE recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_frequency_check;
ALTER TABLE recurring_tasks ADD CONSTRAINT recurring_tasks_frequency_check
  CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'));

-- Tháng tham chiếu (1-12). Dùng cho:
--  yearly      -> chỉ sinh đúng tháng này hằng năm
--  semiannual  -> sinh ở tháng này và tháng (this+6)
--  quarterly   -> sinh ở tháng này và mỗi 3 tháng kế tiếp
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS month_of_year INT
  CHECK (month_of_year BETWEEN 1 AND 12);
