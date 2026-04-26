import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { logActivity, ACTIONS } from '@/lib/activityLog';

// Modal chi tiết task — dùng chung cho Kanban (click card) và nơi khác cần mở detail.
// Chứa: mô tả, metadata, người nhận, file đính kèm (per-line + upload), đổi trạng thái,
// comment với @mention + reactions + upload file trong comment.
// Click notification mention → dashboard openTaskById → set focusTaskId trên list view (flow cũ).

const ST = { todo: { l: 'Chưa làm', c: '#6b7280' }, doing: { l: 'Đang thực hiện', c: '#2563eb' }, done: { l: 'Hoàn thành', c: '#16a34a' }, waiting: { l: 'Chờ phản hồi', c: '#d97706' } };
const PR = { high: { l: 'Cao', c: '#dc2626' }, medium: { l: 'TB', c: '#d97706' }, low: { l: 'Thấp', c: '#2563eb' } };
const REACTION_EMOJIS = ['👍', '✅', '❤️', '🎉', '🙏', '😂'];

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

function renderMentions(text, mentionables) {
  if (!text) return null;
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

const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
const timeAgo = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return 'Vừa xong'; if (m < 60) return m + 'p'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; };

export default function TaskDetailModal({
  task, open, onClose,
  members, userId, currentUserRole, currentUserName,
  department, isAdmin, isDirector, canPinTasks, canDeleteTask,
  onRefresh,
}) {
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState({ text: '', files: [], mentionedIds: [] });
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Mentionables: lọc theo dept + branch của task hiện tại.
  // - TGĐ + Kế toán: luôn mention được (cross-dept management).
  // - Còn lại: phải cùng dept với task; nếu task có chi nhánh (Nail), member phải thuộc chi nhánh đó.
  const taskBranch = task?.branch || null;
  const taskDept = task?.department || department;
  const mentionables = (members || []).filter(m => {
    if (m.id === userId) return false;
    if (m.role === 'director' || m.role === 'accountant') return true;
    if (m.department !== taskDept) return false;
    if (taskDept === 'nail' && taskBranch) {
      const mb = Array.isArray(m.branches) ? m.branches : [];
      if (mb.length === 0) return false;
      if (!mb.includes(taskBranch)) return false;
    }
    return true;
  });

  // Load comments khi modal mở
  useEffect(() => {
    if (!task || !open) return;
    setDraft({ text: '', files: [], mentionedIds: [] });
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open]);

  // Đóng bằng phím ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose && onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function loadComments() {
    if (!task) return;
    const { data } = await supabase.from('comments')
      .select('*, user:profiles!comments_user_id_fkey(name, avatar_color), reactions:comment_reactions(id, emoji, user_id)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
  }

  async function toggleReaction(commentId, emoji) {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const existing = (comment.reactions || []).find(r => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      const { error } = await supabase.from('comment_reactions').delete().eq('id', existing.id);
      if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    } else {
      const { error } = await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: userId, emoji });
      if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    }
    loadComments();
  }

  async function addComment() {
    if (!draft.text.trim() && draft.files.length === 0) return;
    setUploading(true);
    const uploadedFiles = [];
    for (const f of draft.files) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = 'comments/' + task.id + '/' + Date.now() + '_' + safeName;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        uploadedFiles.push({ name: f.name, url: publicUrl, type: f.type, size: f.size });
      }
    }
    const contentText = draft.text.trim();
    await supabase.from('comments').insert({
      task_id: task.id, user_id: userId, content: contentText,
      files: uploadedFiles.length > 0 ? uploadedFiles : null,
    });

    try {
      const uniqueIds = Array.from(new Set(draft.mentionedIds));
      for (const mid of uniqueIds) {
        const m = members.find(x => x.id === mid);
        if (!m) continue;
        if (!contentText.includes('@' + m.name)) continue;
        if (mid === userId) continue;
        await supabase.from('notifications').insert({
          user_id: mid,
          type: 'mention',
          title: 'Bạn được nhắc đến',
          message: `${currentUserName || 'Ai đó'} đã nhắc bạn trong "${task.title}"`,
          task_id: task.id,
        });
        sendPush(mid, 'Bạn được nhắc đến', `${currentUserName || 'Ai đó'} nhắc bạn trong "${task.title}"`, { url: '/dashboard', tag: 'mention-' + task.id });
      }
    } catch (e) { /* non-fatal */ }

    setDraft({ text: '', files: [], mentionedIds: [] });
    setUploading(false);
    loadComments();
  }

  function handleAddCommentFile(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setDraft(d => ({ ...d, files: [...d.files, ...newFiles] }));
    e.target.value = '';
  }
  function removeCommentFile(idx) { setDraft(d => ({ ...d, files: d.files.filter((_, i) => i !== idx) })); }

  async function addTaskFiles(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;
    setUploadingFiles(true);
    let okCount = 0;
    for (const f of selected) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = 'tasks/' + task.id + '/' + Date.now() + '_' + safeName;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, f);
      if (upErr) { toast('Lỗi upload ' + f.name + ': ' + upErr.message, 'error'); continue; }
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
      const { error: insErr } = await supabase.from('task_files').insert({
        task_id: task.id, file_name: f.name, file_url: publicUrl,
        file_type: f.type, file_size: f.size, uploaded_by: userId,
      });
      if (insErr) { toast('Lỗi lưu ' + f.name + ': ' + insErr.message, 'error'); continue; }
      okCount++;
    }
    setUploadingFiles(false);
    if (okCount > 0) {
      toast('Đã đính kèm ' + okCount + ' file', 'success');
      onRefresh && onRefresh();
    }
  }

  async function removeTaskFile(fileId) {
    const ok = typeof window !== 'undefined' && window.confirm('Gỡ file này khỏi task?');
    if (!ok) return;
    const { error } = await supabase.from('task_files').delete().eq('id', fileId);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    toast('Đã gỡ file', 'success');
    onRefresh && onRefresh();
  }

  async function updateStatus(s) {
    const u = { status: s, updated_at: new Date().toISOString() };
    if (s === 'done') u.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tasks').update(u).eq('id', task.id);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    if (task.created_by !== userId) {
      sendPush(task.created_by, ST[s].l, (currentUserName || 'Ai đó') + ' chuyển "' + task.title + '" → ' + ST[s].l, { url: '/dashboard', tag: 'status-' + task.id });
    }
    logActivity({
      userId, userName: currentUserName,
      action: ACTIONS.TASK_STATUS_CHANGED,
      targetType: 'task', targetId: task.id, targetTitle: task.title,
      details: { old_status: task.status, new_status: s, source: 'modal' },
      department: task.department,
    });
    toast(ST[s].l, 'success');
    onRefresh && onRefresh();
  }

  async function togglePin() {
    if (!canPinTasks) return;
    const newPinned = !task.pinned;
    const { error } = await supabase.from('tasks').update({ pinned: newPinned, updated_at: new Date().toISOString() }).eq('id', task.id);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    toast(newPinned ? '📌 Đã ghim task' : 'Đã bỏ ghim', 'success');
    onRefresh && onRefresh();
  }

  if (!open || !task) return null;

  const st = ST[task.status] || ST.todo;
  const pr = PR[task.priority] || PR.medium;
  const od = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
  const canAssign = isAdmin || isDirector || task.created_by === userId;
  const assigneeIds = (task.assignees || []).map(a => a.user_id);
  const suggestions = (draft.mentionedIds || [])
    .filter(mid => !assigneeIds.includes(mid) && mid !== userId)
    .map(mid => (members || []).find(m => m.id === mid))
    .filter(m => m && draft.text.includes('@' + m.name));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div
        className="card w-full sm:max-w-2xl max-h-[100vh] sm:max-h-[92vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ borderRadius: 'min(16px, 1rem)', boxShadow: '0 24px 56px rgba(18,53,36,0.25)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1 text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
              {task.pinned && (
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--gold)' }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" />
                </svg>
              )}
              <span>#{String(task.id).slice(0, 6)}</span>
              {task.branch && <><span>·</span><span>{task.branch}</span></>}
              {task.department && <><span>·</span><span className="uppercase">{task.department}</span></>}
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-ink leading-snug" style={{ letterSpacing: '-.01em' }}>{task.title}</h2>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="pill" style={{ background: st.c + '15', color: st.c, fontSize: 10 }}>{st.l}</span>
              <span className="pill" style={{ background: pr.c + '15', color: pr.c, fontSize: 10 }}>Ưu tiên {pr.l}</span>
              {task.deadline && (
                <span className="pill font-mono" style={{
                  background: od ? 'var(--danger-soft)' : 'var(--bg-soft)',
                  color: od ? 'var(--danger)' : 'var(--muted)',
                  fontSize: 10
                }}>
                  Hạn {fmtDate(task.deadline)}{od && ' · TRỄ'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canPinTasks && (
              <button
                onClick={togglePin}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[color:var(--bg-soft)] transition-colors"
                style={{ color: task.pinned ? 'var(--gold)' : 'var(--muted)' }}
                title={task.pinned ? 'Bỏ ghim' : 'Ghim task'}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2l1.5 3.5L14 7l-2.5 2 .5 3.5L9 11 6 12.5 6.5 9 4 7l3.5-1.5L9 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[color:var(--bg-soft)] transition-colors"
              style={{ color: 'var(--muted)' }}
              title="Đóng"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Description */}
          <div>
            <p className="eyebrow mb-1.5">Mô tả chi tiết</p>
            {task.description ? (
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {task.description}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                (Chưa có mô tả)
              </p>
            )}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            <span className="font-mono">Tạo · {fmtDT(task.created_at)}</span>
            {task.deadline && <span className="font-mono">Hạn · {fmtDT(task.deadline)}</span>}
            {task.completed_at && <span className="font-mono" style={{ color: 'var(--accent)' }}>Xong · {fmtDT(task.completed_at)}</span>}
            {task.creator?.name && <span>Giao bởi <strong className="font-medium" style={{ color: 'var(--ink-3)' }}>{task.creator.name}</strong></span>}
          </div>

          {/* Assignees */}
          {task.assignees?.length > 0 && (
            <div>
              <p className="eyebrow mb-1.5">Người nhận · {task.assignees.length}</p>
              <div className="flex flex-wrap gap-1.5">
                {task.assignees.map(a => (
                  <div
                    key={a.user_id}
                    className="flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'var(--bg-soft)', border: '1px solid var(--line-2)' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                      style={{ background: a.user?.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}
                    >
                      {ini(a.user?.name)}
                    </div>
                    <span style={{ color: 'var(--ink-2)' }}>{a.user?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overdue reason banner */}
          {task.overdue_reason && (
            <div className="px-2.5 py-2 rounded-lg text-[11px]" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderLeftWidth: 3 }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)' }} />
                <span className="font-semibold uppercase tracking-wide" style={{ color: 'var(--danger)' }}>Lý do trễ hạn</span>
              </div>
              <p className="mt-0.5" style={{ color: 'var(--danger)' }}>{task.overdue_reason}</p>
              {task.overdue_reason_note && <p className="mt-0.5 italic" style={{ color: 'var(--danger)', opacity: 0.8 }}>"{task.overdue_reason_note}"</p>}
            </div>
          )}

          {/* Attachments - ALWAYS show upload button */}
          <div>
            <p className="eyebrow mb-1.5">
              Đính kèm
              {task.files?.length > 0 && <span style={{ color: 'var(--accent)' }}> · {task.files.length}</span>}
            </p>
            {task.files?.length > 0 && <FileList files={task.files} onRemove={removeTaskFile} taskId={task.id} />}
            <label
              className="flex items-center justify-center gap-1.5 mt-1 px-3 py-2.5 rounded-lg cursor-pointer text-xs font-medium transition-all hover:shadow-sm"
              style={{
                border: '1px dashed var(--accent)',
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                opacity: uploadingFiles ? 0.6 : 1,
                pointerEvents: uploadingFiles ? 'none' : 'auto',
              }}
            >
              {uploadingFiles ? (
                <span className="font-mono">Đang tải lên…</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Thêm hình ảnh/tài liệu</span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip,.rar"
                className="hidden"
                onChange={addTaskFiles}
                disabled={uploadingFiles}
              />
            </label>
          </div>

          {/* Status change */}
          {task.status !== 'done' && (
            <div>
              <p className="eyebrow mb-1.5">Chuyển trạng thái</p>
              <div className="flex gap-1.5 flex-wrap">
                {['todo', 'doing', 'waiting', 'done'].filter(s => s !== task.status).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className="pill transition-all hover:shadow-sm"
                    style={{ background: ST[s].c + '15', color: ST[s].c, fontSize: 11, fontWeight: 600 }}
                  >
                    → {ST[s].l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--line-2)' }}>
            <p className="eyebrow mb-2">
              Bình luận
              {comments.length > 0 && <span style={{ color: 'var(--ink-3)' }}> · {comments.length}</span>}
            </p>
            <div className="space-y-0.5 mb-2">
              {comments.length === 0 && (
                <p className="text-xs italic" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                  Chưa có bình luận nào. Dùng @ để nhắc tên.
                </p>
              )}
              {comments.map(c => (
                <CommentRow
                  key={c.id}
                  c={c}
                  mentionables={mentionables}
                  uid={userId}
                  toggleReaction={(cid, emoji) => toggleReaction(cid, emoji)}
                />
              ))}
            </div>

            {/* Comment input */}
            <div className="space-y-1.5">
              <div className="flex gap-2 items-start">
                <CommentInput
                  value={draft.text}
                  setValue={v => setDraft(d => ({ ...d, text: v }))}
                  onSend={addComment}
                  mentionables={mentionables}
                  onMention={mId => setDraft(d => ({ ...d, mentionedIds: d.mentionedIds.includes(mId) ? d.mentionedIds : [...d.mentionedIds, mId] }))}
                />
                <label
                  className="flex items-center px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex-shrink-0"
                  style={{ background: 'var(--bg-soft)', color: 'var(--muted)', border: '1px solid var(--line)' }}
                  title="Đính kèm file vào comment"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <input type="file" multiple className="hidden" onChange={handleAddCommentFile} />
                </label>
                <button
                  onClick={addComment}
                  disabled={uploading}
                  className="btn-accent !px-4 !py-1.5 !text-xs disabled:opacity-50 flex-shrink-0"
                >
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
                      <button onClick={() => removeCommentFile(i)} className="flex-shrink-0" style={{ color: 'var(--danger)' }}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Smart @mention suggest-assign */}
              {canAssign && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 animate-fade-in">
                  {suggestions.map(m => (
                    <button
                      key={m.id}
                      onClick={async () => {
                        const existing = (task.assignees || []).some(a => a.user_id === m.id);
                        if (existing) { toast(m.name + ' đã là người nhận', 'error'); return; }
                        const { error } = await supabase.from('task_assignees').insert({ task_id: task.id, user_id: m.id });
                        if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
                        try {
                          await supabase.from('notifications').insert({
                            user_id: m.id, type: 'task_assigned',
                            title: 'Bạn được giao task',
                            message: (currentUserName || 'Ai đó') + ' vừa giao bạn task "' + task.title + '"',
                            task_id: task.id,
                          });
                          sendPush(m.id, '📋 Bạn được giao task', (currentUserName || 'Ai đó') + ': "' + task.title + '"', { url: '/dashboard', tag: 'assigned-' + task.id });
                        } catch (e) { }
                        toast('✅ Đã giao task cho ' + m.name, 'success');
                        onRefresh && onRefresh();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:shadow-sm"
                      style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <span>Giao task này cho <strong>@{m.name}</strong>?</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileList({ files, onRemove, taskId }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="space-y-1 my-1.5">
      {files.map((f, i) => {
        const icon = getFileIcon(f.file_name || f.name);
        const fileId = f.id;
        return (
          <div
            key={fileId || i}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors group"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--line-2)' }}
          >
            <span className="text-sm flex-shrink-0">{icon}</span>
            <a
              href={f.file_url || f.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 min-w-0 flex items-center gap-2 truncate"
            >
              <span className="text-xs truncate flex-1 transition-colors" style={{ color: 'var(--ink-2)' }}>{f.file_name || f.name}</span>
              {(f.file_size || f.size) > 0 && (
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>
                  {formatFileSize(f.file_size || f.size)}
                </span>
              )}
              <svg className="w-3 h-3 flex-shrink-0 transition-colors" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            {onRemove && fileId && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(fileId, taskId); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-white"
                style={{ color: 'var(--danger)' }}
                title="Gỡ file"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CommentRow({ c, mentionables, uid, toggleReaction }) {
  const [showPicker, setShowPicker] = useState(false);
  const reactionGroups = {};
  (c.reactions || []).forEach(r => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false };
    reactionGroups[r.emoji].count += 1;
    if (r.user_id === uid) reactionGroups[r.emoji].mine = true;
  });
  const reactionEntries = Object.entries(reactionGroups);

  return (
    <div className="flex gap-2 py-1.5 group relative">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0 mt-0.5" style={{ background: c.user?.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}>
        {ini(c.user?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] mb-0.5">
          <strong style={{ color: 'var(--ink)' }}>{c.user?.name}</strong>
          <span className="font-mono ml-1.5" style={{ color: 'var(--muted)' }}>{timeAgo(c.created_at)}</span>
        </p>
        {c.content && (
          <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--ink-3)', lineHeight: 1.5 }}>
            {renderMentions(c.content, mentionables)}
          </p>
        )}
        {c.files && c.files.length > 0 && <FileList files={c.files} />}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {reactionEntries.map(([emoji, info]) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(c.id, emoji)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all"
              style={info.mine
                ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }
                : { background: 'var(--bg-soft)', border: '1px solid var(--line-2)', color: 'var(--ink-3)' }}
            >
              <span>{emoji}</span>
              <span className="font-semibold font-mono">{info.count}</span>
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowPicker(v => !v)}
              className={`px-1.5 py-0.5 rounded-full text-[10px] transition-all ${reactionEntries.length === 0 ? 'opacity-0 group-hover:opacity-100' : ''}`}
              style={{ color: 'var(--muted)' }}
              title="Thêm reaction"
            >
              😊+
            </button>
            {showPicker && (
              <div className="absolute left-0 top-full mt-1 rounded-lg p-1 flex gap-0.5 z-10 animate-fade-in" style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 8px 20px rgba(18,53,36,0.1)' }}>
                {REACTION_EMOJIS.map(emoji => {
                  const mine = reactionGroups[emoji]?.mine;
                  return (
                    <button
                      key={emoji}
                      onClick={() => { toggleReaction(c.id, emoji); setShowPicker(false); }}
                      className="w-7 h-7 rounded flex items-center justify-center text-base transition-all"
                      style={mine ? { background: 'var(--accent-soft)' } : {}}
                      title={mine ? 'Bỏ ' + emoji : 'Thêm ' + emoji}
                    >
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

function CommentInput({ value, setValue, onSend, mentionables, onMention }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState(0);
  const [selIdx, setSelIdx] = useState(0);

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
    const upto = val.slice(0, caret);
    const atIdx = upto.lastIndexOf('@');
    if (atIdx >= 0) {
      const before = atIdx === 0 ? ' ' : upto[atIdx - 1];
      const isBoundary = /\s/.test(before) || atIdx === 0;
      const q = upto.slice(atIdx + 1);
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
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0" style={{ background: m.avatar_color || 'var(--bg-soft)', color: 'var(--ink)' }}>
                {ini(m.name)}
              </div>
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
