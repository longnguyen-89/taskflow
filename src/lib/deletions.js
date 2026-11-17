// Xoá task/đề xuất qua API server-side (bypass RLS bằng service_role).
// Verify role='director' ở server theo access token (apiFetch gắn Bearer).
// Tham số thứ 2 (requesterId) cũ của nơi gọi được bỏ qua — server không còn tin nó.
import { apiFetch } from '@/lib/apiFetch';

export async function deleteTaskCascade(taskId) {
  try {
    const res = await apiFetch('/api/delete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error || 'Lỗi không xác định' } };
    return { error: null };
  } catch (e) {
    return { error: { message: 'Lỗi mạng: ' + e.message } };
  }
}

export async function deleteProposalCascade(proposalId) {
  try {
    const res = await apiFetch('/api/delete-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error || 'Lỗi không xác định' } };
    return { error: null };
  } catch (e) {
    return { error: { message: 'Lỗi mạng: ' + e.message } };
  }
}
