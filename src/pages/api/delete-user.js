import { createClient } from '@supabase/supabase-js';

// Xoá vĩnh viễn 1 user (auth + profile + mọi liên kết).
// CHỈ TGĐ mới được phép gọi — kiểm tra role ở server side.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, requesterId } = req.body;
  if (!userId || !requesterId) return res.status(400).json({ error: 'Thiếu userId / requesterId' });
  if (userId === requesterId) return res.status(400).json({ error: 'Không thể tự xoá chính mình' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Xác thực requester là TGĐ
  const { data: requester, error: reqErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được xoá user' });

  // Dọn các bảng trung gian (ignore errors nếu bảng không có rows)
  const cleanups = [
    ['notifications', 'user_id'],
    ['task_assignees', 'user_id'],
    ['task_watchers', 'user_id'],
    ['proposal_approvers', 'user_id'],
    ['proposal_watchers', 'user_id'],
    ['push_subscriptions', 'user_id'],
    ['comments', 'user_id'],
  ];
  for (const [table, col] of cleanups) {
    try { await supabaseAdmin.from(table).delete().eq(col, userId); } catch (e) { /* bảng có thể không tồn tại */ }
  }

  // Xoá profile
  const { error: pErr } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
  if (pErr) return res.status(400).json({ error: 'Lỗi xoá profile: ' + pErr.message + '. Có thể user còn tạo task/đề xuất — xoá task/đề xuất trước.' });

  // Xoá auth user
  const { error: aErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (aErr) return res.status(400).json({ error: 'Đã xoá profile nhưng lỗi xoá auth: ' + aErr.message });

  return res.status(200).json({ success: true });
}
