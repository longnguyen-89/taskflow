import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';

const MAIN_TABS = [
  { id: 'mua_hang', label: 'Mua hàng' },
  { id: 'thanh_toan', label: 'Thanh toán' },
];

export default function Proposals({ userId, userName, members, department, isDirector, canApprove }) {
  const [activeTab, setActiveTab] = useState('mua_hang');
  const [proposals, setProposals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState('');
  const [cost, setCost] = useState('');
  const [approverIds, setApproverIds] = useState([]);
  const [watcherIds, setWatcherIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const approvers = members.filter(m => m.id !== userId && (m.role === 'director' || m.role === 'accountant'));
  const watcherOptions = members.filter(m => m.id !== userId && !approverIds.includes(m.id));

  useEffect(() => { fetchAll(); }, [department, dateFrom, dateTo]);

  async function fetchAll() {
    let q = supabase.from('proposals')
      .select('*, creator:profiles!proposals_created_by_fkey(id, name, avatar_color, position), approvers:proposal_approvers(*, user:profiles!proposal_approvers_user_id_fkey(id, name, avatar_color)), watchers:proposal_watchers(*, user:profiles!proposal_watchers_user_id_fkey(id, name)), files:proposal_files(*)')
      .eq('department', department).order('created_at', { ascending: false });
    if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data } = await q;
    setProposals(data || []);
    const { data: cats } = await supabase.from('proposal_categories').select('*').order('name');
    setCategories(cats || []);
  }

  async function loadComments(pid) {
    const { data } = await supabase.from('comments').select('*, user:profiles!comments_user_id_fkey(name, avatar_color)').eq('proposal_id', pid).order('created_at');
    setComments(p => ({ ...p, [pid]: data || [] }));
  }
  async function addComment(pid) {
    if (!newComment.trim()) return;
    await supabase.from('comments').insert({ proposal_id: pid, user_id: userId, content: newComment.trim() });
    setNewComment(''); loadComments(pid);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast('Nhập tiêu đề', 'error');
    if (approverIds.length === 0) return toast('Chọn người duyệt', 'error');
    setSubmitting(true);
    const tabLabel = MAIN_TABS.find(t => t.id === activeTab)?.label || 'Mua hàng';
    const catName = catId ? (categories.find(c => c.id === catId)?.name || tabLabel) : tabLabel;
    const { data: p, error } = await supabase.from('proposals').insert({
      title: title.trim(), description: desc.trim(), category_id: catId || null,
      category_name: catName, estimated_cost: cost ? parseInt(cost) : null, department, created_by: userId
    }).select().single();
    if (error) { toast('Lỗi: ' + error.message, 'error'); setSubmitting(false); return; }
    for (const aid of approverIds) {
      await supabase.from('proposal_approvers').insert({ proposal_id: p.id, user_id: aid });
      await supabase.from('notifications').insert({ user_id: aid, type: 'approval_request', title: 'Đề xuất cần duyệt', message: `${userName}: "${title}"`, proposal_id: p.id });
      sendPush(aid, '📝 Đề xuất cần duyệt', `${userName}: "${title}"`, { url: '/dashboard', tag: 'proposal-' + p.id });
    }
    for (const wid of watcherIds) {
      await supabase.from('proposal_watchers').insert({ proposal_id: p.id, user_id: wid });
      await supabase.from('notifications').insert({ user_id: wid, type: 'info', title: 'Đề xuất để theo dõi', message: `${userName}: "${title}"`, proposal_id: p.id });
      sendPush(wid, '👁 Đề xuất theo dõi', `${userName}: "${title}"`, { url: '/dashboard', tag: 'proposal-w-' + p.id });
    }
    for (const f of files) {
      const path = `proposals/${p.id}/${Date.now()}_${f.name}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (!ue) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        await supabase.from('proposal_files').insert({ proposal_id: p.id, file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size, uploaded_by: userId });
      }
    }
    toast('Đã gửi đề xuất!', 'success');
    setTitle(''); setDesc(''); setCost(''); setApproverIds([]); setWatcherIds([]); setFiles([]); setCatId('');
    setShowForm(false); setSubmitting(false); fetchAll();
  }

  async function handleApprove(pid, uid, action) {
    await supabase.from('proposal_approvers').update({ status: action, decided_at: new Date().toISOString() }).eq('proposal_id', pid).eq('user_id', uid);
    const { data: all } = await supabase.from('proposal_approvers').select('status').eq('proposal_id', pid);
    const done = all?.every(a => a.status !== 'pending');
    const approved = all?.every(a => a.status === 'approved');
    if (done) await supabase.from('proposals').update({ status: approved ? 'approved' : 'rejected', updated_at: new Date().toISOString() }).eq('id', pid);
    else await supabase.from('proposals').update({ status: 'partial', updated_at: new Date().toISOString() }).eq('id', pid);
    // Push notify the creator
    const proposal = proposals.find(p => p.id === pid);
    if (proposal && proposal.created_by !== uid) {
      const approverName = members.find(m => m.id === uid)?.name || '';
      const statusText = action === 'approved' ? '✅ đã duyệt' : '❌ đã từ chối';
      sendPush(proposal.created_by, `Đề xuất ${statusText}`, `${approverName} ${statusText}: "${proposal.title}"`, { url: '/dashboard', tag: 'approval-' + pid });
      await supabase.from('notifications').insert({ user_id: proposal.created_by, type: action === 'approved' ? 'approved' : 'rejected', title: `Đề xuất ${statusText}`, message: `${approverName} ${statusText}: "${proposal.title}"`, proposal_id: pid });
    }
    toast(action === 'approved' ? 'Đã duyệt!' : 'Đã từ chối', 'success'); fetchAll();
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const fmtCost = c => c ? new Intl.NumberFormat('vi-VN').format(c) + 'đ' : '';
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const timeAgo = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 60) return `${m}p`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
  const STS = { pending: { l: 'Chờ duyệt', c: '#d97706' }, partial: { l: 'Đang duyệt', c: '#2563eb' }, approved: { l: 'Đã duyệt', c: '#16a34a' }, rejected: { l: 'Từ chối', c: '#dc2626' } };

  const tabLabel = MAIN_TABS.find(t => t.id === activeTab)?.label;
  const tabProposals = proposals.filter(p => {
    if (activeTab === 'thanh_toan') return p.category_name === 'Thanh toán';
    return p.category_name !== 'Thanh toán';
  });
  const filteredProposals = filterCat === 'all' ? tabProposals : tabProposals.filter(p => p.category_name === filterCat);
  const subCatCounts = {};
  tabProposals.forEach(p => { subCatCounts[p.category_name] = (subCatCounts[p.category_name] || 0) + 1; });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: '#f0ebe4' }}>
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setFilterCat('all'); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {t.label}
              <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                ({proposals.filter(p => t.id === 'thanh_toan' ? p.category_name === 'Thanh toán' : p.category_name !== 'Thanh toán').length})
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>+ Tạo đề xuất</button>
      </div>

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {Object.keys(subCatCounts).length > 1 && (
          <>
            <button onClick={() => setFilterCat('all')} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterCat === 'all' ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterCat === 'all' ? { background: '#2D5A3D' } : {}}>Tất cả ({tabProposals.length})</button>
            {Object.entries(subCatCounts).map(([name, count]) => (
              <button key={name} onClick={() => setFilterCat(name)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterCat === name ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterCat === name ? { background: '#2D5A3D' } : {}}>{name} ({count})</button>
            ))}
            <span className="text-gray-300">|</span>
          </>
        )}
        <span className="text-[11px] text-gray-500">Thời gian:</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:underline">Xóa</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-5 animate-slide-up">
          <h3 className="font-semibold text-sm mb-1">Tạo đề xuất — {tabLabel}</h3>
          <p className="text-[11px] text-gray-400 mb-4">Đề xuất sẽ được lưu vào tab "{tabLabel}"</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề *</label><input className="input-field !text-sm" value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Phân loại chi tiết</label>
                <select className="input-field !text-sm" value={catId} onChange={e => setCatId(e.target.value)}>
                  <option value="">— {tabLabel} (mặc định) —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Mô tả chi tiết</label><textarea className="input-field !text-sm min-h-[70px] resize-y" value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Chi phí dự kiến (VNĐ)</label><input className="input-field !text-sm" type="number" value={cost} onChange={e => setCost(e.target.value)} /></div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Người duyệt * <span className="text-gray-400">(TGĐ / Kế toán)</span></label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {approvers.length === 0 ? <p className="p-3 text-xs text-gray-400">Chưa có TGĐ hoặc Kế toán</p> : approvers.map(m => (
                  <div key={m.id} onClick={() => setApproverIds(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all ${approverIds.includes(m.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${approverIds.includes(m.id) ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                      {approverIds.includes(m.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: m.avatar_color, color: '#333' }}>{ini(m.name)}</div>
                    <div className="flex-1"><p className="text-xs font-medium">{m.name}</p><p className="text-[10px] text-gray-400">{m.role === 'director' ? 'Tổng Giám đốc' : 'Kế toán'}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Người theo dõi <span className="text-gray-400">(chọn nhiều)</span></label>
              <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
                {watcherOptions.map(m => (
                  <div key={m.id} onClick={() => setWatcherIds(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-gray-50 last:border-b-0 transition-all ${watcherIds.includes(m.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${watcherIds.includes(m.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {watcherIds.includes(m.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: m.avatar_color, color: '#333' }}>{ini(m.name)}</div>
                    <p className="text-xs">{m.name} <span className="text-[10px] text-gray-400">({m.position})</span></p>
                  </div>
                ))}
              </div>
              {watcherIds.length > 0 && <p className="text-[10px] text-blue-600 mt-1">{watcherIds.length} người đã chọn</p>}
            </div>

            <div><label className="block text-xs font-medium text-gray-600 mb-1">Đính kèm file</label>
              <input type="file" multiple onChange={e => setFiles([...e.target.files])} className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100" />
              {files.length > 0 && <p className="text-[10px] text-gray-400 mt-1">{files.length} file</p>}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#2D5A3D' }}>{submitting ? 'Đang gửi...' : 'Gửi đề xuất'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary !text-xs">Hủy</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {filteredProposals.map(p => {
          const sc = STS[p.status]; const isExp = expanded === p.id;
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start gap-3 cursor-pointer" onClick={() => { setExpanded(isExp ? null : p.id); if (!isExp && !comments[p.id]) loadComments(p.id); }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ background: p.creator?.avatar_color, color: '#333' }}>{ini(p.creator?.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{p.title}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: sc.c + '15', color: sc.c }}>{sc.l}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500">{p.category_name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.creator?.name} · {fmtDT(p.created_at)} {p.estimated_cost ? ` · ${fmtCost(p.estimated_cost)}` : ''}</p>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform mt-1 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {isExp && (
                <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
                  {p.description && <p className="text-xs text-gray-600 mb-2 leading-relaxed">{p.description}</p>}
                  {p.estimated_cost && <p className="text-xs mb-2">Chi phí: <strong>{fmtCost(p.estimated_cost)}</strong></p>}
                  {p.files?.length > 0 && (<div className="mb-3"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">File đính kèm</p><div className="flex flex-wrap gap-1">{p.files.map(f => <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600 hover:bg-gray-200">{f.file_name}</a>)}</div></div>)}
                  <div className="mb-2"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Người duyệt</p>
                    {p.approvers?.map(a => (
                      <div key={a.id} className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: a.user?.avatar_color, color: '#333' }}>{ini(a.user?.name)}</div>
                        <span className="text-xs flex-1">{a.user?.name}</span>
                        {a.status === 'approved' && <span className="text-[10px] text-green-600 font-semibold">✓ Duyệt {a.decided_at ? fmtDT(a.decided_at) : ''}</span>}
                        {a.status === 'rejected' && <span className="text-[10px] text-red-600 font-semibold">✗ Từ chối</span>}
                        {a.status === 'pending' && a.user_id === userId && canApprove && (
                          <div className="flex gap-1"><button onClick={() => handleApprove(p.id, userId, 'approved')} className="px-2 py-0.5 bg-green-600 text-white rounded text-[10px]">Duyệt</button><button onClick={() => handleApprove(p.id, userId, 'rejected')} className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px]">Từ chối</button></div>
                        )}
                        {a.status === 'pending' && (a.user_id !== userId || !canApprove) && <span className="text-[10px] text-amber-600">Chờ...</span>}
                      </div>
                    ))}
                  </div>
                  {p.watchers?.length > 0 && (<div className="mb-2"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Theo dõi</p><div className="flex gap-1 flex-wrap">{p.watchers.map(w => <span key={w.id} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500">{w.user?.name}</span>)}</div></div>)}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Bình luận {comments[p.id]?.length > 0 && `(${comments[p.id].length})`}</p>
                    {comments[p.id]?.map(c => (<div key={c.id} className="flex gap-2 mb-1"><div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: c.user?.avatar_color, color: '#333' }}>{ini(c.user?.name)}</div><div><p className="text-[10px]"><strong>{c.user?.name}</strong> · {timeAgo(c.created_at)}</p><p className="text-xs text-gray-600">{c.content}</p></div></div>))}
                    <div className="flex gap-2 mt-1.5"><input className="input-field !py-1.5 !text-xs flex-1" placeholder="Bình luận..." value={isExp ? newComment : ''} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(p.id)} /><button onClick={() => addComment(p.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>Gửi</button></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredProposals.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có đề xuất nào trong mục này</div>}
      </div>
    </div>
  );
}
