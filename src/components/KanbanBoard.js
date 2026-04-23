import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { logActivity, ACTIONS } from '@/lib/activityLog';
import TaskDetailModal from '@/components/TaskDetailModal';

// Feature 7 — Kanban Board view (Coco Pro v2)
// 4 cột: Chưa làm / Đang làm / Chờ phản hồi / Hoàn thành
// Drag-drop giữa các cột để đổi trạng thái. Pinned task luôn lên đầu mỗi cột.

const COLUMNS = [
  { id: 'todo',    label: 'Chưa làm',        tone: 'muted'  },
  { id: 'doing',   label: 'Đang làm',        tone: 'accent' },
  { id: 'waiting', label: 'Chờ phản hồi',    tone: 'warn'   },
  { id: 'done',    label: 'Hoàn thành',      tone: 'ok'     },
];

const toneVar = (tone) => ({
  muted:  'var(--muted)',
  accent: 'var(--accent)',
  warn:   'var(--warn)',
  ok:     'var(--accent)',
  danger: 'var(--danger)',
}[tone] || 'var(--muted)');

export default function KanbanBoard({ tasks, members, isAdmin, isDirector, canPinTasks, canDeleteTask, userId, onRefresh, department, currentUserName, currentUserRole, onOpenTask }) {
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [overdueModal, setOverdueModal] = useState(null);
  const [overdueReason, setOverdueReason] = useState('');
  const [overdueNote, setOverdueNote] = useState('');
  // Task detail modal — mở khi click card (thay cho navigate sang list view)
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const selectedTask = selectedTaskId ? (tasks || []).find(t => t.id === selectedTaskId) : null;

  const parentTasks = tasks.filter(t => !t.parent_id && t.approval_status !== 'pending');

  const byStatus = { todo: [], doing: [], waiting: [], done: [] };
  for (const t of parentTasks) {
    const s = byStatus[t.status] ? t.status : 'todo';
    byStatus[s].push(t);
  }
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
    try { e.dataTransfer.setData('text/plain', taskId); } catch {}
  }
  function onDragEnd() { setDragTaskId(null); setDragOverCol(null); }
  function onDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  }
  function onDragLeave(e, colId) {
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

    if (task.created_by !== userId) {
      const col = COLUMNS.find(c => c.id === newStatus);
      sendPush(task.created_by, col?.label || newStatus, (currentUserName || 'Ai đó') + ' chuyển "' + task.title + '" → ' + (col?.label || newStatus), { url: '/dashboard', tag: 'status-' + taskId });
    }

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
    toast(newPinned ? 'Đã ghim task' : 'Đã bỏ ghim', 'success');
    onRefresh && onRefresh();
  }

  const canPin = !!canPinTasks;

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const tasksInCol = byStatus[col.id] || [];
          const isDropTarget = dragOverCol === col.id;
          const tc = toneVar(col.tone);
          return (
            <div
              key={col.id}
              onDragOver={e => onDragOver(e, col.id)}
              onDragLeave={e => onDragLeave(e, col.id)}
              onDrop={e => onDrop(e, col.id)}
              className="flex flex-col gap-2"
              style={{ minHeight: 300 }}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 px-2.5 py-2 card transition-all"
                style={{
                  borderTop: `2px solid ${tc}`,
                  background: isDropTarget ? 'var(--bg-soft)' : '#fff',
                  boxShadow: isDropTarget ? '0 0 0 2px var(--accent)' : undefined,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tc }} />
                <span className="text-xs font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>{col.label}</span>
                <span className="text-[11px] font-mono text-muted-ink ml-auto">{tasksInCol.length}</span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {tasksInCol.length === 0 && (
                  <div
                    className="text-center py-6 text-[11px] italic rounded-xl2"
                    style={{ color: 'var(--muted)', border: '1px dashed var(--line)' }}
                  >
                    {isDropTarget ? 'Thả task vào đây' : 'Trống'}
                  </div>
                )}
                {tasksInCol.map(t => {
                  const od = isOverdue(t.deadline, t.status);
                  const isToday = t.deadline && new Date(t.deadline).toDateString() === new Date().toDateString();
                  const isDragging = dragTaskId === t.id;
                  const dueTone = od ? 'danger' : (isToday ? 'warn' : t.status === 'done' ? 'ok' : 'accent');
                  const dueColor = toneVar(dueTone);
                  const dueBg = dueTone === 'danger' ? 'var(--danger-soft)'
                              : dueTone === 'warn' ? 'var(--warn-soft)'
                              : dueTone === 'ok' ? 'var(--accent-soft)'
                              : 'var(--accent-soft)';

                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={e => onDragStart(e, t.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="card p-3 cursor-grab hover:shadow-card-hover transition-all"
                      style={{
                        borderLeft: t.pinned ? '3px solid var(--gold)' : undefined,
                        opacity: isDragging ? 0.4 : 1,
                        transform: isDragging ? 'scale(.97)' : undefined,
                      }}
                      title="Kéo để đổi trạng thái, click để mở chi tiết"
                    >
                      {/* Top row: meta + priority */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                          {t.pinned && (
                            <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--gold)' }} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" />
                            </svg>
                          )}
                          <span>#{String(t.id).slice(0, 6)}</span>
                          {t.branch && <><span>·</span><span className="truncate max-w-[80px]">{t.branch}</span></>}
                        </div>
                        <div className="flex items-center gap-1">
                          {t.priority === 'high' && (
                            <span className="pill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 10 }}>
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 4a1 1 0 011-1h10a1 1 0 01.76 1.65l-2.5 3 2.5 3A1 1 0 0114 12H5v5a1 1 0 11-2 0V4z" />
                              </svg>
                              Cao
                            </span>
                          )}
                          {canPin && (
                            <button
                              onClick={e => togglePin(e, t)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-bone-soft transition-colors"
                              style={{ opacity: t.pinned ? 1 : 0.35, color: 'var(--gold)' }}
                              title={t.pinned ? 'Bỏ ghim' : 'Ghim'}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <div
                        className="text-[13px] font-medium mb-2.5 leading-snug"
                        style={{
                          color: t.status === 'done' ? 'var(--muted)' : 'var(--ink)',
                          textDecoration: t.status === 'done' ? 'line-through' : 'none',
                          letterSpacing: '-.005em',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {t.title}
                      </div>

                      {/* Footer: due + avatars */}
                      <div className="flex items-center justify-between gap-2">
                        {t.deadline ? (
                          <span className="pill font-mono" style={{ background: dueBg, color: dueColor, fontSize: 10 }}>
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {fmtDate(t.deadline)}
                          </span>
                        ) : <span className="text-[10px] text-muted-ink font-mono">—</span>}

                        {t.assignees?.length > 0 && (
                          <div className="flex items-center -space-x-1">
                            {t.assignees.slice(0, 3).map((a, i) => (
                              <div
                                key={a.user_id}
                                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-semibold"
                                style={{ background: a.user?.avatar_color || '#f3f4f6', color: '#333', zIndex: 10 - i }}
                                title={a.user?.name}
                              >
                                {ini(a.user?.name)}
                              </div>
                            ))}
                            {t.assignees.length > 3 && (
                              <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-semibold bg-bone-soft text-muted-ink">
                                +{t.assignees.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Stats row */}
                      {((t.comments > 0) || (t.files?.length > 0) || (t.subtasks?.length > 0)) && (
                        <div
                          className="flex items-center gap-2.5 mt-2 pt-2 text-[10px] font-mono"
                          style={{ borderTop: '1px dashed var(--line-2)', color: 'var(--muted)' }}
                        >
                          {t.files?.length > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {t.files.length}
                            </span>
                          )}
                          {t.subtasks?.length > 0 && (
                            <span>· {t.subtasks.filter(s => s.status === 'done').length}/{t.subtasks.length} sub</span>
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
        <div className="card p-10 text-center text-muted-ink text-sm">Chưa có task</div>
      )}

      <div className="text-center text-[10px] italic pt-1 font-mono" style={{ color: 'var(--muted)' }}>
        Kéo-thả task giữa các cột để đổi trạng thái · Click task để mở chi tiết
      </div>

      {/* Task detail modal — click card → open modal với mô tả + file + comment @mention */}
      <TaskDetailModal
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        members={members}
        userId={userId}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
        department={department}
        isAdmin={isAdmin}
        isDirector={isDirector}
        canPinTasks={canPinTasks}
        canDeleteTask={canDeleteTask}
        onRefresh={onRefresh}
      />

      {/* Overdue reason modal */}
      {overdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setOverdueModal(null)}>
          <div className="card max-w-md w-full p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
              <h3 className="text-base font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Task này đã trễ hạn</h3>
            </div>
            <p className="text-xs text-ink-3 mb-3">Vui lòng chọn lý do trễ trước khi đổi trạng thái. Dữ liệu này phục vụ báo cáo cuối tháng.</p>
            <div className="space-y-1.5 mb-3">
              {[
                'Không đủ thời gian',
                'Thiếu nguồn lực / công cụ',
                'Chờ phản hồi từ người khác',
                'Ưu tiên việc khẩn cấp khác',
                'Quên / sót việc',
                'Khác (ghi chú thêm bên dưới)',
              ].map(r => (
                <label
                  key={r}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors"
                  style={{
                    border: `1px solid ${overdueReason === r ? 'var(--accent)' : 'var(--line)'}`,
                    background: overdueReason === r ? 'var(--accent-soft)' : 'transparent',
                    color: overdueReason === r ? 'var(--accent)' : 'var(--ink-2)',
                  }}
                >
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
              <button onClick={() => setOverdueModal(null)} className="btn-secondary">Hủy</button>
              <button onClick={submitOverdueReason} className="btn-primary">Xác nhận & cập nhật</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
