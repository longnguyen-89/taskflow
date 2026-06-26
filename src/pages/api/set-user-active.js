import { createClient } from '@supabase/supabase-js';

// Cho 1 tài khoản NGỪNG HOẠT ĐỘNG (active=false) hoặc KÍCH HOẠT LẠI (active=true).
// Khác delete-user: KHÔNG xoá dữ liệu — chỉ đổi trạng thái + chặn/mở đăng nhập (ban auth user).
// Quyền: TGĐ, hoặc Quản lý (admin) khi bật quyền `admin_manage_users`.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, requesterId, active } = req.body;
  if (!userId || !requesterId || typeof active !== 'boolean')
    return res.status(400).json({ error: 'Thiếu userId / requesterId / active' });
  if (userId === requesterId) return res.status(400).json({ error: 'Không thể tự đổi trạng thái chính mình' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Xác thực quyền của requester (TGĐ, hoặc Quản lý có quyền quản lý tài khoản)
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
  if (!allowed) return res.status(403).json({ error: 'Không có quyền quản lý tài khoản' });

  // Cập nhật trạng thái profile
  const { error: pErr } = await supabaseAdmin.from('profiles').update({ active }).eq('id', userId);
  if (pErr) return res.status(400).json({ error: 'Lỗi cập nhật trạng thái: ' + pErr.message });

  // Chặn / mở đăng nhập (ban auth user). Non-fatal nếu lỗi — profile vẫn đã đổi.
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h', // ~100 năm
    });
  } catch (e) { /* non-fatal */ }

  return res.status(200).json({ success: true });
}
