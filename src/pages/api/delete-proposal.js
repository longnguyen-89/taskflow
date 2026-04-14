import { createClient } from '@supabase/supabase-js';

// Xoá vĩnh viễn 1 đề xuất + toàn bộ liên kết.
// Bypass RLS bằng service_role. Verify requester là TGĐ ở server.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { proposalId, requesterId } = req.body;
  if (!proposalId || !requesterId) return res.status(400).json({ error: 'Thiếu proposalId / requesterId' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: requester, error: reqErr } = await admin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được xoá' });

  const childTables = ['proposal_approvers', 'proposal_watchers', 'proposal_files', 'comments', 'notifications'];
  for (const tbl of childTables) {
    try { await admin.from(tbl).delete().eq('proposal_id', proposalId); } catch (e) { /* ignore */ }
  }
  const { error } = await admin.from('proposals').delete().eq('id', proposalId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
