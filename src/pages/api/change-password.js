import { createClient } from '@supabase/supabase-js';

// User tu doi mat khau cua chinh minh.
// Verify mat khau cu bang signInWithPassword truoc khi update.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify mat khau cu bang cach thu login
  const supabaseVerify = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: signIn, error: signInErr } = await supabaseVerify.auth.signInWithPassword({ email, password: oldPassword });
  if (signInErr || !signIn?.user) return res.status(403).json({ error: 'Mật khẩu cũ không đúng' });

  // Update mat khau moi
  const { error } = await supabaseAdmin.auth.admin.updateUserById(signIn.user.id, { password: newPassword });
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}
