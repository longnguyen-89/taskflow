import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';
import { logActivity, ACTIONS } from '@/lib/activityLog';

function getFileIcon(name) {
  const ext = (name || '').toLowerCase();
  if (ext.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) return 'ðŸ–¼';
  if (ext.match(/\.pdf$/)) return 'ðŸ“„';
  if (ext.match(/\.(doc|docx)$/)) return 'ðŸ“';
  if (ext.match(/\.(xls|xlsx|csv)$/)) return 'ðŸ“Š';
  if (ext.match(/\.(ppt|pptx)$/)) return 'ðŸ“½';
  return 'ðŸ“Ž';
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

  // Chi nhÃ¡nh cÃ³ thá»ƒ chá»n khi táº¡o (cho dept=nail).
  const branchOptions = (department === 'nail')
    ? (canViewAll ? NAIL_BRANCHES.map(b => b.id) : (Array.isArray(allowedBranches) ? allowedBranches : []))
    : [];
  const [taskBranch, setTaskBranch] = useState(branch || (branchOptions.length === 1 ? branchOptions[0] : ''));
  useEffect(() => {
    setTaskBranch(branch || (branchOptions.length === 1 ? branchOptions[0] : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, department]);

  // Giá»›i háº¡n danh sÃ¡ch giao task theo chi nhÃ¡nh Ä‘ang chá»n.
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
    if (!title.trim()) return toast('Nháº­p tiÃªu Ä‘á»', 'error');
    if (assignees.length === 0) return toast('Chá»n ngÆ°á»i thá»±c hiá»‡n', 'error');
    if (department === 'nail' && branchOptions.length > 0 && !taskBranch) return toast('Chá»n chi nhÃ¡nh cho task', 'error');
    setSubmitting(true);

    // PHÆ¯Æ NG ÃN A: giao cho N ngÆ°á»i â†’ táº¡o N task RIÃŠNG BIá»†T, má»—i ngÆ°á»i 1 task.
    // Táº¥t cáº£ Ä‘Æ°á»£c gáº¯n cÃ¹ng group_key Ä‘á»ƒ quáº£n lÃ½ biáº¿t chÃºng xuáº¥t phÃ¡t tá»« 1 láº§n giao.
    // Má»—i task cÃ³ status + completed_at + comments + checklist riÃªng â†’ khÃ´ng cÃ²n
    // chuyá»‡n 1 ngÆ°á»i xong lÃ  cáº£ nhÃ³m bá»‹ tick xong.
    const groupKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    // Upload files 1 láº§n, lÆ°u URL â€” rá»“i táº¡o task_files row riÃªng cho tá»«ng task.
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

      // Assignee duy nháº¥t cho task nÃ y
      await supabase.from('task_assignees').insert({ task_id: task.id, user_id: uid });

      // ThÃ´ng bÃ¡o cho ngÆ°á»i Ä‘Æ°á»£c giao
      if (uid !== userId) {
        await supabase.from('notifications').insert({
          user_id: uid, type: 'new_task', title: 'Task má»›i',
          message: `${userName} giao: "${title}"`, task_id: task.id,
        });
        sendPush(uid, 'ðŸ“‹ Task má»›i', `${userName} giao: "${title}"`, { url: '/dashboard', tag: 'task-' + task.id });
      }

      // Watchers cho tá»«ng task
      for (const wid of watchers) {
        await supabase.from('task_watchers').insert({ task_id: task.id, user_id: wid });
        await supabase.from('notifications').insert({
          user_id: wid, type: 'info', title: 'Báº¡n Ä‘Æ°á»£c thÃªm theo dÃµi',
          message: `Task: "${title}"`, task_id: task.id,
        });
        sendPush(wid, 'ðŸ‘ Theo dÃµi task', `Báº¡n Ä‘Æ°á»£c thÃªm theo dÃµi: "${title}"`, { url: '/dashboard', tag: 'watch-' + task.id });
      }

      // File Ä‘Ã­nh kÃ¨m â€” má»—i task cÃ³ báº£n ghi riÃªng trá» cÃ¹ng URL
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
      toast('Lá»—i: ' + (firstError?.message || 'khÃ´ng táº¡o Ä‘Æ°á»£c task'), 'error');
      setSubmitting(false);
      return;
    }

    logActivity({ userId, userName, action: ACTIONS.TASK_CREATED, targetType: 'task', targetTitle: title.trim(), details: { assignee_count: createdCount, priority }, department, branch: department === 'nail' ? (taskBranch || null) : null });
    toast(`ÄÃ£ táº¡o ${createdCount} task cho ${createdCount} ngÆ°á»i!`, 'success');
    setTitle(''); setDesc(''); setPriority('medium'); setDeadline(''); setAssignees([]); setWatchers([]); setGroupId(''); setFiles([]);
    setSubmitting(false); onCreated();
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-1" style={{ color: '#123524' }}>Giao task má»›i</h2>
        <p className="text-xs text-gray-500 mb-5">Giao trá»±c tiáº¿p cho nhÃ¢n viÃªn</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {department === 'nail' && branchOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chi nhÃ¡nh *</label>
              {branchOptions.length === 1 ? (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">{branchLabel(branchOptions[0])}</div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {branchOptions.map(bid => (
                    <button key={bid} type="button" onClick={() => { setTaskBranch(bid); setAssignees([]); setWatchers([]); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${taskBranch === bid ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                      {branchLabel(bid)}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Chá»‰ nhÃ¢n sá»± thuá»™c chi nhÃ¡nh nÃ y (+ TGÄ/Káº¿ toÃ¡n) sáº½ hiá»ƒn thá»‹ á»Ÿ danh sÃ¡ch giao task.</p>
            </div>
          )}
          {taskGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">NhÃ³m cÃ´ng viá»‡c</label>
              <select className="input-field" value={groupId} onChange={e => setGroupId(e.target.value)}>
                <option value="">â€” KhÃ´ng chá»n â€”</option>
                {taskGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">TiÃªu Ä‘á» *</label>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="VD: HoÃ n thiá»‡n bÃ¡o cÃ¡o thÃ¡ng" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MÃ´ táº£</label>
            <textarea className="input-field min-h-[80px] resize-y" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Chi tiáº¿t cÃ´ng viá»‡c..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Giao cho * <span className="text-gray-400">(chá»n 1 hoáº·c nhiá»u)</span></label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-1">
              {filteredMembers.map(m => (
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
            <label className="block text-xs font-medium text-gray-600 mb-2">NgÆ°á»i theo dÃµi <span className="text-gray-400">(tÃ¹y chá»n)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {filteredMembers.filter(m => !assignees.includes(m.id)).map(m => (
                <button key={m.id} type="button" onClick={() => toggleWatcher(m.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${watchers.includes(m.id) ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>{m.name}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Æ¯u tiÃªn</label>
              <div className="flex gap-1.5">
                {[{ v: 'high', l: 'Cao', c: '#dc2626' }, { v: 'medium', l: 'TB', c: '#d97706' }, { v: 'low', l: 'Tháº¥p', c: '#2563eb' }].map(p => (
                  <button key={p.v} type="button" onClick={() => setPriority(p.v)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                    style={priority === p.v ? { borderColor: p.c, background: p.c + '10', color: p.c } : { borderColor: '#e5e7eb', color: '#9ca3af' }}>{p.l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deadline (ngÃ y + giá»)</label>
              <input type="datetime-local" className="input-field !py-2" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>

          {/* File upload - each file on its own line */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ÄÃ­nh kÃ¨m</label>
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <span className="text-sm flex-shrink-0">{getFileIcon(f.name)}</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="XÃ³a file">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                <span className="text-xs text-gray-500">Chá»n file</span>
                <input type="file" multiple className="hidden" onChange={handleAddFile} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #123524, #2E6F4C)' }}>
            {submitting ? 'Äang táº¡o...' : 'Táº¡o & giao task'}
          </button>
        </form>
      </div>
    </div>
  );
}
