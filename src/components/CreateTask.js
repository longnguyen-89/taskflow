import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';
import { logActivity, ACTIONS } from '@/lib/activityLog';

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

export default function CreateTask({ members, userId, userName, department, branch, allowedBranches, canViewAll, taskGroups, onCreated }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const branchOptions = (department === 'nail')
    ? (canViewAll ? NAIL_BRANCHES.map(b => b.id) : (Array.isArray(allowedBranches) ? allowedBranches : []))
    : [];
  const [taskBranch, setTaskBranch] = useState(branch || (branchOptions.length === 1 ? branchOptions[0] : ''));
  useEffect(() => {
    setTaskBranch(branch || (branchOptions.length === 1 ? branchOptions[0] : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, department]);

  const filteredMembers = (department === 'nail' && taskBranch)
    ? members.filter(m =>
        m.role === 'director' || m.role === 'accountant' ||
        (Array.isArray(m.branches) && m.branches.includes(taskBranch))
      )
    : members;

  function toggleAssignee(id) { setAssignees(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  function toggleWatcher(id) { setWatchers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

  function handleAddFile(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }
  function removeFile(index) { setFiles(prev => prev.filter((_, i) => i !== index)); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast('Nhập tiêu đề', 'error');
    if (assignees.length === 0) return toast('Chọn người thực hiện', 'error');
    if (department === 'nail' && branchOptions.length > 0 && !taskBranch) return toast('Chọn chi nhánh cho task', 'error');
    setSubmitting(true);

    const groupKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    const sharedFiles = [];
    for (const f of files) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = `groups/${groupKey}/${Date.now()}_${safeName}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (!ue) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        sharedFiles.push({ file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size });
      }
    }

    const deadlineISO = deadline ? new Date(deadline).toISOString() : null;
    let firstError = null;
    let createdCount = 0;

    for (const uid of assignees) {
      const { data: task, error } = await supabase.from('tasks').insert({
        title: title.trim(),
        description: desc.trim(),
        priority,
        department,
        branch: department === 'nail' ? (taskBranch || null) : null,
        group_id: groupId || null,
        group_key: groupKey,
        deadline: deadlineISO,
        created_by: userId,
        status: 'todo',
        approval_status: 'none',
      }).select().single();

      if (error) { firstError = firstError || error; continue; }
      createdCount++;

      await supabase.from('task_assignees').insert({ task_id: task.id, user_id: uid });

      if (uid !== userId) {
        await supabase.from('notifications').insert({
          user_id: uid, type: 'new_task', title: 'Task mới',
          message: `${userName} giao: "${title}"`, task_id: task.id,
        });
        sendPush(uid, '📋 Task mới', `${userName} giao: "${title}"`, { url: '/dashboard', tag: 'task-' + task.id });
      }

      for (const wid of watchers) {
        await supabase.from('task_watchers').insert({ task_id: task.id, user_id: wid });
        await supabase.from('notifications').insert({
          user_id: wid, type: 'info', title: 'Bạn được thêm theo dõi',
          message: `Task: "${title}"`, task_id: task.id,
        });
        sendPush(wid, '👁 Theo dõi task', `Bạn được thêm theo dõi: "${title}"`, { url: '/dashboard', tag: 'watch-' + task.id });
      }

      if (sharedFiles.length > 0) {
        await supabase.from('task_files').insert(
          sharedFiles.map(f => ({
            task_id: task.id, file_name: f.file_name, file_url: f.file_url,
            file_type: f.file_type, file_size: f.file_size, uploaded_by: userId,
          }))
        );
      }
    }

    if (createdCount === 0) {
      toast('Lỗi: ' + (firstError?.message || 'không tạo được task'), 'error');
      setSubmitting(false);
      return;
    }

    logActivity({ userId, userName, action: ACTIONS.TASK_CREATED, targetType: 'task', targetTitle: title.trim(), details: { assignee_count: createdCount, priority }, department, branch: department === 'nail' ? (taskBranch || null) : null });
    toast(`Đã tạo ${createdCount} task cho ${createdCount} người!`, 'success');
    setTitle(''); setDesc(''); setPriority('medium'); setDeadline(''); setAssignees([]); setWatchers([]); setGroupId(''); setFiles([]);
    setSubmitting(false); onCreated();
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Giao task mới</h2>
        <p className="text-sm text-ink-3 mt-1">Giao trực tiếp cho một hoặc nhiều nhân viên.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Branch */}
        {department === 'nail' && branchOptions.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5">Chi nhánh <span style={{ color: 'var(--danger)' }}>*</span></label>
            {branchOptions.length === 1 ? (
              <div className="pill pill-accent px-3 py-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {branchLabel(branchOptions[0])}
              </div>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {branchOptions.map(bid => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => { setTaskBranch(bid); setAssignees([]); setWatchers([]); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      border: `1px solid ${taskBranch === bid ? 'var(--accent)' : 'var(--line)'}`,
                      background: taskBranch === bid ? 'var(--accent-soft)' : '#fff',
                      color: taskBranch === bid ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: taskBranch === bid ? 600 : 400,
                    }}
                  >
                    {branchLabel(bid)}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] font-mono text-muted-ink mt-1">
              Chỉ nhân sự thuộc chi nhánh này (+ TGĐ/Kế toán) sẽ hiển thị ở danh sách giao.
            </p>
          </div>
        )}

        {/* Group */}
        {taskGroups.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5">Nhóm công việc</label>
            <select className="input-field" value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">— Không chọn —</option>
              {taskGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1.5">
            Tiêu đề <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="VD: Hoàn thiện báo cáo tháng" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1.5">Mô tả</label>
          <textarea
            className="input-field min-h-[80px] resize-y"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Chi tiết công việc..."
          />
        </div>

        {/* Assignees */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-ink-2">
              Giao cho <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <span className="text-[11px] font-mono text-muted-ink">
              {assignees.length > 0 ? `đã chọn ${assignees.length}` : 'chọn 1 hoặc nhiều'}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl2 p-1" style={{ border: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
            {filteredMembers.length === 0 ? (
              <div className="text-xs text-muted-ink text-center py-4 font-mono">Không có nhân sự khớp chi nhánh này</div>
            ) : filteredMembers.map(m => {
              const sel = assignees.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => toggleAssignee(m.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all"
                  style={{ background: sel ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--line)'}`,
                      background: sel ? 'var(--accent)' : '#fff',
                    }}
                  >
                    {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0" style={{ background: m.avatar_color, color: '#333' }}>{ini(m.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-ink">{m.name}</p>
                    <p className="text-[10px] font-mono truncate text-muted-ink">{m.position || m.role}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Watchers */}
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-2">
            Người theo dõi <span className="text-muted-ink font-normal">(tùy chọn)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {filteredMembers.filter(m => !assignees.includes(m.id)).map(m => {
              const sel = watchers.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleWatcher(m.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    border: `1px solid ${sel ? 'var(--violet)' : 'var(--line)'}`,
                    background: sel ? 'var(--violet-soft)' : '#fff',
                    color: sel ? 'var(--violet)' : 'var(--muted)',
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority + Deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5">Ưu tiên</label>
            <div className="flex gap-1.5">
              {[
                { v: 'high',   l: 'Cao',  color: 'var(--danger)', bg: 'var(--danger-soft)' },
                { v: 'medium', l: 'TB',   color: 'var(--warn)',   bg: 'var(--warn-soft)' },
                { v: 'low',    l: 'Thấp', color: 'var(--accent)', bg: 'var(--accent-soft)' },
              ].map(p => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPriority(p.v)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={priority === p.v ? {
                    border: `1px solid ${p.color}`,
                    background: p.bg,
                    color: p.color,
                  } : {
                    border: '1px solid var(--line)',
                    background: '#fff',
                    color: 'var(--muted)',
                  }}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1.5">Deadline</label>
            <input type="datetime-local" className="input-field !py-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        {/* Files */}
        <div>
          <label className="block text-xs font-medium text-ink-2 mb-1.5">Đính kèm</label>
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
                <span className="text-sm flex-shrink-0">{getFileIcon(f.name)}</span>
                <span className="text-xs text-ink-2 truncate flex-1">{f.name}</span>
                <span className="text-[10px] font-mono text-muted-ink flex-shrink-0">{formatFileSize(f.size)}</span>
                <button type="button" onClick={() => removeFile(i)} className="flex-shrink-0 p-1 rounded hover:bg-white transition-colors" style={{ color: 'var(--danger)' }} title="Xoá file">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-bone-soft" style={{ border: '1px dashed var(--line)', background: '#fff' }}>
              <svg className="w-4 h-4" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-muted-ink">Chọn file đính kèm</span>
              <input type="file" multiple className="hidden" onChange={handleAddFile} />
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full disabled:opacity-50 py-3 text-sm flex items-center justify-center gap-1.5"
        >
          {submitting ? 'Đang tạo...' : (<>Tạo & giao task <span>→</span></>)}
        </button>
      </form>
    </div>
  );
}
