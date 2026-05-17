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
  TASK_UPDATED: 'task_updated',
  TASK_STATUS_CHANGED: 'task_status_changed',
  TASK_DELETED: 'task_deleted',
  TASK_ASSIGNEE_ADDED: 'task_assignee_added',
  TASK_ASSIGNEE_REMOVED: 'task_assignee_removed',
  TASK_WATCHER_ADDED: 'task_watcher_added',
  TASK_WATCHER_REMOVED: 'task_watcher_removed',
  SUBTASK_CREATED: 'subtask_created',
  PROPOSAL_CREATED: 'proposal_created',
  PROPOSAL_UPDATED: 'proposal_updated',
  PROPOSAL_APPROVED: 'proposal_approved',
  PROPOSAL_REJECTED: 'proposal_rejected',
  PROPOSAL_DELETED: 'proposal_deleted',
  PROPOSAL_APPROVER_ADDED: 'proposal_approver_added',
  PROPOSAL_APPROVER_REMOVED: 'proposal_approver_removed',
  PROPOSAL_WATCHER_ADDED: 'proposal_watcher_added',
  PROPOSAL_WATCHER_REMOVED: 'proposal_watcher_removed',
  USER_CREATED: 'user_created',
  USER_DELETED: 'user_deleted',
  PASSWORD_RESET: 'password_reset',
  COMMENT_ADDED: 'comment_added',
};

// Labels tieng Viet cho hien thi.
export const ACTION_LABELS = {
  task_created: 'Tạo task',
  task_updated: 'Sửa task',
  task_status_changed: 'Đổi trạng thái task',
  task_deleted: 'Xóa task',
  task_assignee_added: 'Thêm người nhận',
  task_assignee_removed: 'Bỏ người nhận',
  task_watcher_added: 'Thêm người theo dõi',
  task_watcher_removed: 'Bỏ người theo dõi',
  subtask_created: 'Tạo nhiệm vụ con',
  proposal_created: 'Tạo đề xuất',
  proposal_updated: 'Sửa đề xuất',
  proposal_approved: 'Duyệt đề xuất',
  proposal_rejected: 'Từ chối đề xuất',
  proposal_deleted: 'Xóa đề xuất',
  proposal_approver_added: 'Thêm người duyệt',
  proposal_approver_removed: 'Bỏ người duyệt',
  proposal_watcher_added: 'Thêm người theo dõi đề xuất',
  proposal_watcher_removed: 'Bỏ người theo dõi đề xuất',
  user_created: 'Tạo tài khoản',
  user_deleted: 'Xóa tài khoản',
  password_reset: 'Reset mật khẩu',
  comment_added: 'Bình luận',
};

export const ACTION_ICONS = {
  task_created: '📋',
  task_updated: '✏️',
  task_status_changed: '🔄',
  task_deleted: '🗑',
  task_assignee_added: '➕',
  task_assignee_removed: '➖',
  task_watcher_added: '👁',
  task_watcher_removed: '🙈',
  subtask_created: '📌',
  proposal_created: '📝',
  proposal_updated: '✏️',
  proposal_approved: '✅',
  proposal_rejected: '❌',
  proposal_deleted: '🗑',
  proposal_approver_added: '➕',
  proposal_approver_removed: '➖',
  proposal_watcher_added: '👁',
  proposal_watcher_removed: '🙈',
  user_created: '👤',
  user_deleted: '🚫',
  password_reset: '🔑',
  comment_added: '💬',
};
