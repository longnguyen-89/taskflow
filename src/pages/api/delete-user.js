import { createClient } from '@supabase/supabase-js';

// Xoá vĩnh viễn 1 user (auth + profile + mọi liên kết).
// Quyền: TGĐ, hoặc Quản lý (admin) khi bật quyền `admin_manage_users` — kiểm tra ở server side.
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

  // Xác thực quyền: TGĐ, hoặc Quản lý (admin) có quyền quản lý tài khoản
  const { data: requester, error: reqErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });

  let allowed = requester.role === 'director';
  if (!allowed && requester.role === 'admin') {
    const { data: perm } = await supabaseAdmin
      .from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
    const v = perm?.value ? (typeof perm.value === 'string' ? JSON.parse(perm.value) : perm.value) : {};
    allowed = !!v.admin_manage_users;
  }
  if (!allowed) return res.status(403).json({ error: 'Không có quyền xoá tài khoản' });

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
