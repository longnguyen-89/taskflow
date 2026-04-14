import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';
import { deleteProposalCascade } from '@/lib/deletions';

// Render @Name as styled chip in comment content
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
    parts.push(<span key={m.index} className="text-blue-600 font-semibold bg-blue-50 px-1 rounded">@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Input with @mention autocomplete dropdown
function MentionInput({ value, setValue, onSend, mentionables, onMention, ini, placeholder }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchor, setAnchor] = useState(0);
  const [selIdx, setSelIdx] = useState(0);
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = open
    ? mentionables.filter(m => { if (!query) return true; return norm(m.name).includes(norm(query)); }).slice(0, 8)
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
        setOpen(true); setQuery(q); setAnchor(atIdx); return;
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
        placeholder={placeholder || 'Bình luận... (gõ @ để nhắc tên)'}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {filtered.map((m, i) => (
            <div key={m.id} onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
              className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer text-xs ${i === selIdx ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: m.avatar_color || '#f3f4f6', color: '#333' }}>{ini(m.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-[9px] text-gray-400 truncate">
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

function formatVND(val) {
  const num = String(val).replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('de-DE');
}

function parseVND(str) {
  return str.replace(/\./g, '').replace(/\D/g, '');
}

const MAIN_TABS = [
  { id: 'mua_hang', label: 'Mua hàng' },
  { id: 'thanh_toan', label: 'Thanh toán' },
];

export default function Proposals({ userId, userName, members, department, branch, allowedBranches, canViewAll: canViewAllProp, profile, isDirector, isAccountant, canApprove }) {
  // Chi nhánh được chọn khi tạo đề xuất mới. Mặc định = chi nhánh đang xem,
  // hoặc chi nhánh duy nhất của user nếu chỉ có 1.
  const defaultCreateBranch = branch || (department === 'nail' && profile?.branches?.length === 1 ? profile.branches[0] : '');
  const [createBranch, setCreateBranch] = useState(defaultCreateBranch);
  useEffect(() => { setCreateBranch(branch || (department === 'nail' && profile?.branches?.length === 1 ? profile.branches[0] : '')); }, [branch, department, profile]);
  const [activeTab, setActiveTab] = useState('mua_hang');
  const [proposals, setProposals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [catId, setCatId] = useState('');
  const [costDisplay, setCostDisplay] = useState('');
  const [approverIds, setApproverIds] = useState([]);
  const [watcherIds, setWatcherIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [mentionedIds, setMentionedIds] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  // Chi nhánh user được phép tạo đề xuất cho (TGĐ/KT: 4 cn, admin: cn phụ trách, member: 1 cn).
  const createBranchOptions = (department === 'nail')
    ? (canViewAllProp ? NAIL_BRANCHES.map(b => b.id) : (Array.isArray(profile?.branches) ? profile.branches : []))
    : [];

  const deptMembers = members.filter(m => m.department === department || m.role === 'director' || m.role === 'accountant');
  const approvers = deptMembers.filter(m => m.id !== userId && (m.role === 'director' || m.role === 'accountant'));
  const watcherOptions = deptMembers.filter(m => m.id !== userId && !approverIds.includes(m.id));
  // Người có thể được @mention trong bình luận đề xuất: cùng phòng ban + TGĐ/Kế toán, loại bỏ chính mình.
  const mentionables = deptMembers.filter(m => m.id !== userId);

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
    if (!newComment.trim() && commentFiles.length === 0) return;
    setUploading(true);
    const uploadedFiles = [];
    for (const f of commentFiles) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = 'comments/' + pid + '/' + Date.now() + '_' + safeName;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        uploadedFiles.push({ name: f.name, url: publicUrl, type: f.type, size: f.size });
      }
    }
    const contentText = newComment.trim();
    await supabase.from('comments').insert({ proposal_id: pid, user_id: userId, content: contentText, files: uploadedFiles.length > 0 ? uploadedFiles : null });

    // Gửi thông báo cho những người được @mention trong bình luận đề xuất
    try {
      const proposal = proposals.find(p => p.id === pid);
      const pTitle = proposal?.title || '';
      const uniqueIds = Array.from(new Set(mentionedIds));
      for (const mid of uniqueIds) {
        const m = members.find(x => x.id === mid);
        if (!m) continue;
        if (!contentText.includes('@' + m.name)) continue;
        if (mid === userId) continue;
        await supabase.from('notifications').insert({
          user_id: mid,
          type: 'mention',
          title: 'Bạn được nhắc đến',
          message: `${userName || 'Ai đó'} đã nhắc bạn trong đề xuất "${pTitle}"`,
          proposal_id: pid,
        });
        sendPush(mid, 'Bạn được nhắc đến', `${userName || 'Ai đó'} nhắc bạn trong đề xuất "${pTitle}"`, { url: '/dashboard', tag: 'mention-p-' + pid });
      }
    } catch (e) { /* ignore notification errors */ }

    setNewComment(''); setCommentFiles([]); setMentionedIds([]); setUploading(false); loadComments(pid);
  }

  function handleCostChange(e) {
    const raw = parseVND(e.target.value);
    setCostDisplay(formatVND(raw));
  }

  function handleAddFile(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }
  function removeFile(index) { setFiles(prev => prev.filter((_, i) => i !== index)); }

  function handleAddCommentFile(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length > 0) setCommentFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }
  function removeCommentFile(index) { setCommentFiles(prev => prev.filter((_, i) => i !== index)); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast('Nhập tiêu đề', 'error');
    if (approverIds.length === 0) return toast('Chọn người duyệt', 'error');
    if (department === 'nail' && createBranchOptions.length > 0 && !createBranch) {
      return toast('Chọn chi nhánh cho đề xuất', 'error');
    }
    setSubmitting(true);
    const tabLabel = MAIN_TABS.find(t => t.id === activeTab)?.label || 'Mua hàng';
    const catName = catId ? (categories.find(c => c.id === catId)?.name || tabLabel) : tabLabel;
    const costRaw = parseVND(costDisplay);
    const { data: p, error } = await supabase.from('proposals').insert({
      title: title.trim(), description: desc.trim(), category_id: catId || null,
      category_name: catName, estimated_cost: costRaw ? parseInt(costRaw) : null,
      department, branch: department === 'nail' ? (createBranch || null) : null, created_by: userId
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
    setTitle(''); setDesc(''); setCostDisplay(''); setApproverIds([]); setWatcherIds([]); setFiles([]); setCatId('');
    setShowForm(false); setSubmitting(false); fetchAll();
  }

  async function handleDeleteProposal(pid, pTitle) {
    if (!isDirector) return;
    const ok = typeof window !== 'undefined' && window.confirm(
      `⚠ XOÁ VĨNH VIỄN đề xuất này?\n\n"${pTitle}"\n\nSẽ xoá cả: người duyệt, người theo dõi, file đính kèm, bình luận. KHÔNG thể khôi phục.`
    );
    if (!ok) return;
    const { error } = await deleteProposalCascade(pid);
    if (error) { toast('Lỗi: ' + error.message, 'error'); return; }
    toast('Đã xoá đề xuất', 'success');
    fetchAll();
  }

  async function handleApprove(pid, uid, action) {
    await supabase.from('proposal_approvers').update({ status: action, decided_at: new Date().toISOString() }).eq('proposal_id', pid).eq('user_id', uid);
    const { data: all } = await supabase.from('proposal_approvers').select('status').eq('proposal_id', pid);
    const done = all?.every(a => a.status !== 'pending');
    const approved = all?.every(a => a.status === 'approved');
    if (done) await supabase.from('proposals').update({ status: approved ? 'approved' : 'rejected', updated_at: new Date().toISOString() }).eq('id', pid);
    else await supabase.from('proposals').update({ status: 'partial', updated_at: new Date().toISOString() }).eq('id', pid);
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

  // Visibility rule theo chi nhánh + vai trò.
  // - TGĐ & Kế toán: toàn bộ (đã lọc theo dept & branch ở query).
  // - Quản lý (admin): toàn bộ đề xuất trong chi nhánh mình phụ trách.
  // - Nhân viên (member): chỉ đề xuất liên quan (creator, approver, watcher).
  const canViewAll = isDirector || isAccountant;
  // Lọc theo chi nhánh đang xem (nếu có branch prop) hoặc các chi nhánh được phép.
  let branchScoped = proposals;
  if (department === 'nail') {
    if (branch) {
      branchScoped = proposals.filter(p => p.branch === branch);
    } else if (!canViewAll) {
      const allowed = Array.isArray(allowedBranches) ? allowedBranches : [];
      if (allowed.length > 0) branchScoped = proposals.filter(p => p.branch && allowed.includes(p.branch));
    }
  }
  const visibleProposals = (canViewAll || profile?.role === 'admin')
    ? branchScoped
    : branchScoped.filter(p =>
        p.created_by === userId
        || (p.approvers || []).some(a => a.user_id === userId)
        || (p.watchers || []).some(w => w.user_id === userId)
      );

  const tabProposals = visibleProposals.filter(p => {
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
                ({visibleProposals.filter(p => t.id === 'thanh_toan' ? p.category_name === 'Thanh toán' : p.category_name !== 'Thanh toán').length})
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
          <p className="text-[11px] text-gray-400 mb-4">Đề xuất sẽ được lưu vào tab &quot;{tabLabel}&quot;</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            {department === 'nail' && createBranchOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chi nhánh *</label>
                {createBranchOptions.length === 1 ? (
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">{branchLabel(createBranchOptions[0])}</div>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {createBranchOptions.map(bid => (
                      <button key={bid} type="button" onClick={() => setCreateBranch(bid)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${createBranch === bid ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
                        {branchLabel(bid)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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

            {/* Cost input with auto-formatting */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chi phí dự kiến (VNĐ)</label>
              <div className="relative">
                <input className="input-field !text-sm !pr-12" type="text" inputMode="numeric" value={costDisplay} onChange={handleCostChange} placeholder="VD: 1.022.000" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">VNĐ</span>
              </div>
              {costDisplay && <p className="text-[10px] text-emerald-600 mt-0.5">{costDisplay} VNĐ</p>}
            </div>

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

            {/* File upload - each file on its own line */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Đính kèm file</label>
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
                    {p.branch && <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 font-semibold">{branchLabel(p.branch)}</span>}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.creator?.name} · {fmtDT(p.created_at)} {p.estimated_cost ? ` · ${fmtCost(p.estimated_cost)}` : ''}</p>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform mt-1 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {isExp && (
                <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
                  {isDirector && (
                    <div className="flex justify-end mb-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProposal(p.id, p.title); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        title="Xoá vĩnh viễn (chỉ TGĐ)">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                        Xoá đề xuất
                      </button>
                    </div>
                  )}
                  {p.description && <p className="text-xs text-gray-600 mb-2 leading-relaxed">{p.description}</p>}
                  {p.estimated_cost && <p className="text-xs mb-2">Chi phí: <strong>{fmtCost(p.estimated_cost)}</strong></p>}
                  {p.files?.length > 0 && (<div className="mb-3"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">File đính kèm ({p.files.length})</p><div className="space-y-1">{p.files.map(f => <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"><span className="text-sm flex-shrink-0">{getFileIcon(f.file_name)}</span><span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">{f.file_name}</span><span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.file_size)}</span><svg className="w-3 h-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>)}</div></div>)}
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
                    {comments[p.id]?.map(c => (<div key={c.id} className="flex gap-2 mb-2"><div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: c.user?.avatar_color, color: '#333' }}>{ini(c.user?.name)}</div><div className="flex-1 min-w-0"><p className="text-[10px]"><strong>{c.user?.name}</strong> · {timeAgo(c.created_at)}</p>{c.content && <p className="text-xs text-gray-600">{renderMentions(c.content, mentionables)}</p>}{c.files && c.files.length > 0 && <div className="space-y-1 mt-1">{c.files.map((f, fi) => <a key={fi} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 group"><span className="text-sm">{getFileIcon(f.name)}</span><span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">{f.name}</span><span className="text-[9px] text-gray-400">{formatFileSize(f.size)}</span></a>)}</div>}</div></div>))}
                    <div className="space-y-1.5 mt-1.5">
                      <div className="flex gap-2">
                        <MentionInput
                          value={isExp ? newComment : ''}
                          setValue={setNewComment}
                          onSend={() => addComment(p.id)}
                          mentionables={mentionables}
                          onMention={(uid) => setMentionedIds(prev => prev.includes(uid) ? prev : [...prev, uid])}
                          ini={ini}
                        />
                        <label className="flex items-center px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-500" title="Đính kèm file">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          <input type="file" multiple className="hidden" onChange={handleAddCommentFile} />
                        </label>
                        <button onClick={() => addComment(p.id)} disabled={uploading} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#2D5A3D' }}>{uploading ? '...' : 'Gửi'}</button>
                      </div>
                      {commentFiles.length > 0 && (
                        <div className="space-y-1">
                          {commentFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-50 text-xs text-blue-700">
                              <span>{getFileIcon(f.name)}</span>
                              <span className="truncate flex-1">{f.name}</span>
                              <span className="text-[9px] text-blue-400">{formatFileSize(f.size)}</span>
                              <button onClick={() => removeCommentFile(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
