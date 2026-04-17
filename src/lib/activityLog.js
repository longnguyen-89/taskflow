import { supabase } from './supabase';

// Ghi log hoat dong vao bang activity_log. Non-blocking (khong throw loi).
export async function logActivity({ userId, userName, action, targetType, targetId, targetTitle, details, department, branch }) {
  try {
    await supabase.from('activity_log').insert({
      user_id: userId || null,
      user_name: userName || null,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      target_title: targetTitle || null,
      details: details || null,
      department: department || null,
      branch: branch || null,
    });
  } catch (e) {
    // Non-blocking: activity log la nice-to-have, khong lam fail action chinh.
    console.log('Activity log failed:', e.message);
  }
}

// Action constants de dong bo giua cac component.
export const ACTIONS = {
  TASK_CREATED: 'task_created',
  TASK_STATUS_CHANGED: 'task_status_changed',
  TASK_DELETED: 'task_deleted',
  SUBTASK_CREATED: 'subtask_created',
  PROPOSAL_CREATED: 'proposal_created',
  PROPOSAL_APPROVED: 'proposal_approved',
  PROPOSAL_REJECTED: 'proposal_rejected',
  PROPOSAL_DELETED: 'proposal_deleted',
  USER_CREATED: 'user_created',
  USER_DELETED: 'user_deleted',
  PASSWORD_RESET: 'password_reset',
  COMMENT_ADDED: 'comment_added',
};

// Labels tieng Viet cho hien thi.
export const ACTION_LABELS = {
  task_created: 'Tạo task',
  task_status_changed: 'Đổi trạng thái task',
  task_deleted: 'Xóa task',
  subtask_created: 'Tạo nhiệm vụ con',
  proposal_created: 'Tạo đề xuất',
  proposal_approved: 'Duyệt đề xuất',
  proposal_rejected: 'Từ chối đề xuất',
  proposal_deleted: 'Xóa đề xuất',
  user_created: 'Tạo tài khoản',
  user_deleted: 'Xóa tài khoản',
  password_reset: 'Reset mật khẩu',
  comment_added: 'Bình luận',
};

export const ACTION_ICONS = {
  task_created: '📋',
  task_status_changed: '🔄',
  task_deleted: '🗑',
  subtask_created: '📌',
  proposal_created: '📝',
  proposal_approved: '✅',
  proposal_rejected: '❌',
  proposal_deleted: '🗑',
  user_created: '👤',
  user_deleted: '🚫',
  password_reset: '🔑',
  comment_added: '💬',
};
