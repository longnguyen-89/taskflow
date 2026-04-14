import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';

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

export default function CreateTask({ members, userId, userName, department, taskGroups, onCreated }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);

    // PHƯƠNG ÁN A: giao cho N người → tạo N task RIÊNG BIỆT, mỗi người 1 task.
    // Tất cả được gắn cùng group_key để quản lý biết chúng xuất phát từ 1 lần giao.
    // Mỗi task có status + completed_at + comments + checklist riêng → không còn
    // chuyện 1 người xong là cả nhóm bị tick xong.
    const groupKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    // Upload files 1 lần, lưu URL — rồi tạo task_files row riêng cho từng task.
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
        group_id: groupId || null,
        group_key: groupKey,
        deadline: deadlineISO,
        created_by: userId,
        status: 'todo',
        approval_status: 'none',
      }).select().single();

      if (error) { firstError = firstError || error; continue; }
      createdCount++;

      // Assignee duy nhất cho task này
      await supabase.from('task_assignees').insert({ task_id: task.id, user_id: uid });

      // Thông báo cho người được giao
      if (uid !== userId) {
        await supabase.from('notifications').insert({
          user_id: uid, type: 'new_task', title: 'Task mới',
          message: `${userName} giao: "${title}"`, task_id: task.id,
        });
        sendPush(uid, '📋 Task mới', `${userName} giao: "${title}"`, { url: '/dashboard', tag: 'task-' + task.id });
      }

      // Watchers cho từng task
      for (const wid of watchers) {
        await supabase.from('task_watchers').insert({ task_id: task.id, user_id: wid });
        await supabase.from('notifications').insert({
          user_id: wid, type: 'info', title: 'Bạn được thêm theo dõi',
          message: `Task: "${title}"`, task_id: task.id,
        });
        sendPush(wid, '👁 Theo dõi task', `Bạn được thêm theo dõi: "${title}"`, { url: '/dashboard', tag: 'watch-' + task.id });
      }

      // File đính kèm — mỗi task có bản ghi riêng trỏ cùng URL
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

    toast(`Đã tạo ${createdCount} task cho ${createdCount} người!`, 'success');
    setTitle(''); setDesc(''); setPriority('medium'); setDeadline(''); setAssignees([]); setWatchers([]); setGroupId(''); setFiles([]);
    setSubmitting(false); onCreated();
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-1" style={{ color: '#2D5A3D' }}>Giao task mới</h2>
        <p className="text-xs text-gray-500 mb-5">Giao trực tiếp cho nhân viên</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {taskGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nhóm công việc</label>
              <select className="input-field" value={groupId} onChange={e => setGroupId(e.target.value)}>
                <option value="">— Không chọn —</option>
                {taskGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề *</label>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="VD: Hoàn thiện báo cáo tháng" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mô tả</label>
            <textarea className="input-field min-h-[80px] resize-y" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Chi tiết công việc..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Giao cho * <span className="text-gray-400">(chọn 1 hoặc nhiều)</span></label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-1">
              {members.map(m => (
                <div key={m.id} onClick={() => toggleAssignee(m.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${assignees.includes(m.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${assignees.includes(m.id) ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                    {assignees.includes(m.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: m.avatar_color, color: '#333' }}>{ini(m.name)}</div>
                  <div className="flex-1"><p className="text-xs font-medium">{m.name}</p><p className="text-[10px] text-gray-400">{m.position}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Người theo dõi <span className="text-gray-400">(tùy chọn)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {members.filter(m => !assignees.includes(m.id)).map(m => (
                <button key={m.id} type="button" onClick={() => toggleWatcher(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${watchers.includes(m.id) ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>{m.name}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ưu tiên</label>
              <div className="flex gap-1.5">
                {[{ v: 'high', l: 'Cao', c: '#dc2626' }, { v: 'medium', l: 'TB', c: '#d97706' }, { v: 'low', l: 'Thấp', c: '#2563eb' }].map(p => (
                  <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                    style={priority === p.v ? { borderColor: p.c, background: p.c + '10', color: p.c } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>{p.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deadline (ngày + giờ)</label>
              <input type="datetime-local" className="input-field !py-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* File upload - each file on its own line */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Đính kèm</label>
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <span className="text-sm flex-shrink-0">{getFileIcon(f.name)}</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Xóa file">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                <span className="text-xs text-gray-500">Chọn file</span>
                <input type="file" multiple className="hidden" onChange={handleAddFile} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #2D5A3D, #4A7C5C)' }}>
            {submitting ? 'Đang tạo...' : 'Tạo & giao task'}
          </button>
        </form>
      </div>
    </div>
  );
}
