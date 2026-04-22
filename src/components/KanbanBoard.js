import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { logActivity, ACTIONS } from '@/lib/activityLog';

// Feature 7 — Kanban Board view
// 4 cot tuong ung 4 trang thai: Chua lam / Dang lam / Cho phan hoi / Hoan thanh
// Drag-drop giua cac cot de doi trang thai. Pinned task luon len dau moi cot.

const COLUMNS = [
  { id: 'todo',    label: 'Chưa làm',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'doing',   label: 'Đang thực hiện', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'waiting', label: 'Chờ phản hồi',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'done',    label: 'Hoàn thành',     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
];

const PR = { high: { l: 'Cao', c: '#dc2626' }, medium: { l: 'TB', c: '#d97706' }, low: { l: 'Thấp', c: '#2563eb' } };

export default function KanbanBoard({ tasks, members, isAdmin, isDirector, canPinTasks, userId, onRefresh, department, currentUserName, onOpenTask }) {
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [overdueModal, setOverdueModal] = useState(null); // { taskId, status }
  const [overdueReason, setOverdueReason] = useState('');
  const [overdueNote, setOverdueNote] = useState('');

  // Only show parent approved tasks
  const parentTasks = tasks.filter(t => !t.parent_id && t.approval_status !== 'pending');

  // Group by status, pinned truoc
  const byStatus = { todo: [], doing: [], waiting: [], done: [] };
  for (const t of parentTasks) {
    const s = byStatus[t.status] ? t.status : 'todo';
    byStatus[s].push(t);
  }
  // Sort pinned truoc trong moi cot
  for (const key of Object.keys(byStatus)) {
    byStatus[key].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return 0;
    });
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
  const isOverdue = (d, s) => s !== 'done' && d && new Date(d) < new Date();
  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  function onDragStart(e, taskId) {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    // Cho drop preview cleanly, set 1 payload ngan
    try { e.dataTransfer.setData('text/plain', taskId); } catch {}
  }

  function onDragEnd() {
    setDragTaskId(null);
    setDragOverCol(null);
  }

  function onDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  }

  function onDragLeave(e, colId) {
    // Chi clear neu khong vao 1 child element
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverCol === colId) setDragOverCol(null);
  }

  async function onDrop(e, newStatus) {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = dragTaskId || e.dataTransfer.getData('text/plain');
    setDragTaskId(null);
    if (!taskId) return;
    const task = parentTasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.status === newStatus) return;

    // Neu task qua han va chuyen sang done/waiting -> yeu cau ly do (nhu TaskList)
    const overdueNow = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
    const needsReason = overdueNow && (newStatus === 'done' || newStatus === 'waiting') && !task.overdue_reason;
    if (needsReason) {
      setOverdueModal({ taskId, status: newStatus });
      setOverdueReason(''); setOverdueNote('');
      return;
    }

    await applyStatusChange(taskId, newStatus);
  }

  async function applyStatusChange(taskId, newStatus, extra = {}) {
    const task = parentTasks.find(t => t.id === taskId);
    if (!task) return;
    const u = { status: newStatus, updated_at: new Date().toISOString(), ...extra };
    if (newStatus === 'done') u.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tasks').update(u).eq('id', taskId);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }

    // Push notify creator
    if (task.created_by !== userId) {
      const col = COLUMNS.find(c => c.id === newStatus);
      sendPush(task.created_by, col?.label || newStatus, (currentUserName || 'Ai đó') + ' chuyển "' + task.title + '" → ' + (col?.label || newStatus), { url: '/dashboard', tag: 'status-' + taskId });
    }

    // Activity log
    logActivity({
      userId, userName: currentUserName,
      action: ACTIONS.TASK_STATUS_CHANGED,
      targetType: 'task', targetId: taskId, targetTitle: task.title,
      details: { old_status: task.status, new_status: newStatus, source: 'kanban' },
      department: task.department,
    });

    const col = COLUMNS.find(c => c.id === newStatus);
    toast(col?.label || 'Đã cập nhật', 'success');
    onRefresh && onRefresh();
  }

  async function submitOverdueReason() {
    if (!overdueReason) return toast('Vui lòng chọn lý do', 'error');
    const { taskId, status } = overdueModal;
    await applyStatusChange(taskId, status, {
      overdue_reason: overdueReason,
      overdue_reason_note: overdueNote.trim() || null,
      overdue_reason_at: new Date().toISOString(),
      overdue_reason_by: userId,
    });
    setOverdueModal(null); setOverdueReason(''); setOverdueNote('');
  }

  async function togglePin(e, task) {
    e.stopPropagation();
    if (!canPinTasks) return;
    const newPinned = !task.pinned;
    const { error } = await supabase.from('tasks').update({ pinned: newPinned, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    toast(newPinned ? '📌 Đã ghim task' : 'Đã bỏ ghim', 'success');
    onRefresh && onRefresh();
  }

  const canDrag = true; // Ai cung co the doi trang thai task cua minh
  const canPin = !!canPinTasks;

  return (
    <div className="space-y-3">
      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const tasksInCol = byStatus[col.id] || [];
          const isDropTarget = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={e => onDragOver(e, col.id)}
              onDragLeave={e => onDragLeave(e, col.id)}
              onDrop={e => onDrop(e, col.id)}
              className={`rounded-2xl border-2 transition-all ${isDropTarget ? 'ring-2 ring-emerald-400 scale-[1.01]' : ''}`}
              style={{ background: col.bg, borderColor: isDropTarget ? '#10b981' : col.border, minHeight: 200 }}
            >
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: col.border }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.label}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white" style={{ color: col.color }}>
                  {tasksInCol.length}
                </span>
              </div>
              <div className="p-2 space-y-2">
                {tasksInCol.length === 0 && (
                  <div className="text-center py-8 text-[11px] text-gray-300 italic">
                    {isDropTarget ? 'Thả vào đây' : 'Trống'}
                  </div>
                )}
                {tasksInCol.map(t => {
                  const pr = PR[t.priority] || PR.medium;
                  const od = isOverdue(t.deadline, t.status);
                  const assigneeNames = t.assignees?.map(a => a.user?.name).filter(Boolean);
                  const subs = t.subtasks || [];
                  const isDragging = dragTaskId === t.id;
                  return (
                    <div
                      key={t.id}
                      draggable={canDrag}
                      onDragStart={e => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => onOpenTask && onOpenTask(t.id)}
                      className={`bg-white rounded-xl border p-2.5 cursor-pointer hover:shadow-sm transition-all ${isDragging ? 'opacity-40 scale-95' : ''} ${t.pinned ? 'border-l-[3px] border-l-amber-500' : od ? 'border-l-[3px] border-l-red-500' : 'border-gray-200'}`}
                      title="Kéo để đổi trạng thái, click để mở chi tiết"
                    >
                      <div className="flex items-start gap-1.5 mb-1.5">
                        {t.pinned && <span className="text-xs flex-shrink-0 mt-0.5" title="Đã ghim">📌</span>}
                        <p className={`text-xs font-semibold flex-1 leading-snug ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {t.title}
                        </p>
                        {canPin && (
                          <button
                            onClick={e => togglePin(e, t)}
                            className={`flex-shrink-0 text-[10px] w-4 h-4 rounded hover:bg-amber-50 transition-colors ${t.pinned ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
                            title={t.pinned ? 'Bỏ ghim' : 'Ghim'}
                          >
                            {t.pinned ? '📌' : '📍'}
                          </button>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[10px] text-gray-500 line-clamp-2 mb-1.5">{t.description}</p>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: pr.c + '15', color: pr.c }}>{pr.l}</span>
                        {t.deadline && (
                          <span className={`text-[9px] ${od ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                            {fmtDate(t.deadline)}{od && ' !'}
                          </span>
                        )}
                        {subs.length > 0 && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 font-semibold">
                            {subs.filter(s => s.status === 'done').length}/{subs.length} con
                          </span>
                        )}
                        {t.files?.length > 0 && (
                          <span className="text-[9px] text-gray-400">📎{t.files.length}</span>
                        )}
                      </div>
                      {assigneeNames && assigneeNames.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-50">
                          <div className="flex -space-x-1">
                            {t.assignees.slice(0, 3).map((a, i) => (
                              <div
                                key={a.user_id}
                                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-semibold"
                                style={{ background: a.user?.avatar_color || '#f3f4f6', color: '#333', zIndex: 10 - i }}
                                title={a.user?.name}
                              >
                                {ini(a.user?.name)}
                              </div>
                            ))}
                          </div>
                          {t.assignees.length > 3 && (
                            <span className="text-[9px] text-gray-400">+{t.assignees.length - 3}</span>
                          )}
                          {t.assignees.length <= 3 && (
                            <span className="text-[9px] text-gray-400 truncate flex-1">{assigneeNames[0]}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {parentTasks.length === 0 && (
        <div className="card p-10 text-center text-gray-400 text-sm">Chưa có task</div>
      )}

      {/* Help text */}
      <div className="text-center text-[10px] text-gray-400 italic pt-1">
        💡 Kéo-thả task giữa các cột để đổi trạng thái · Click task để mở chi tiết trong tab List
      </div>

      {/* Overdue reason modal */}
      {overdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOverdueModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-red-700 mb-1">⚠ Task này đã trễ hạn</h3>
            <p className="text-xs text-gray-500 mb-3">Vui lòng chọn lý do trễ trước khi đổi trạng thái. Dữ liệu này phục vụ báo cáo cuối tháng.</p>
            <div className="space-y-1.5 mb-3">
              {[
                'Không đủ thời gian',
                'Thiếu nguồn lực / công cụ',
                'Chờ phản hồi từ người khác',
                'Ưu tiên việc khẩn cấp khác',
                'Quên / sót việc',
                'Khác (ghi chú thêm bên dưới)',
              ].map(r => (
                <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs ${overdueReason === r ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="overdue-reason-kb" checked={overdueReason === r} onChange={() => setOverdueReason(r)} className="accent-emerald-600" />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <textarea
              className="input-field !text-xs w-full mb-3"
              rows={2}
              placeholder="Ghi chú thêm (tùy chọn)..."
              value={overdueNote}
              onChange={e => setOverdueNote(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOverdueModal(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Hủy</button>
              <button onClick={submitOverdueReason} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#123524' }}>Xác nhận & cập nhật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
