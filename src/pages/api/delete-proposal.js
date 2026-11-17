import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/apiAuth';

// Xoá vĩnh viễn 1 đề xuất + toàn bộ liên kết.
// Bypass RLS bằng service_role. Verify người gọi (theo access token) là TGĐ ở server.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const requester = await requireStaff(req, res, admin);
  if (!requester) return;
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được xoá' });

  const { proposalId } = req.body || {};
  if (!proposalId) return res.status(400).json({ error: 'Thiếu proposalId' });

  const childTables = ['proposal_approvers', 'proposal_watchers', 'proposal_files', 'comments', 'notifications'];
  for (const tbl of childTables) {
    try { await admin.from(tbl).delete().eq('proposal_id', proposalId); } catch (e) { /* ignore */ }
  }
  const { error } = await admin.from('proposals').delete().eq('id', proposalId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
