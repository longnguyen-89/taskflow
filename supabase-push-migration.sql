-- ============================================================
-- PUSH NOTIFICATIONS + DEADLINE REMINDERS - MIGRATION
-- Chạy trong Supabase SQL Editor (BỔ SUNG, không xóa dữ liệu)
-- ============================================================

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_sel" ON push_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "push_ins" ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_upd" ON push_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_del" ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- ============================================================
-- DONE! Giờ deploy Edge Functions.
-- ============================================================
