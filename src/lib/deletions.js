import { supabase } from '@/lib/supabase';

// Xoá 1 task + toàn bộ dữ liệu liên quan (subtasks, files, comments, assignees, watchers, checklist, notifications).
// CHỈ gọi sau khi đã xác nhận người dùng là TGĐ.
export async function deleteTaskCascade(taskId) {
  // Lấy danh sách task_id cần xoá: chính task + subtasks
  const { data: subs } = await supabase.from('tasks').select('id').eq('parent_id', taskId);
  const allIds = [taskId, ...(subs || []).map(s => s.id)];

  // Xoá từ bảng con trước
  const children = ['task_checklist', 'task_files', 'task_assignees', 'task_watchers', 'comments', 'notifications'];
  for (const tbl of children) {
    try { await supabase.from(tbl).delete().in('task_id', allIds); } catch (e) { /* ignore */ }
  }

  // Xoá subtasks
  if ((subs || []).length > 0) {
    await supabase.from('tasks').delete().eq('parent_id', taskId);
  }
  // Xoá task chính
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  return { error };
}

// Xoá 1 đề xuất + toàn bộ dữ liệu liên quan.
export async function deleteProposalCascade(proposalId) {
  const children = ['proposal_approvers', 'proposal_watchers', 'proposal_files', 'comments', 'notifications'];
  for (const tbl of children) {
    try { await supabase.from(tbl).delete().eq('proposal_id', proposalId); } catch (e) { /* ignore */ }
  }
  const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
  return { error };
}
