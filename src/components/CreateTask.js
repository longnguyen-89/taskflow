import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast('Nhập tiêu đề', 'error');
    if (assignees.length === 0) return toast('Chọn người thực hiện', 'error');
    setSubmitting(true);

    const { data: task, error } = await supabase.from('tasks').insert({
      title: title.trim(), description: desc.trim(), priority, department, group_id: groupId || null,
      deadline: deadline ? new Date(deadline).toISOString() : null, created_by: userId, status: 'todo', approval_status: 'none'
    }).select().single();

    if (error) { toast('Lỗi: ' + error.message, 'error'); setSubmitting(false); return; }

    // Assignees
    for (const uid of assignees) {
      await supabase.from('task_assignees').insert({ task_id: task.id, user_id: uid });
      if (uid !== userId) {
        await supabase.from('notifications').insert({ user_id: uid, type: 'new_task', title: 'Task mới', message: `${userName} giao: "${title}"`, task_id: task.id });
      }
    }
    // Watchers
    for (const uid of watchers) {
      await supabase.from('task_watchers').insert({ task_id: task.id, user_id: uid });
      await supabase.from('notifications').insert({ user_id: uid, type: 'info', title: 'Bạn được thêm theo dõi', message: `Task: "${title}"`, task_id: task.id });
    }
    // Files
    for (const f of files) {
      const path = `tasks/${task.id}/${Date.now()}_${f.name}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (!ue) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        await supabase.from('task_files').insert({ task_id: task.id, file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size, uploaded_by: userId });
      }
    }

    toast('Đã tạo & giao task!', 'success');
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

          {/* Assignees - list with checkbox style */}
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

          {/* Watchers */}
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
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all`}
                    style={priority === p.v ? { borderColor: p.c, background: p.c + '10', color: p.c } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>{p.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deadline (ngày + giờ)</label>
              <input type="datetime-local" className="input-field !py-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Đính kèm</label>
            <input type="file" multiple onChange={e => setFiles([...e.target.files])}
              className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
            {files.length > 0 && <p className="text-[10px] text-gray-400 mt-1">{files.length} file đã chọn</p>}
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #2D5A3D, #4A7C5C)' }}>
            {submitting ? 'Đang tạo...' : 'Tạo & giao task'}
          </button>
        </form>
      </div>
    </div>
  );
}
