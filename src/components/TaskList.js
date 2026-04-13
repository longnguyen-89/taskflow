import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';

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

export default function TaskList({ tasks, members, isAdmin, userId, onRefresh }) {
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  async function loadComments(tid) {
    const { data } = await supabase.from('comments').select('*, user:profiles!comments_user_id_fkey(name, avatar_color)').eq('task_id', tid).order('created_at', { ascending: true });
    setComments(p => ({ ...p, [tid]: data || [] }));
  }

  async function addComment(tid) {
    if (!newComment.trim() && commentFiles.length === 0) return;
    setUploading(true);
    const uploadedFiles = [];
    for (const f of commentFiles) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = 'comments/' + tid + '/' + Date.now() + '_' + safeName;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        uploadedFiles.push({ name: f.name, url: publicUrl, type: f.type, size: f.size });
      }
    }
    await supabase.from('comments').insert({
      task_id: tid, user_id: userId, content: newComment.trim(),
      files: uploadedFiles.length > 0 ? uploadedFiles : null,
    });
    setNewComment(''); setCommentFiles([]); setUploading(false); loadComments(tid);
  }

  async function updateStatus(tid, s) {
    const u = { status: s, updated_at: new Date().toISOString() };
    if (s === 'done') u.completed_at = new Date().toISOString();
    await supabase.from('tasks').update(u).eq('id', tid);
    const task = tasks.find(t => t.id === tid);
    if (task && task.created_by !== userId) {
      const userName = members.find(m => m.id === userId)?.name || '';
      sendPush(task.created_by, ST[s].l, userName + ' chuyển "' + task.title + '" → ' + ST[s].l, { url: '/dashboard', tag: 'status-' + tid });
    }
    toast(ST[s].l, 'success'); onRefresh();
  }

  function toggle(tid) { if (expanded === tid) { setExpanded(null); return; } setExpanded(tid); if (!comments[tid]) loadComments(tid); }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '';
  const timeAgo = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return 'Vừa xong'; if (m < 60) return m + 'p'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; };
  const isOverdue = (d, s) => s !== 'done' && d && new Date(d) < new Date();

  if (isAdmin) {
    const grouped = {};
    tasks.forEach(t => {
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
        {Object.entries(grouped).map(([key, g]) => {
          const done = g.tasks.filter(t => t.status === 'done').length;
          const pct = g.tasks.length > 0 ? Math.round((done / g.tasks.length) * 100) : 0;
          return (
            <div key={key} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: g.avatar_color || '#f3f4f6', color: '#333' }}>{ini(g.name)}</div>
                <div className="flex-1"><p className="text-sm font-semibold">{g.name}</p><p className="text-[10px] text-gray-400">{g.position} · {done}/{g.tasks.length} xong</p></div>
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: pct + '%', background: pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }} /></div>
                <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{pct}%</span>
              </div>
              <div className="space-y-1.5">{g.tasks.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} nc={newComment} setNc={setNewComment} addC={addComment} uid={userId} commentFiles={commentFiles} setCommentFiles={setCommentFiles} uploading={uploading} />)}</div>
            </div>
          );
        })}
        {tasks.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có task</div>}
      </div>
    );
  }

  const todo = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  return (
    <div className="space-y-4">
      {todo.length > 0 && <div><p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Cần làm ({todo.length})</p><div className="space-y-1.5">{todo.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} nc={newComment} setNc={setNewComment} addC={addComment} uid={userId} commentFiles={commentFiles} setCommentFiles={setCommentFiles} uploading={uploading} />)}</div></div>}
      {done.length > 0 && <div><p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Đã xong ({done.length})</p><div className="space-y-1.5 opacity-50">{done.map(t => <Row key={t.id} t={t} exp={expanded === t.id} toggle={() => toggle(t.id)} upd={updateStatus} ini={ini} fmtDT={fmtDT} fmtDate={fmtDate} timeAgo={timeAgo} isOverdue={isOverdue} comments={comments[t.id]} nc={newComment} setNc={setNewComment} addC={addComment} uid={userId} commentFiles={commentFiles} setCommentFiles={setCommentFiles} uploading={uploading} />)}</div></div>}
      {tasks.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có task</div>}
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
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group">
            <span className="text-sm flex-shrink-0">{icon}</span>
            <span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">{f.file_name || f.name}</span>
            {(f.file_size || f.size) > 0 && <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.file_size || f.size)}</span>}
            <svg className="w-3 h-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </a>
        );
      })}
    </div>
  );
}

function Row({ t, exp, toggle, upd, ini, fmtDT, fmtDate, timeAgo, isOverdue, comments, nc, setNc, addC, uid, commentFiles, setCommentFiles, uploading }) {
  const st = ST[t.status] || ST.todo;
  const pr = PR[t.priority] || PR.medium;
  const od = isOverdue(t.deadline, t.status);
  const assigneeNames = t.assignees?.map(a => a.user?.name).filter(Boolean).join(', ') || '';

  return (
    <div className={`border rounded-xl transition-all ${od ? 'border-l-[3px] border-l-red-500 border-red-200' : 'border-gray-100'} ${exp ? 'bg-gray-50/50' : 'bg-white hover:bg-gray-50/30'}`}>
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={toggle}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: st.c }} />
        <p className={`text-sm font-medium flex-1 truncate ${t.status === 'done' ? 'line-through text-gray-400' : ''}`}>{t.title}</p>
        {assigneeNames && <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{assigneeNames}</span>}
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: st.c + '15', color: st.c }}>{st.l}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: pr.c + '15', color: pr.c }}>{pr.l}</span>
        <span className={`text-[10px] flex-shrink-0 ${od ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{fmtDate(t.deadline)}{od && ' !'}</span>
        <svg className={`w-3 h-3 text-gray-300 transition-transform ${exp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>
      {exp && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 animate-fade-in">
          {t.description && <p className="text-xs text-gray-500 mb-2">{t.description}</p>}
          <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 mb-2">
            <span>Tạo: {fmtDT(t.created_at)}</span>
            {t.deadline && <span>Hạn: {fmtDT(t.deadline)}</span>}
            {t.completed_at && <span>Xong: {fmtDT(t.completed_at)}</span>}
            <span>Giao bởi: {t.creator?.name}</span>
          </div>
          {/* Task files - each on its own line */}
          {t.files?.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Đính kèm ({t.files.length})</p>
              <FileList files={t.files} />
            </div>
          )}
          {/* Status buttons */}
          {t.status !== 'done' && (
            <div className="flex gap-1 mb-3 flex-wrap">
              {['todo', 'doing', 'waiting', 'done'].filter(s => s !== t.status).map(s => (
                <button key={s} onClick={() => upd(t.id, s)} className="px-2 py-1 rounded text-[10px] font-semibold cursor-pointer hover:opacity-80" style={{ background: ST[s].c + '15', color: ST[s].c }}>→ {ST[s].l}</button>
              ))}
            </div>
          )}
          {/* Comments */}
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Bình luận {comments?.length > 0 && `(${comments.length})`}</p>
            {comments?.map(c => (
              <div key={c.id} className="flex gap-2 mb-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0 mt-0.5" style={{ background: c.user?.avatar_color, color: '#333' }}>{ini(c.user?.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px]"><strong>{c.user?.name}</strong> · {timeAgo(c.created_at)}</p>
                  {c.content && <p className="text-xs text-gray-600">{c.content}</p>}
                  {c.files && c.files.length > 0 && <FileList files={c.files} />}
                </div>
              </div>
            ))}
            {/* Comment input with file attach */}
            <div className="space-y-1.5 mt-1.5">
              <div className="flex gap-2">
                <input className="input-field !py-1.5 !text-xs flex-1" placeholder="Bình luận..." value={exp ? nc : ''} onChange={e => setNc(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addC(t.id)} />
                <label className="flex items-center px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-500" title="Đính kèm file">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <input type="file" multiple className="hidden" onChange={e => setCommentFiles([...e.target.files])} />
                </label>
                <button onClick={() => addC(t.id)} disabled={uploading} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#2D5A3D' }}>
                  {uploading ? '...' : 'Gửi'}
                </button>
              </div>
              {commentFiles.length > 0 && (
                <div className="space-y-1">
                  {Array.from(commentFiles).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-50 text-xs text-blue-700">
                      <span>{getFileIcon(f.name)}</span>
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-[9px] text-blue-400">{formatFileSize(f.size)}</span>
                    </div>
                  ))}
                  <button onClick={() => setCommentFiles([])} className="text-[10px] text-red-400 hover:text-red-600">Xóa tất cả file</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
