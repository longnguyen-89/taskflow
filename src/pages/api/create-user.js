import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name, role, position, department, branches, requesterId } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  // Use service role key to create user without affecting current session
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Auth check: chỉ director mới được tạo user
  if (!requesterId) return res.status(403).json({ error: 'Thiếu requesterId' });
  const { data: requester, error: reqErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ Tổng Giám đốc mới được tạo tài khoản' });

  // Create auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, position, department }
  });

  if (error) return res.status(400).json({ error: error.message });

  // Create profile
  const colors = ['#E6F1FB', '#E1F5EE', '#FAEEDA', '#EEEDFE', '#FAECE7', '#FBEAF0', '#EAF3DE', '#F1EFE8'];
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    email,
    name,
    role: role || 'member',
    position: position || 'Kỹ thuật viên',
    department: department || 'nail',
    branches: Array.isArray(branches) && branches.length > 0 ? branches : null,
    avatar_color: colors[Math.floor(Math.random() * colors.length)],
  });

  if (profileError) return res.status(400).json({ error: profileError.message });

  return res.status(200).json({ success: true, userId: data.user.id });
}
