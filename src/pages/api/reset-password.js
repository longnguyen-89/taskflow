import { createClient } from '@supabase/supabase-js';

// TGD reset mat khau cho nguoi khac. Verify requester la director.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, newPassword, requesterId } = req.body;
  if (!userId || !newPassword || !requesterId) return res.status(400).json({ error: 'Thiếu thông tin' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify requester la director
  const { data: requester, error: reqErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được reset mật khẩu' });

  // Update password
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}
