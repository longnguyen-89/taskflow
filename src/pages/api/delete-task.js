import { createClient } from '@supabase/supabase-js';

// Xoá vĩnh viễn 1 task + toàn bộ liên kết (subtasks, files, comments, assignees, watchers, checklist).
// Bypass RLS bằng service_role. Verify requester là TGĐ ở server.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { taskId, requesterId } = req.body;
  if (!taskId || !requesterId) return res.status(400).json({ error: 'Thiếu taskId / requesterId' });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: requester, error: reqErr } = await admin
    .from('profiles').select('role').eq('id', requesterId).single();
  if (reqErr || !requester) return res.status(403).json({ error: 'Không tìm thấy người gọi' });
  if (requester.role !== 'director') return res.status(403).json({ error: 'Chỉ TGĐ mới được xoá' });

  // Tập hợp task_id cần xoá: chính task + subtask
  const { data: subs } = await admin.from('tasks').select('id').eq('parent_id', taskId);
  const allIds = [taskId, ...(subs || []).map(s => s.id)];

  const childTables = ['task_checklist', 'task_files', 'task_assignees', 'task_watchers', 'comments', 'notifications'];
  for (const tbl of childTables) {
    try { await admin.from(tbl).delete().in('task_id', allIds); } catch (e) { /* ignore */ }
  }

  // Xoá subtasks rồi task chính
  if ((subs || []).length > 0) {
    await admin.from('tasks').delete().eq('parent_id', taskId);
  }
  const { error } = await admin.from('tasks').delete().eq('id', taskId);
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ success: true });
}
