import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/apiAuth';

// TGD reset mat khau cho nguoi khac. Nguoi goi lay tu access token (khong tin requesterId).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const requester = await requireStaff(req, res, supabaseAdmin);
  if (!requester) return;
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được reset mật khẩu' });

  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });

  // Update password
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}
