import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { deleteTaskCascade } from '@/lib/deletions';
import { logActivity, ACTIONS } from '@/lib/activityLog';

const ST = { todo: { l: 'Chưa làm', c: '#6b7280' }, doing: { l: 'Đang thực hiện', c: '#2563eb' }, done: { l: 'Hoàn thành', c: '#16a34a' }, waiting: { l: 'Chờ phản hồi', c: '#d97706' } };
const PR = { high: { l: 'Cao', c: '#dc2626' }, medium: { l: 'TB', c: '#d97706' }, low: { l: 'Thấp', c: '#2563eb' } };

function getFileIcon(name) {
  const ext = (name || '').toLowerCase();
  if (ext.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) return '🖼';
  if (ext.match(/\.pdf$/)) return '📄';
  if (ext.match(/\.(doc|docx)$/)) return '📝';
  if (ext.match(/\.(xls|xlsx|csv)$/)) return '📊';
  if (ext.match(/\.(ppt|pptx)$/)) return '📽';
  return '📎';
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function TaskList({ tasks, members, isAdmin, isDirector, canDeleteTask, canPinTasks, userId, onRefresh, department, currentUserRole, currentUserName, focusTaskId, clearFocus }) {

  // Xoá task cứng (TGĐ hoặc Admin có quyền). Có confirm 2 bước.
  async function deleteTask(taskId, taskTitle) {
    if (!canDeleteTask && !isDirector) return;
    const ok = typeof window !== 'undefined' && window.confirm(
      `⚠ XOÁ VĨNH VIỄN task này?\n\n"${taskTitle}"\n\nSẽ xoá cả: sub-task, comment, file đính kèm, checklist, lịch sử. KHÔNG thể khôi phục.`
    );
    if (!ok) return;
    const taskObj = tasks.find(t => t.id === taskId);
    const { error } = await deleteTaskCascade(taskId, userId);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    logActivity({ userId, userName: members.find(m => m.id === userId)?.name, action: ACTIONS.TASK_DELETED, targetType: 'task', targetId: taskId, targetTitle: taskTitle, department: taskObj?.department, branch: taskObj?.branch });
    toast('Đã xoá task', 'success');
    onRefresh && onRefresh();
  }

  // Feature 9: Pin/unpin task (admin + director + accountant). Task ghim hien len dau danh sach.
  async function togglePin(taskId, currentPinned, taskTitle) {
    if (!canPinTasks) return;
    const newPinned = !currentPinned;
    const { error } = await supabase.from('tasks').update({ pinned: newPinned, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    toast(newPinned ? '📌 Đã ghim task' : 'Đã bỏ ghim', 'success');
    onRefresh && onRefresh();
  }

  // Feature 11: Smart @mention - Gan nguoi duoc @mention lam assignee voi 1 click.
  // Quyen: admin/director duoc gan; member chi duoc gan neu la creator cua task do.
  async function assignMentionedUser(taskId, userToAssignId, userName) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const canAssign = isAdmin || isDirector || task.created_by === userId;
    if (!canAssign) { toast('Bạn không có quyền giao task này', 'error'); return; }
    // Kiem tra xem user da la assignee chua
    const existing = (task.assignees || []).some(a => a.user_id === userToAssignId);
    if (existing) { toast(userName + ' đã là người nhận task này', 'error'); return; }
    const { error } = await supabase.from('task_assignees').insert({ task_id: taskId, user_id: userToAssignId });
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    // Gui thong bao cho nguoi nhan task
    try {
      await supabase.from('notifications').insert({
        user_id: userToAssignId,
        type: 'task_assigned',
        title: 'Bạn được giao task',
        message: (currentUserName || 'Ai đó') + ' vừa giao bạn task "' + task.title + '"',
        task_id: taskId,
      });
      sendPush(userToAssignId, '📋 Bạn được giao task', (currentUserName || 'Ai đó') + ': "' + task.title + '"', { url: '/dashboard', tag: 'assigned-' + taskId });
    } catch (e) { /* non-fatal */ }
    toast('✅ Đã giao task cho ' + userName, 'success');
    onRefresh && onRefresh();
  }
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  // Per-task comment draft: { [taskId]: { text, files, mentionedIds } }
  const [commentDrafts, setCommentDrafts] = useState({});
  const [uploading, setUploading] = useState(false);
  // Helpers to get/set per-task draft
  function getDraft(tid) { return commentDrafts[tid] || { text: '', files: [], mentionedIds: [] }; }
  function setDraftField(tid, field, value) {
    setCommentDrafts(prev => ({ ...prev, [tid]: { ...getDraft(tid), [field]: value } }));
  }

  // Build the list of members the current user is allowed to @mention.
  // Rule: managers/staff only see people in their own department,
  // EXCEPT Tổng Giám đốc và Kế toán — they see everyone.
  const isCEOorAcc = currentUserRole === 'director' || currentUserRole === 'accountant';
  const mentionables = (members || []).filter(m =>
    m.id !== userId && (isCEOorAcc || m.department === department || m.role === 'director' || m.role === 'accountant')
  );
  // Checklist state
  const [checklist, setChecklist] = useState({}); // { [taskId]: [{id, text, done, ...}] }
  const [newChkText, setNewChkText] = useState({}); // { [taskId]: string }
  // Overdue reason modal
  const [overdueModal, setOverdueModal] = useState(null); // { taskId, status }
  const [overdueReason, setOverdueReason] = useState('');
  const [overdueNote, setOverdueNote] = useState('');
  // Sub-tasks state
  const [subTasks, setSubTasks] = useState({});
  const [showSubForm, setShowSubForm] = useState(null);
  const [subTitle, setSubTitle] = useState('');
  const [subDeadline, setSubDeadline] = useState('');
  const [subFiles, setSubFiles] = useState([]);
  const [subCreating, setSubCreating] = useState(false);
  // Expanded sub-task
  const [expandedSub, setExpandedSub] = useState(null);
  const [subTaskFiles, setSubTaskFiles] = useState({});

  async function loadComments(tid) {
    // Feature 12: fetch reactions cung voi comment thong qua nested select
    const { data } = await supabase.from('comments')
      .select('*, user:profiles!comments_user_id_fkey(name, avatar_color), reactions:comment_reactions(id, emoji, user_id)')
      .eq('task_id', tid)
      .order('created_at', { ascending: true });
    setComments(p => ({ ...p, [tid]: data || [] }));
  }

  // Feature 12: Toggle reaction (emoji) len 1 comment. Neu da co reaction cua minh voi emoji do → xoa; nguoc lai → them.
  async function toggleReaction(commentId, emoji, taskId) {
    const commentList = comments[taskId] || [];
    const comment = commentList.find(c => c.id === commentId);
    if (!comment) return;
    const existing = (comment.reactions || []).find(r => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      const { error } = await supabase.from('comment_reactions').delete().eq('id', existing.id);
      if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    } else {
      const { error } = await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: userId, emoji });
      if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    }
    loadComments(taskId);
  }

  async function loadChecklist(tid) {
    const { data } = await supabase.from('task_checklist').select('*').eq('task_id', tid).order('position', { ascending: true }).order('created_at', { ascending: true });
    setChecklist(p => ({ ...p, [tid]: data || [] }));
  }

  async function addChecklistItem(tid) {
    const text = (newChkText[tid] || '').trim();
    if (!text) return;
    const items = checklist[tid] || [];
    const pos = items.length;
    await supabase.from('task_checklist').insert({ task_id: tid, text, position: pos });
    setNewChkText(p => ({ ...p, [tid]: '' }));
    loadChecklist(tid);
  }

  async function toggleChecklistItem(item) {
    const newDone = !item.done;
    await supabase.from('task_checklist').update({
      done: newDone,
      done_by: newDone ? userId : null,
      done_at: newDone ? new Date().toISOString() : null,
    }).eq('id', item.id);
    loadChecklist(item.task_id);
  }

  async function removeChecklistItem(item) {
    await supabase.from('task_checklist').delete().eq('id', item.id);
    loadChecklist(item.task_id);
  }

  async function loadSubTasks(parentId) {
    const { data } = await supabase.from('tasks')
      .select('*, files:task_files(*), assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position))')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });
    setSubTasks(p => ({ ...p, [parentId]: data || [] }));
  }

  async function addComment(tid) {
    const draft = getDraft(tid);
    if (!draft.text.trim() && draft.files.length === 0) return;
    setUploading(true);
    const uploadedFiles = [];
    for (const f of draft.files) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = 'comments/' + tid + '/' + Date.now() + '_' + safeName;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        uploadedFiles.push({ name: f.name, url: publicUrl, type: f.type, size: f.size });
      }
    }
    const contentText = draft.text.trim();
    await supabase.from('comments').insert({
      task_id: tid, user_id: userId, content: contentText,
      files: uploadedFiles.length > 0 ? uploadedFiles : null,
    });

    // Notify mentioned users (only those actually referenced in final content)
    try {
      const task = tasks.find(t => t.id === tid);
      const taskTitle = task?.title || '';
      const uniqueIds = Array.from(new Set(draft.mentionedIds));
      for (const mid of uniqueIds) {
        const m = members.find(x => x.id === mid);
        if (!m) continue;
        // Verify @Name still appears in content — user may have deleted it
        if (!contentText.includes('@' + m.name)) continue;
        if (mid === userId) continue;
        await supabase.from('notifications').insert({
          user_id: mid,
          type: 'mention',
          title: 'Bạn được nhắc đến',
          message: `${currentUserName || 'Ai đó'} đã nhắc bạn trong "${taskTitle}"`,
          task_id: tid,
        });
        sendPush(mid, 'Bạn được nhắc đến', `${currentUserName || 'Ai đó'} nhắc bạn trong "${taskTitle}"`, { url: '/dashboard', tag: 'mention-' + tid });
      }
    } catch (e) { /* non-fatal */ }

    setCommentDrafts(prev => { const next = { ...prev }; delete next[tid]; return next; }); setUploading(false); loadComments(tid);
  }

  function handleAddCommentFile(tid, e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setDraftField(tid, 'files', [...getDraft(tid).files, ...newFiles]);
    e.target.value = '';
  }
  function removeCommentFile(tid, index) { setDraftField(tid, 'files', getDraft(tid).files.filter((_, i) => i !== index)); }

  async function updateStatus(tid, s) {
    const task = tasks.find(t => t.id === tid);
    // Nếu task đang quá hạn và user định chuyển sang done/waiting → yêu cầu chọn lý do (nếu chưa có)
    const isOverdueNow = task && task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
    const needsReason = isOverdueNow && (s === 'done' || s === 'waiting') && !task.overdue_reason;
    if (needsReason) {
      setOverdueModal({ taskId: tid, status: s });
      setOverdueReason(''); setOverdueNote('');
      return;
    }
    await applyStatusChange(tid, s);
  }

  async function applyStatusChange(tid, s, extra = {}) {
    const u = { status: s, updated_at: new Date().toISOString(), ...extra };
    if (s === 'done') u.completed_at = new Date().toISOString();
    await supabase.from('tasks').update(u).eq('id', tid);
    const task = tasks.find(t => t.id === tid);
    if (task && task.created_by !== userId) {
      const userName = members.find(m => m.id === userId)?.name || '';
      sendPush(task.created_by, ST[s].l, userName + ' chuyển "' + task.title + '" → ' + ST[s].l, { url: '/dashboard', tag: 'status-' + tid });
    }
    const taskObj = tasks.find(t => t.id === tid);
    logActivity({ userId, userName: members.find(m => m.id === userId)?.name, action: ACTIONS.TASK_STATUS_CHANGED, targetType: 'task', targetId: tid, targetTitle: taskObj?.title, details: { old_status: taskObj?.status, new_status: s }, department: taskObj?.department });
    toast(ST[s].l, 'success'); onRefresh();
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

  // Sub-task status update
  async function updateSubStatus(subId, s, parentId) {
    const u = { status: s, updated_at: new Date().toISOString() };
    if (s === 'done') u.completed_at = new Date().toISOString();
    await supabase.from('tasks').update(u).eq('id', subId);
    toast(ST[s].l, 'success');
    loadSubTasks(parentId);
  }

  // Create sub-task
  function handleAddSubFile(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setSubFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }
  function removeSubFile(index) { setSubFiles(prev => prev.filter((_, i) => i !== index)); }

  async function createSubTask(parentId) {
    if (!subTitle.trim()) return toast('Nhập tiêu đề nhiệm vụ con', 'error');
    setSubCreating(true);
    const parentTask = tasks.find(t => t.id === parentId);
    const { data: sub, error } = await supabase.from('tasks').insert({
      title: subTitle.trim(), parent_id: parentId, department: parentTask?.department || 'nail',
      deadline: subDeadline ? new Date(subDeadline).toISOString() : null,
      created_by: userId, status: 'todo', priority: 'medium', approval_status: 'none'
    }).select().single();
    if (error) { toast('Lỗi: ' + error.message, 'error'); setSubCreating(false); return; }
    // Copy assignees from parent
    const parentAssignees = parentTask?.assignees || [];
    for (const a of parentAssignees) {
      await supabase.from('task_assignees').insert({ task_id: sub.id, user_id: a.user_id });
    }
    // Upload files for sub-task
    for (const f of subFiles) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = `tasks/${sub.id}/${Date.now()}_${safeName}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (!ue) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        await supabase.from('task_files').insert({ task_id: sub.id, file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size, uploaded_by: userId });
      }
    }
    logActivity({ userId, userName: members.find(m => m.id === userId)?.name, action: ACTIONS.SUBTASK_CREATED, targetType: 'task', targetId: sub.id, targetTitle: subTitle.trim(), details: { parent_id: parentId, parent_title: parentTask?.title }, department: parentTask?.department, branch: parentTask?.branch });
    toast('Đã tạo nhiệm vụ con!', 'success');
    setSubTitle(''); setSubDeadline(''); setSubFiles([]); setShowSubForm(null); setSubCreating(false);
    loadSubTasks(parentId);
  }

  function toggle(tid) {
    if (expanded === tid) { setExpanded(null); return; }
    setExpanded(tid);
    if (!comments[tid]) loadComments(tid);
    if (!subTasks[tid]) loadSubTasks(tid);
    if (!checklist[tid]) loadChecklist(tid);
  }

  // Auto expand + scroll khi mở task từ notification.
  useEffect(() => {
    if (!focusTaskId) return;
    // Kiểm tra task có trong list không (có thể bị filter theo dept/branch).
    const exists = tasks.some(t => t.id === focusTaskId || t.parent_id === focusTaskId);
    if (!exists) return;
    setExpanded(focusTaskId);
    if (!comments[focusTaskId]) loadComments(focusTaskId);
    if (!subTasks[focusTaskId]) loadSubTasks(focusTaskId);
    if (!checklist[focusTaskId]) loadChecklist(focusTaskId);
    // Scroll sau khi DOM render.
    const to = setTimeout(() => {
      const el = document.getElementById('task-row-' + focusTaskId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 2500);
      }
      if (clearFocus) clearFocus();
    }, 250);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTaskId, tasks]);

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
  const timeAgo = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return 'Vừa xong'; if (m < 60) return m + 'p'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; };
  const isOverdue = (d, s) => s !== 'done' && d && new Date(d) < new Date();

  // Only show parent tasks (no parent_id). Feature 9: pinned tasks len dau.
  const parentTasks = tasks.filter(t => !t.parent_id).sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1; // pinned truoc
    return 0; // giu nguyen thu tu cu (da sort theo created_at desc tu DB)
  });

  // Overdue reason modal — rendered above all views
  const overdueModalEl = overdueModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setOverdueModal(null)}>
      <div className="card max-w-md w-full p-5" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 24px 48px rgba(18,53,36,0.22)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
          <h3 className="text-sm font-semibold text-ink">Task này đã trễ hạn</h3>
        </div>
        <p className="text-[11px] text-muted-ink mb-3 ml-4">Chọn lý do trễ trước khi đổi trạng thái. Dữ liệu phục vụ báo cáo cuối tháng.</p>
        <div className="space-y-1 mb-3">
          {[
            'Không đủ thời gian',
            'Thiếu nguồn lực / công cụ',
            'Chờ phản hồi từ người khác',
            'Ưu tiên việc khẩn cấp khác',
            'Quên / sót việc',
            'Khác (ghi chú thêm bên dưới)',
          ].map(r => (
            <label key={r} className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors" style={{
              borderColor: overdueReason === r ? 'var(--accent)' : 'var(--line)',
              background: overdueReason === r ? 'var(--accent-soft)' : '#fff',
              color: overdueReason === r ? 'var(--accent)' : 'var(--ink)'
            }}>
              <input type="radio" name="overdue-reason" checked={overdueReason === r} onChange={() => setOverdueReason(r)} style={{ accentColor: 'var(--accent)' }} />
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
          <button onClick={() => setOverdueModal(null)} className="btn-secondary !px-4 !py-1.5 !text-xs">Hủy</button>
          <button onClick={submitOverdueReason} className="btn-accent !px-4 !py-1.5 !text-xs">Xác nhận</button>
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    const grouped = {};
    parentTasks.forEach(t => {
      const assignees = t.assignees || [];
      if (assignees.length === 0) {
        if (!grouped['none']) grouped['none'] = { name: 'Chưa giao', tasks: [] };
        grouped['none'].tasks.push(t);
      } else {
        assignees.forEach(a => {
          const key = a.user_id;
          if (!grouped[key]) grouped[key] = { name: a.user?.name, avatar_color: a.user?.avatar_color, position: a.user?.position, tasks: [] };
          grouped[key].tasks.push(t);
        });
      }
    });
    return (
      <div className="space-y-4">
        {overdueModalEl}
        {Object.entries(grouped).map(([key, g]) => {
          const done = g.tasks.filter(t => t.status === 'done').length;
          const pct = g.tasks.length > 0 ? Math.round((done / g.tasks.length) * 100) : 0;
          return (
            <div key={key} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: g.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}>{ini(g.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate" style={{ letterSpacing: '-.005em' }}>{g.name}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{g.position} · {done}/{g.tasks.length} xong</p>
                </div>
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)' }} />
                </div>
                <span className="text-[11px] font-bold font-mono w-9 text-right" style={{ color: pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)' }}>{pct}%</span>
              </div>
              <div className="space-y-1.5">{g.tasks.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} getDraft={getDraft} setDraftField={setDraftField} addC={addComment} uid={userId} handleAddCommentFile={handleAddCommentFile} removeCommentFile={removeCommentFile} uploading={uploading} subTasks={subTasks[t.id]} showSubForm={showSubForm} setShowSubForm={setShowSubForm} subTitle={subTitle} setSubTitle={setSubTitle} subDeadline={subDeadline} setSubDeadline={setSubDeadline} subFiles={subFiles} handleAddSubFile={handleAddSubFile} removeSubFile={removeSubFile} createSubTask={createSubTask} subCreating={subCreating} expandedSub={expandedSub} setExpandedSub={setExpandedSub} updateSubStatus={updateSubStatus} isAdmin={isAdmin} isDirector={isDirector} canDeleteTask={canDeleteTask} delTask={deleteTask} togglePin={togglePin} canPinTasks={canPinTasks} mentionables={mentionables} assignMentionedUser={assignMentionedUser} members={members} toggleReaction={toggleReaction} checklist={checklist[t.id]} newChkText={newChkText[t.id] || ''} setNewChkText={(v) => setNewChkText(p => ({ ...p, [t.id]: v }))} addChecklistItem={addChecklistItem} toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem} />)}</div>
            </div>
          );
        })}
        {parentTasks.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có task</div>}
      </div>
    );
  }

  const todo = parentTasks.filter(t => t.status !== 'done');
  const done = parentTasks.filter(t => t.status === 'done');
  return (
    <div className="space-y-4">
      {overdueModalEl}
      {todo.length > 0 &&<div><div className="flex items-baseline gap-2 mb-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} /><span className="text-sm font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Cần làm</span><span className="text-[11px] font-mono text-muted-ink">{todo.length} task</span></div><div className="space-y-1.5">{todo.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} getDraft={getDraft} setDraftField={setDraftField} addC={addComment} uid={userId} handleAddCommentFile={handleAddCommentFile} removeCommentFile={removeCommentFile} uploading={uploading} subTasks={subTasks[t.id]} showSubForm={showSubForm} setShowSubForm={setShowSubForm} subTitle={subTitle} setSubTitle={setSubTitle} subDeadline={subDeadline} setSubDeadline={setSubDeadline} subFiles={subFiles} handleAddSubFile={handleAddSubFile} removeSubFile={removeSubFile} createSubTask={createSubTask} subCreating={subCreating} expandedSub={expandedSub} setExpandedSub={setExpandedSub} updateSubStatus={updateSubStatus} isAdmin={isAdmin} isDirector={isDirector} canDeleteTask={canDeleteTask} delTask={deleteTask} togglePin={togglePin} canPinTasks={canPinTasks} mentionables={mentionables} assignMentionedUser={assignMentionedUser} members={members} toggleReaction={toggleReaction} checklist={checklist[t.id]} newChkText={newChkText[t.id] || ''} setNewChkText={(v) => setNewChkText(p => ({ ...p, [t.id]: v }))} addChecklistItem={addChecklistItem} toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem} />)}</div></div>}
      {done.length > 0 && <div className="mt-4"><div className="flex items-baseline gap-2 mb-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted)' }} /><span className="text-sm font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Đã xong</span><span className="text-[11px] font-mono text-muted-ink">{done.length} task</span></div><div className="space-y-1.5 opacity-50">{done.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} getDraft={getDraft} setDraftField={setDraftField} addC={addComment} uid={userId} handleAddCommentFile={handleAddCommentFile} removeCommentFile={removeCommentFile} uploading={uploading} subTasks={subTasks[t.id]} showSubForm={showSubForm} setShowSubForm={setShowSubForm} subTitle={subTitle} setSubTitle={setSubTitle} subDeadline={subDeadline} setSubDeadline={setSubDeadline} subFiles={subFiles} handleAddSubFile={handleAddSubFile} removeSubFile={removeSubFile} createSubTask={createSubTask} subCreating={subCreating} expandedSub={expandedSub} setExpandedSub={setExpandedSub} updateSubStatus={updateSubStatus} isAdmin={isAdmin} isDirector={isDirector} canDeleteTask={canDeleteTask} delTask={deleteTask} togglePin={togglePin} canPinTasks={canPinTasks} mentionables={mentionables} assignMentionedUser={assignMentionedUser} members={members} toggleReaction={toggleReaction} checklist={checklist[t.id]} newChkText={newChkText[t.id] || ''} setNewChkText={(v) => setNewChkText(p => ({ ...p, [t.id]: v }))} addChecklistItem={addChecklistItem} toggleChecklistItem={toggleChecklistItem} removeChecklistItem={removeChecklistItem} />)}</div></div>}
      {parentTasks.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có task</div>}
    </div>
  );
}

function FileList({ files }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="space-y-1 my-1.5">
      {files.map((f, i) => {
        const icon = getFileIcon(f.file_name || f.name);
        return (
          <a key={f.id || i} href={f.file_url || f.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors group"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--line-2)' }}>
            <span className="text-sm flex-shrink-0">{icon}</span>
            <span className="text-xs truncate flex-1 transition-colors" style={{ color: 'var(--ink-2)' }}>{f.file_name || f.name}</span>
            {(f.file_size || f.size) > 0 && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>{formatFileSize(f.file_size || f.size)}</span>}
            <svg className="w-3 h-3 flex-shrink-0 transition-colors" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </a>
        );
      })}
    </div>
  );
}

function Row({ t, exp, toggle, upd, ini, fmtDT, fmtDate, timeAgo, isOverdue, comments, getDraft, setDraftField, addC, uid, handleAddCommentFile, removeCommentFile, uploading, subTasks, showSubForm, setShowSubForm, subTitle, setSubTitle, subDeadline, setSubDeadline, subFiles, handleAddSubFile, removeSubFile, createSubTask, subCreating, expandedSub, setExpandedSub, updateSubStatus, isAdmin, isDirector, canDeleteTask, delTask, togglePin, canPinTasks, mentionables, assignMentionedUser, members, toggleReaction, checklist, newChkText, setNewChkText, addChecklistItem, toggleChecklistItem, removeChecklistItem }) {
  const st = ST[t.status] || ST.todo;
  const pr = PR[t.priority] || PR.medium;
  const od = isOverdue(t.deadline, t.status);
  const assigneeNames = t.assignees?.map(a => a.user?.name).filter(Boolean).join(', ') || '';
  const subs = subTasks || [];
  const subDone = subs.filter(s => s.status === 'done').length;
  const hasSubs = subs.length > 0;

  return (
    <div id={'task-row-' + t.id} className="rounded-xl2 transition-all" style={{
      border: `1px solid ${exp ? 'var(--line)' : 'var(--line-2)'}`,
      borderLeft: t.pinned ? '3px solid var(--gold)' : (od ? '3px solid var(--danger)' : '1px solid var(--line)'),
      background: exp ? 'var(--bg-soft)' : '#fff',
    }}>
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={toggle}>
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.c }} />
        {t.pinned && <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--gold)' }} fill="currentColor" viewBox="0 0 20 20" title="Đã ghim"><path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" /></svg>}
        <p className="text-sm font-medium flex-1 truncate" style={{
          color: t.status === 'done' ? 'var(--muted)' : 'var(--ink)',
          textDecoration: t.status === 'done' ? 'line-through' : 'none',
          letterSpacing: '-.005em',
        }}>{t.title}</p>
        {hasSubs && <span className="pill flex-shrink-0" style={{ background: 'var(--violet-soft)', color: 'var(--violet)', fontSize: 10 }}>{subDone}/{subs.length} con</span>}
        {assigneeNames && <span className="text-[11px] font-mono truncate max-w-[120px] hidden md:inline" style={{ color: 'var(--muted)' }}>{assigneeNames}</span>}
        <span className="pill flex-shrink-0" style={{ background: st.c + '15', color: st.c, fontSize: 10 }}>{st.l}</span>
        <span className="pill flex-shrink-0 hidden sm:inline-flex" style={{ background: pr.c + '15', color: pr.c, fontSize: 10 }}>{pr.l}</span>
        {t.deadline && <span className="text-[11px] font-mono flex-shrink-0" style={{ color: od ? 'var(--danger)' : 'var(--muted)', fontWeight: od ? 700 : 400 }}>{fmtDate(t.deadline)}{od && ' !'}</span>}
        <svg className="w-3 h-3 transition-transform flex-shrink-0" style={{ color: 'var(--muted)', transform: exp ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>
      {exp && (
        <div className="px-3 pb-3 pt-3 animate-fade-in" style={{ borderTop: '1px solid var(--line-2)' }}>
          {t.description && <p className="text-xs mb-2.5" style={{ color: 'var(--ink-3)', lineHeight: 1.55 }}>{t.description}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] mb-2.5 items-center" style={{ color: 'var(--muted)' }}>
            <span className="font-mono">Tạo · {fmtDT(t.created_at)}</span>
            {t.deadline && <span className="font-mono">Hạn · {fmtDT(t.deadline)}</span>}
            {t.completed_at && <span className="font-mono" style={{ color: 'var(--accent)' }}>Xong · {fmtDT(t.completed_at)}</span>}
            <span>Giao bởi <strong className="font-medium" style={{ color: 'var(--ink-3)' }}>{t.creator?.name}</strong></span>
            <div className="ml-auto flex items-center gap-1">
              {canPinTasks && togglePin && (
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(t.id, t.pinned, t.title); }}
                  className="pill transition-colors"
                  style={t.pinned
                    ? { background: 'var(--gold-soft)', color: 'var(--gold)', fontSize: 10 }
                    : { background: 'var(--bg-soft)', color: 'var(--muted)', fontSize: 10 }}
                  title={t.pinned ? 'Bỏ ghim' : 'Ghim task lên đầu'}>
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" /></svg>
                  {t.pinned ? 'Bỏ ghim' : 'Ghim'}
                </button>
              )}
              {(isDirector || canDeleteTask) && delTask && (
                <button
                  onClick={(e) => { e.stopPropagation(); delTask(t.id, t.title); }}
                  className="pill transition-colors"
                  style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 10 }}
                  title="Xoá vĩnh viễn">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                  Xoá
                </button>
              )}
            </div>
          </div>
          {t.overdue_reason && (
            <div className="mb-2.5 px-2.5 py-2 rounded-lg text-[10px]" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderLeftWidth: 3 }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
                <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--danger)' }}>Lý do trễ hạn</span>
              </div>
              <p className="mt-0.5" style={{ color: 'var(--danger)' }}>{t.overdue_reason}</p>
              {t.overdue_reason_note && <p className="mt-0.5 italic" style={{ color: 'var(--danger)', opacity: 0.8 }}>"{t.overdue_reason_note}"</p>}
            </div>
          )}
          {t.files?.length > 0 && (
            <div className="mb-2.5">
              <p className="eyebrow mb-1">Đính kèm · {t.files.length}</p>
              <FileList files={t.files} />
            </div>
          )}
          {t.status !== 'done' && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {['todo', 'doing', 'waiting', 'done'].filter(s => s !== t.status).map(s => (
                <button key={s} onClick={() => upd(t.id, s)} className="pill transition-all hover:shadow-sm" style={{ background: ST[s].c + '15', color: ST[s].c, fontSize: 11, fontWeight: 600 }}>→ {ST[s].l}</button>
              ))}
            </div>
          )}

          {/* ============ CHECKLIST SECTION ============ */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
            {(() => {
              const items = checklist || [];
              const doneCount = items.filter(i => i.done).length;
              const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="eyebrow">
                      Checklist {items.length > 0 && <span style={{ color: 'var(--accent)' }}>· {doneCount}/{items.length} · {pct}%</span>}
                    </p>
                  </div>
                  {items.length > 0 && (
                    <div className="w-full h-1 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-soft)' }}>
                      <div className="h-full transition-all" style={{ width: pct + '%', background: pct === 100 ? 'var(--accent)' : 'var(--ink)' }} />
                    </div>
                  )}
                  <div className="space-y-1 mb-2">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center gap-2 group px-1.5 py-0.5 rounded hover:bg-[color:var(--bg-soft)]">
                        <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item)}
                          className="w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0"
                          style={{ accentColor: 'var(--accent)' }} />
                        <span className="text-xs flex-1" style={{
                          color: item.done ? 'var(--muted)' : 'var(--ink-2)',
                          textDecoration: item.done ? 'line-through' : 'none'
                        }}>{item.text}</span>
                        <button onClick={() => removeChecklistItem(item)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--danger)' }} title="Xóa">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      className="input-field !py-1.5 !text-xs flex-1"
                      placeholder="+ Thêm bước checklist..."
                      value={newChkText}
                      onChange={e => setNewChkText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addChecklistItem(t.id); } }}
                    />
                    <button onClick={() => addChecklistItem(t.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all" style={{ background: 'var(--accent)' }}>+</button>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ============ SUB-TASKS SECTION ============ */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">Nhiệm vụ con {hasSubs && <span style={{ color: 'var(--violet)' }}>· {subDone}/{subs.length}</span>}</p>
              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); setShowSubForm(showSubForm === t.id ? null : t.id); setSubTitle(''); setSubDeadline(''); setSubFiles([]); }}
                  className="pill transition-colors" style={{ background: 'var(--violet-soft)', color: 'var(--violet)', fontSize: 11, fontWeight: 600 }}>
                  + Tạo nhiệm vụ con
                </button>
              )}
            </div>

            {/* Sub-task creation form */}
            {showSubForm === t.id && (
              <div className="p-3 mb-3 rounded-xl animate-fade-in" style={{ background: 'var(--violet-soft)', border: '1px solid var(--violet)', borderLeftWidth: 3 }}>
                <div className="space-y-2">
                  <input className="input-field !text-xs !py-1.5" placeholder="Tiêu đề nhiệm vụ con *" value={subTitle} onChange={e => setSubTitle(e.target.value)} />
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="eyebrow block mb-0.5">Deadline</label>
                      <input type="datetime-local" className="input-field !text-xs !py-1.5" value={subDeadline} onChange={e => setSubDeadline(e.target.value)} />
                    </div>
                  </div>
                  {/* Sub-task file attachments */}
                  <div>
                    <label className="eyebrow block mb-1">Đính kèm</label>
                    <div className="space-y-1">
                      {subFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white text-xs" style={{ border: '1px solid var(--line)' }}>
                          <span className="flex-shrink-0">{getFileIcon(f.name)}</span>
                          <span className="truncate flex-1" style={{ color: 'var(--ink-2)' }}>{f.name}</span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{formatFileSize(f.size)}</span>
                          <button onClick={() => removeSubFile(i)} style={{ color: 'var(--danger)' }}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <label className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white hover:bg-[color:var(--bg-soft)] cursor-pointer text-xs transition-colors" style={{ border: '1px dashed var(--line)', color: 'var(--muted)' }}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Chọn file
                        <input type="file" multiple className="hidden" onChange={handleAddSubFile} />
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowSubForm(null)} className="btn-secondary !px-3 !py-1.5 !text-xs">Hủy</button>
                    <button onClick={() => createSubTask(t.id)} disabled={subCreating} className="btn-accent !px-3 !py-1.5 !text-xs disabled:opacity-50">{subCreating ? '...' : 'Tạo'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tasks list */}
            {subs.length > 0 && (
              <div className="space-y-1 ml-2 pl-3" style={{ borderLeft: '2px solid var(--violet-soft)' }}>
                {subs.map(sub => {
                  const subSt = ST[sub.status] || ST.todo;
                  const subOd = isOverdue(sub.deadline, sub.status);
                  const isSubExp = expandedSub === sub.id;
                  return (
                    <div key={sub.id} className="rounded-lg transition-all" style={{
                      border: `1px solid ${subOd ? 'var(--danger)' : 'var(--line-2)'}`,
                      borderLeftWidth: subOd ? 3 : 1,
                      background: subOd ? 'var(--danger-soft)' : '#fff'
                    }}>
                      <div className="flex items-center gap-2 px-2.5 py-2 cursor-pointer" onClick={() => setExpandedSub(isSubExp ? null : sub.id)}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: subSt.c }} />
                        <p className="text-xs font-medium flex-1 truncate" style={{
                          color: sub.status === 'done' ? 'var(--muted)' : 'var(--ink-2)',
                          textDecoration: sub.status === 'done' ? 'line-through' : 'none'
                        }}>{sub.title}</p>
                        <span className="pill flex-shrink-0" style={{ background: subSt.c + '15', color: subSt.c, fontSize: 9 }}>{subSt.l}</span>
                        {sub.deadline && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: subOd ? 'var(--danger)' : 'var(--muted)', fontWeight: subOd ? 700 : 400 }}>{fmtDate(sub.deadline)}{subOd && ' !'}</span>}
                        {sub.files?.length > 0 && <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>📎{sub.files.length}</span>}
                        <svg className="w-2.5 h-2.5 transition-transform flex-shrink-0" style={{ color: 'var(--muted)', transform: isSubExp ? 'rotate(180deg)' : 'none' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      {isSubExp && (
                        <div className="px-2.5 pb-2 pt-2 animate-fade-in" style={{ borderTop: '1px solid var(--line-2)' }}>
                          {sub.deadline && <p className="text-[10px] font-mono mb-1" style={{ color: 'var(--muted)' }}>Hạn · {fmtDT(sub.deadline)}</p>}
                          {sub.files?.length > 0 && (
                            <div className="mb-2">
                              <p className="eyebrow mb-0.5">File · {sub.files.length}</p>
                              <FileList files={sub.files} />
                            </div>
                          )}
                          {sub.status !== 'done' && (
                            <div className="flex gap-1 flex-wrap">
                              {['todo', 'doing', 'waiting', 'done'].filter(s => s !== sub.status).map(s => (
                                <button key={s} onClick={() => updateSubStatus(sub.id, s, t.id)} className="pill transition-all hover:shadow-sm" style={{ background: ST[s].c + '15', color: ST[s].c, fontSize: 10, fontWeight: 600 }}>→ {ST[s].l}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {subs.length === 0 && !showSubForm && <p className="text-[10px] italic" style={{ color: 'var(--muted)', opacity: 0.6 }}>Chưa có nhiệm vụ con</p>}
          </div>

          {/* Comments */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
            <p className="eyebrow mb-2">Bình luận {comments?.length > 0 && <span style={{ color: 'var(--ink-3)' }}>· {comments.length}</span>}</p>
            <div className="space-y-0.5 mb-2">
              {comments?.map(c => (
                <CommentRow key={c.id} c={c} ini={ini} timeAgo={timeAgo} mentionables={mentionables} uid={uid} toggleReaction={toggleReaction} taskId={t.id} />
              ))}
            </div>
            {(() => { const draft = getDraft(t.id); return (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <CommentInput
                  value={exp ? draft.text : ''}
                  setValue={(v) => setDraftField(t.id, 'text', v)}
                  onSend={() => addC(t.id)}
                  mentionables={mentionables || []}
                  onMention={(mId) => setDraftField(t.id, 'mentionedIds', draft.mentionedIds.includes(mId) ? draft.mentionedIds : [...draft.mentionedIds, mId])}
                  ini={ini}
                />
                <label className="flex items-center px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors" style={{ background: 'var(--bg-soft)', color: 'var(--muted)', border: '1px solid var(--line)' }} title="Đính kèm file">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <input type="file" multiple className="hidden" onChange={(e) => handleAddCommentFile(t.id, e)} />
                </label>
                <button onClick={() => addC(t.id)} disabled={uploading} className="btn-accent !px-4 !py-1.5 !text-xs disabled:opacity-50">
                  {uploading ? '...' : 'Gửi'}
                </button>
              </div>
              {draft.files.length > 0 && (
                <div className="space-y-1">
                  {draft.files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      <span>{getFileIcon(f.name)}</span>
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-[10px] font-mono opacity-75">{formatFileSize(f.size)}</span>
                      <button onClick={() => removeCommentFile(t.id, i)} className="flex-shrink-0" style={{ color: 'var(--danger)' }}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Feature 11: Smart @mention - suggest giao task cho nguoi duoc mention nhung chua la assignee */}
              {(() => {
                const assigneeIds = (t.assignees || []).map(a => a.user_id);
                const canAssign = isAdmin || isDirector || t.created_by === uid;
                if (!canAssign) return null;
                const suggestions = (draft.mentionedIds || [])
                  .filter(mid => !assigneeIds.includes(mid) && mid !== uid)
                  .map(mid => (members || []).find(m => m.id === mid))
                  .filter(m => m && draft.text.includes('@' + m.name));
                if (suggestions.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 animate-fade-in">
                    {suggestions.map(m => (
                      <button key={m.id} onClick={() => assignMentionedUser(t.id, m.id, m.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:shadow-sm"
                        style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Giao task này cho <strong>@{m.name}</strong>?</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            ); })()}
          </div>
        </div>
      )}
    </div>
  );
}

// Feature 12: Bo emoji reactions cho phep user like/emoji nhanh comment
const REACTION_EMOJIS = ['👍', '✅', '❤️', '🎉', '🙏', '😂'];

function CommentRow({ c, ini, timeAgo, mentionables, uid, toggleReaction, taskId }) {
  const [showPicker, setShowPicker] = useState(false);
  // Nhom reactions theo emoji de dem count + biet minh da react chua
  const reactionGroups = {};
  (c.reactions || []).forEach(r => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false };
    reactionGroups[r.emoji].count += 1;
    if (r.user_id === uid) reactionGroups[r.emoji].mine = true;
  });
  const reactionEntries = Object.entries(reactionGroups);

  return (
    <div className="flex gap-2 py-1.5 group relative">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5" style={{ background: c.user?.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}>{ini(c.user?.name)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] mb-0.5">
          <strong style={{ color: 'var(--ink)' }}>{c.user?.name}</strong>
          <span className="font-mono ml-1.5" style={{ color: 'var(--muted)' }}>{timeAgo(c.created_at)}</span>
        </p>
        {c.content && <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--ink-3)', lineHeight: 1.5 }}>{renderMentions(c.content, mentionables)}</p>}
        {c.files && c.files.length > 0 && <FileList files={c.files} />}
        {/* Reactions display + picker */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {reactionEntries.map(([emoji, info]) => (
            <button key={emoji} onClick={() => toggleReaction(c.id, emoji, taskId)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all"
              style={info.mine
                ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }
                : { background: 'var(--bg-soft)', border: '1px solid var(--line-2)', color: 'var(--ink-3)' }}>
              <span>{emoji}</span>
              <span className="font-semibold font-mono">{info.count}</span>
            </button>
          ))}
          {/* Add reaction button - hien khi hover comment */}
          <div className="relative">
            <button onClick={() => setShowPicker(v => !v)}
              className={`px-1.5 py-0.5 rounded-full text-[10px] transition-all ${reactionEntries.length === 0 ? 'opacity-0 group-hover:opacity-100' : ''}`}
              style={{ color: 'var(--muted)' }}
              title="Thêm reaction">
              😊+
            </button>
            {showPicker && (
              <div className="absolute left-0 top-full mt-1 rounded-lg p-1 flex gap-0.5 z-10 animate-fade-in" style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 8px 20px rgba(18,53,36,0.1)' }}>
                {REACTION_EMOJIS.map(emoji => {
                  const mine = reactionGroups[emoji]?.mine;
                  return (
                    <button key={emoji} onClick={() => { toggleReaction(c.id, emoji, taskId); setShowPicker(false); }}
                      className="w-7 h-7 rounded flex items-center justify-center text-base transition-all"
                      style={mine ? { background: 'var(--accent-soft)' } : {}}
                      title={mine ? 'Bỏ ' + emoji : 'Thêm ' + emoji}>
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Render comment content with @Name highlighted as a styled chip
function renderMentions(text, mentionables) {
  if (!text) return null;
  // Sort names by length desc so longer names match first (e.g. "Truc Nguyen" before "Truc")
  const names = (mentionables || []).map(m => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('@(' + escaped.join('|') + ')', 'g');
  const parts = [];
  let last = 0; let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<span key={m.index} className="font-semibold px-1 rounded" style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}>@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Input field with @mention autocomplete dropdown.
// Shows a list of mentionable users when user types "@" followed by letters.
function CommentInput({ value, setValue, onSend, mentionables, onMention, ini }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState(0); // index where @ starts
  const [selIdx, setSelIdx] = useState(0);

  // Remove Vietnamese diacritics for search convenience
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = open
    ? mentionables.filter(m => {
        if (!query) return true;
        return norm(m.name).includes(norm(query));
      }).slice(0, 8)
    : [];

  useEffect(() => { setSelIdx(0); }, [query, open]);

  function handleChange(e) {
    const val = e.target.value;
    const caret = e.target.selectionStart || val.length;
    setValue(val);
    // Detect if caret is inside a pending @mention
    const upto = val.slice(0, caret);
    const atIdx = upto.lastIndexOf('@');
    if (atIdx >= 0) {
      const before = atIdx === 0 ? ' ' : upto[atIdx - 1];
      const isBoundary = /\s/.test(before) || atIdx === 0;
      const q = upto.slice(atIdx + 1);
      // Cancel if user typed a space — mention tokens cannot contain whitespace-only separators
      if (isBoundary && !/\s$/.test(q)) {
        setOpen(true); setQuery(q); setAnchor(atIdx);
        return;
      }
    }
    setOpen(false); setQuery('');
  }

  function pickMention(member) {
    if (!member) return;
    const val = value || '';
    const before = val.slice(0, anchor);
    const afterIdx = anchor + 1 + query.length;
    const after = val.slice(afterIdx);
    const insert = '@' + member.name + ' ';
    const newVal = before + insert + after;
    setValue(newVal);
    setOpen(false); setQuery('');
    if (onMention) onMention(member.id);
    // Restore focus and place caret after inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = (before + insert).length;
        try { inputRef.current.setSelectionRange(pos, pos); } catch (e) {}
      }
    }, 0);
  }

  function handleKeyDown(e) {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => (i + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(filtered[selIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend && onSend(); }
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        className="input-field !py-1.5 !text-xs w-full"
        placeholder="Bình luận... (gõ @ để nhắc tên)"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-lg z-50" style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 12px 24px rgba(18,53,36,0.12)' }}>
          {filtered.map((m, i) => (
            <div
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
              className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-xs transition-colors"
              style={i === selIdx ? { background: 'var(--accent-soft)' } : {}}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0" style={{ background: m.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}>{ini(m.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{m.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
                  {m.role === 'director' ? 'Tổng Giám đốc' : m.role === 'accountant' ? 'Kế toán' : (m.position || '')}
                  {m.department ? ` · ${m.department === 'hotel' ? 'Hotel' : 'Nail'}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
