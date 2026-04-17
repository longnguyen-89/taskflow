-- 2026-04-17 (late night): Feature 12 — Reactions tren comment
-- Them bang comment_reactions cho phep user react emoji len tung comment
-- Safe migration: IF NOT EXISTS, khong anh huong data cu

CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON comment_reactions(user_id);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Ai dang nhap deu doc duoc reactions
DROP POLICY IF EXISTS "reactions_sel" ON comment_reactions;
CREATE POLICY "reactions_sel" ON comment_reactions FOR SELECT TO authenticated USING (true);

-- Chi duoc insert reaction cho chinh minh
DROP POLICY IF EXISTS "reactions_ins" ON comment_reactions;
CREATE POLICY "reactions_ins" ON comment_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Chi duoc xoa reaction cua minh (toggle off)
DROP POLICY IF EXISTS "reactions_del" ON comment_reactions;
CREATE POLICY "reactions_del" ON comment_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE comment_reactions IS 'Emoji reactions tren comment (Feature 12). User co the toggle nhieu emoji tren 1 comment, nhung moi emoji chi 1 lan.';
