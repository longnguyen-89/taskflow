// Xoá task/đề xuất qua API server-side (bypass RLS bằng service_role).
// Verify role='director' ở server để đảm bảo an toàn.

export async function deleteTaskCascade(taskId, requesterId) {
  try {
    const res = await fetch('/api/delete-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, requesterId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error || 'Lỗi không xác định' } };
    return { error: null };
  } catch (e) {
    return { error: { message: 'Lỗi mạng: ' + e.message } };
  }
}

export async function deleteProposalCascade(proposalId, requesterId) {
  try {
    const res = await fetch('/api/delete-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, requesterId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error || 'Lỗi không xác định' } };
    return { error: null };
  } catch (e) {
    return { error: { message: 'Lỗi mạng: ' + e.message } };
  }
}
