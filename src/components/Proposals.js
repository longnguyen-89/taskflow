import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { sendPush } from '@/lib/notify';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';
import { deleteProposalCascade } from '@/lib/deletions';
import { logActivity, ACTIONS } from '@/lib/activityLog';

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
        placeholder={placeholder || 'BÃ¬nh luáº­n... (gÃµ @ Ä‘á»ƒ nháº¯c tÃªn)'}
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
                  {m.role === 'director' ? 'Tá»•ng GiÃ¡m Ä‘á»‘c' : m.role === 'accountant' ? 'Káº¿ toÃ¡n' : (m.position || '')}
                  {m.department ? ` Â· ${m.department === 'hotel' ? 'Hotel' : 'Nail'}` : ''}
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

function formatVND(val) {
  const num = String(val).replace(/\D/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('de-DE');
}

function parseVND(str) {
  return str.replace(/\./g, '').replace(/\D/g, '');
}

const MAIN_TABS = [
  { id: 'mua_hang', label: 'Mua hÃ ng' },
  { id: 'thanh_toan', label: 'Thanh toÃ¡n' },
];

export default function Proposals({ userId, userName, members, department, branch, allowedBranches, canViewAll: canViewAllProp, profile, isDirector, isAccountant, canApprove, focusProposalId, clearFocus }) {
  // Chi nhÃ¡nh Ä‘Æ°á»£c chá»n khi táº¡o Ä‘á» xuáº¥t má»›i. Máº·c Ä‘á»‹nh = chi nhÃ¡nh Ä‘ang xem,
  // hoáº·c chi nhÃ¡nh duy nháº¥t cá»§a user náº¿u chá»‰ cÃ³ 1.
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
  // Báº£ng chi tiáº¿t máº·t hÃ ng (cáº£ Mua hÃ ng + Thanh toÃ¡n). KhÃ´ng báº¯t buá»™c.
  // Má»—i dÃ²ng: { name, unit, quantity, unit_price, note, files: [{name,url,type,size}] }.
  // Tá»•ng giÃ¡ = quantity * unit_price (tÃ­nh runtime). Files: upload Supabase storage, lÆ°u URL.
  const [items, setItems] = useState([{ name: '', unit: '', quantity: '', unit_price: '', note: '', files: [] }]);
  // Track index cÃ¡c dÃ²ng Ä‘ang upload file Ä‘á»ƒ disable button.
  const [uploadingItemIdx, setUploadingItemIdx] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [mentionedIds, setMentionedIds] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  // Chi nhÃ¡nh user Ä‘Æ°á»£c phÃ©p táº¡o Ä‘á» xuáº¥t cho (TGÄ/KT: 4 cn, admin: cn phá»¥ trÃ¡ch, member: 1 cn).
  const createBranchOptions = (department === 'nail')
    ? (canViewAllProp ? NAIL_BRANCHES.map(b => b.id) : (Array.isArray(profile?.branches) ? profile.branches : []))
    : [];

  const deptMembers = members.filter(m => m.department === department || m.role === 'director' || m.role === 'accountant');
  const approvers = deptMembers.filter(m => m.id !== userId && (m.role === 'director' || m.role === 'accountant'));
  const watcherOptions = deptMembers.filter(m => m.id !== userId && !approverIds.includes(m.id));
  // NgÆ°á»i cÃ³ thá»ƒ Ä‘Æ°á»£c @mention trong bÃ¬nh luáº­n Ä‘á» xuáº¥t: cÃ¹ng phÃ²ng ban + TGÄ/Káº¿ toÃ¡n, loáº¡i bá» chÃ­nh mÃ¬nh.
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

    // Gá»­i thÃ´ng bÃ¡o cho nhá»¯ng ngÆ°á»i Ä‘Æ°á»£c @mention trong bÃ¬nh luáº­n Ä‘á» xuáº¥t
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
          title: 'Báº¡n Ä‘Æ°á»£c nháº¯c Ä‘áº¿n',
          message: `${userName || 'Ai Ä‘Ã³'} Ä‘Ã£ nháº¯c báº¡n trong Ä‘á» xuáº¥t "${pTitle}"`,
          proposal_id: pid,
        });
        sendPush(mid, 'Báº¡n Ä‘Æ°á»£c nháº¯c Ä‘áº¿n', `${userName || 'Ai Ä‘Ã³'} nháº¯c báº¡n trong Ä‘á» xuáº¥t "${pTitle}"`, { url: '/dashboard', tag: 'mention-p-' + pid });
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

  // ================= ITEMS (báº£ng chi tiáº¿t máº·t hÃ ng) =================
  const EMPTY_ITEM = { name: '', unit: '', quantity: '', unit_price: '', note: '', files: [] };
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM, files: [] }]); }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }
  // Parse number tá»« chuá»—i "1.234.567" hoáº·c "1234567" hoáº·c "1,5" â†’ number.
  function parseNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const s = String(v).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  function itemTotal(it) { return parseNum(it.quantity) * parseNum(it.unit_price); }
  function itemsGrandTotal(list) { return (list || []).reduce((s, it) => s + itemTotal(it), 0); }

  // Upload nhiá»u file cho 1 dÃ²ng item. LÆ°u URL vÃ o item.files.
  async function handleItemFileUpload(itemIdx, e) {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    if (chosen.length === 0) return;
    setUploadingItemIdx(itemIdx);
    const newFiles = [];
    for (const f of chosen) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = `proposals/items/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from('attachments').upload(path, f);
      if (error) { toast('Lá»—i upload ' + f.name + ': ' + error.message, 'error'); continue; }
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
      newFiles.push({ name: f.name, url: publicUrl, type: f.type, size: f.size });
    }
    if (newFiles.length > 0) {
      setItems(prev => prev.map((it, i) => i === itemIdx
        ? { ...it, files: [...(it.files || []), ...newFiles] }
        : it));
      toast(`ÄÃ£ Ä‘Ã­nh kÃ¨m ${newFiles.length} file cho dÃ²ng #${itemIdx + 1}`, 'success');
    }
    setUploadingItemIdx(null);
  }
  function removeItemFile(itemIdx, fileIdx) {
    setItems(prev => prev.map((it, i) => i === itemIdx
      ? { ...it, files: (it.files || []).filter((_, fi) => fi !== fileIdx) }
      : it));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast('Nháº­p tiÃªu Ä‘á»', 'error');
    if (approverIds.length === 0) return toast('Chá»n ngÆ°á»i duyá»‡t', 'error');
    if (department === 'nail' && createBranchOptions.length > 0 && !createBranch) {
      return toast('Chá»n chi nhÃ¡nh cho Ä‘á» xuáº¥t', 'error');
    }
    setSubmitting(true);
    const tabLabel = MAIN_TABS.find(t => t.id === activeTab)?.label || 'Mua hÃ ng';
    const catName = catId ? (categories.find(c => c.id === catId)?.name || tabLabel) : tabLabel;
    const costRaw = parseVND(costDisplay);
    // LÃ m sáº¡ch items: chá»‰ giá»¯ dÃ²ng cÃ³ tÃªn máº·t hÃ ng, parse sá»‘ tá»« chuá»—i format VND.
    const cleanItems = items
      .filter(it => it.name && it.name.trim())
      .map(it => ({
        name: it.name.trim(),
        unit: (it.unit || '').trim(),
        quantity: parseNum(it.quantity),
        unit_price: parseNum(it.unit_price),
        note: (it.note || '').trim(),
        files: Array.isArray(it.files) ? it.files : [],
      }));
    const { data: p, error } = await supabase.from('proposals').insert({
      title: title.trim(), description: desc.trim(), category_id: catId || null,
      category_name: catName, estimated_cost: costRaw ? parseInt(costRaw) : null,
      department, branch: department === 'nail' ? (createBranch || null) : null, created_by: userId,
      items: cleanItems,
    }).select().single();
    if (error) { toast('Lá»—i: ' + error.message, 'error'); setSubmitting(false); return; }
    for (const aid of approverIds) {
      await supabase.from('proposal_approvers').insert({ proposal_id: p.id, user_id: aid });
      await supabase.from('notifications').insert({ user_id: aid, type: 'approval_request', title: 'Äá» xuáº¥t cáº§n duyá»‡t', message: `${userName}: "${title}"`, proposal_id: p.id });
      sendPush(aid, 'ðŸ“ Äá» xuáº¥t cáº§n duyá»‡t', `${userName}: "${title}"`, { url: '/dashboard', tag: 'proposal-' + p.id });
    }
    for (const wid of watcherIds) {
      await supabase.from('proposal_watchers').insert({ proposal_id: p.id, user_id: wid });
      await supabase.from('notifications').insert({ user_id: wid, type: 'info', title: 'Äá» xuáº¥t Ä‘á»ƒ theo dÃµi', message: `${userName}: "${title}"`, proposal_id: p.id });
      sendPush(wid, 'ðŸ‘ Äá» xuáº¥t theo dÃµi', `${userName}: "${title}"`, { url: '/dashboard', tag: 'proposal-w-' + p.id });
    }
    for (const f of files) {
      const path = `proposals/${p.id}/${Date.now()}_${f.name}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (!ue) {
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
        await supabase.from('proposal_files').insert({ proposal_id: p.id, file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size, uploaded_by: userId });
      }
    }
    logActivity({ userId, userName, action: ACTIONS.PROPOSAL_CREATED, targetType: 'proposal', targetId: p.id, targetTitle: title.trim(), details: { category: catName, cost: costRaw ? parseInt(costRaw) : null }, department, branch: department === 'nail' ? (createBranch || null) : null });
    toast('ÄÃ£ gá»­i Ä‘á» xuáº¥t!', 'success');
    setTitle(''); setDesc(''); setCostDisplay(''); setApproverIds([]); setWatcherIds([]); setFiles([]); setCatId('');
    setItems([{ ...EMPTY_ITEM }]);
    setShowForm(false); setSubmitting(false); fetchAll();
  }

  async function handleDeleteProposal(pid, pTitle) {
    if (!isDirector) return;
    const ok = typeof window !== 'undefined' && window.confirm(
      `âš  XOÃ VÄ¨NH VIá»„N Ä‘á» xuáº¥t nÃ y?\n\n"${pTitle}"\n\nSáº½ xoÃ¡ cáº£: ngÆ°á»i duyá»‡t, ngÆ°á»i theo dÃµi, file Ä‘Ã­nh kÃ¨m, bÃ¬nh luáº­n. KHÃ”NG thá»ƒ khÃ´i phá»¥c.`
    );
    if (!ok) return;
    const { error } = await deleteProposalCascade(pid, userId);
    if (error) { toast('Lá»—i: ' + error.message, 'error'); return; }
    toast('ÄÃ£ xoÃ¡ Ä‘á» xuáº¥t', 'success');
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
      const statusText = action === 'approved' ? 'âœ… Ä‘Ã£ duyá»‡t' : 'âŒ Ä‘Ã£ tá»« chá»‘i';
      sendPush(proposal.created_by, `Äá» xuáº¥t ${statusText}`, `${approverName} ${statusText}: "${proposal.title}"`, { url: '/dashboard', tag: 'approval-' + pid });
      await supabase.from('notifications').insert({ user_id: proposal.created_by, type: action === 'approved' ? 'approved' : 'rejected', title: `Äá» xuáº¥t ${statusText}`, message: `${approverName} ${statusText}: "${proposal.title}"`, proposal_id: pid });
    }
    const pObj = proposals.find(pr => pr.id === pid);
    logActivity({ userId: uid, userName: members.find(m => m.id === uid)?.name, action: action === 'approved' ? ACTIONS.PROPOSAL_APPROVED : ACTIONS.PROPOSAL_REJECTED, targetType: 'proposal', targetId: pid, targetTitle: pObj?.title, department: pObj?.department });
    toast(action === 'approved' ? 'ÄÃ£ duyá»‡t!' : 'ÄÃ£ tá»« chá»‘i', 'success'); fetchAll();
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const fmtCost = c => c ? new Intl.NumberFormat('vi-VN').format(c) + 'Ä‘' : '';
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const timeAgo = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 60) return `${m}p`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; };
  const STS = { pending: { l: 'Chá» duyá»‡t', c: '#d97706' }, partial: { l: 'Äang duyá»‡t', c: '#2563eb' }, approved: { l: 'ÄÃ£ duyá»‡t', c: '#16a34a' }, rejected: { l: 'Tá»« chá»‘i', c: '#dc2626' } };

  const tabLabel = MAIN_TABS.find(t => t.id === activeTab)?.label;

  // Visibility rule theo chi nhÃ¡nh + vai trÃ².
  // - TGÄ & Káº¿ toÃ¡n: toÃ n bá»™ (Ä‘Ã£ lá»c theo dept & branch á»Ÿ query).
  // - Quáº£n lÃ½ (admin): toÃ n bá»™ Ä‘á» xuáº¥t trong chi nhÃ¡nh mÃ¬nh phá»¥ trÃ¡ch.
  // - NhÃ¢n viÃªn (member): chá»‰ Ä‘á» xuáº¥t liÃªn quan (creator, approver, watcher).
  const canViewAll = isDirector || isAccountant;
  // Lá»c theo chi nhÃ¡nh Ä‘ang xem (náº¿u cÃ³ branch prop) hoáº·c cÃ¡c chi nhÃ¡nh Ä‘Æ°á»£c phÃ©p.
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
    if (activeTab === 'thanh_toan') return p.category_name === 'Thanh toÃ¡n';
    return p.category_name !== 'Thanh toÃ¡n';
  });
  const filteredProposals = filterCat === 'all' ? tabProposals : tabProposals.filter(p => p.category_name === filterCat);
  const subCatCounts = {};
  tabProposals.forEach(p => { subCatCounts[p.category_name] = (subCatCounts[p.category_name] || 0) + 1; });

  // Auto expand + scroll khi má»Ÿ Ä‘á» xuáº¥t tá»« notification.
  useEffect(() => {
    if (!focusProposalId) return;
    const target = proposals.find(p => p.id === focusProposalId);
    if (!target) return;
    // Chuyá»ƒn Ä‘Ãºng main tab (mua hÃ ng / thanh toÃ¡n) Ä‘á»ƒ Ä‘á» xuáº¥t hiá»ƒn thá»‹.
    if (target.category_name === 'Thanh toÃ¡n') {
      if (activeTab !== 'thanh_toan') setActiveTab('thanh_toan');
    } else {
      if (activeTab !== 'mua_hang') setActiveTab('mua_hang');
    }
    // Reset filter category Ä‘á»ƒ cháº¯c cháº¯n render.
    if (filterCat !== 'all' && target.category_name !== filterCat) setFilterCat('all');
    setExpanded(focusProposalId);
    if (!comments[focusProposalId]) loadComments(focusProposalId);
    const to = setTimeout(() => {
      const el = document.getElementById('proposal-row-' + focusProposalId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 2500);
      }
      if (clearFocus) clearFocus();
    }, 300);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProposalId, proposals]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: '#F3EFE4' }}>
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setFilterCat('all'); }}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {t.label}
              <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                ({visibleProposals.filter(p => t.id === 'thanh_toan' ? p.category_name === 'Thanh toÃ¡n' : p.category_name !== 'Thanh toÃ¡n').length})
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#123524' }}>+ Táº¡o Ä‘á» xuáº¥t</button>
      </div>

      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {Object.keys(subCatCounts).length > 1 && (
          <>
            <button onClick={() => setFilterCat('all')} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterCat === 'all' ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterCat === 'all' ? { background: '#123524' } : {}}>Táº¥t cáº£ ({tabProposals.length})</button>
            {Object.entries(subCatCounts).map(([name, count]) => (
              <button key={name} onClick={() => setFilterCat(name)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterCat === name ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterCat === name ? { background: '#123524' } : {}}>{name} ({count})</button>
            ))}
            <span className="text-gray-300">|</span>
          </>
        )}
        <span className="text-[11px] text-gray-500">Thá»i gian:</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-gray-400">â†’</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:underline">XÃ³a</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-5 animate-slide-up">
          <h3 className="font-semibold text-sm mb-1">Táº¡o Ä‘á» xuáº¥t â€” {tabLabel}</h3>
          <p className="text-[11px] text-gray-400 mb-4">Äá» xuáº¥t sáº½ Ä‘Æ°á»£c lÆ°u vÃ o tab &quot;{tabLabel}&quot;</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            {department === 'nail' && createBranchOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chi nhÃ¡nh *</label>
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
              <div><label className="block text-xs font-medium text-gray-600 mb-1">TiÃªu Ä‘á» *</label><input className="input-field !text-sm" value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">PhÃ¢n loáº¡i chi tiáº¿t</label>
                <select className="input-field !text-sm" value={catId} onChange={e => setCatId(e.target.value)}>
                  <option value="">â€” {tabLabel} (máº·c Ä‘á»‹nh) â€”</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">MÃ´ táº£ chi tiáº¿t</label><textarea className="input-field !text-sm min-h-[70px] resize-y" value={desc} onChange={e => setDesc(e.target.value)} /></div>

            {/* Cost input with auto-formatting */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chi phÃ­ dá»± kiáº¿n (VNÄ)</label>
              <div className="relative">
                <input className="input-field !text-sm !pr-12" type="text" inputMode="numeric" value={costDisplay} onChange={handleCostChange} placeholder="VD: 1.022.000" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">VNÄ</span>
              </div>
              {costDisplay && <p className="text-[10px] text-emerald-600 mt-0.5">{costDisplay} VNÄ</p>}
            </div>

            {/* =================== CHI TIáº¾T Máº¶T HÃ€NG (items) =================== */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Chi tiáº¿t <span className="text-gray-400 font-normal">(tÃ¹y chá»n â€” liá»‡t kÃª tá»«ng máº·t hÃ ng / khoáº£n chi)</span>
              </label>

              {/* Desktop: table layout */}
              <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[40px_minmax(160px,2fr)_80px_80px_130px_130px_minmax(140px,1.5fr)_40px] gap-1.5 px-2 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <div className="text-center">#</div>
                  <div>TÃªn máº·t hÃ ng</div>
                  <div>ÄVT</div>
                  <div className="text-right">Sá»‘ lÆ°á»£ng</div>
                  <div className="text-right">ÄÆ¡n giÃ¡</div>
                  <div className="text-right">Tá»•ng giÃ¡</div>
                  <div>Ghi chÃº</div>
                  <div></div>
                </div>
                {items.map((it, idx) => {
                  const itFiles = Array.isArray(it.files) ? it.files : [];
                  return (
                  <div key={idx} className="border-b border-gray-100 last:border-b-0">
                    <div className="grid grid-cols-[40px_minmax(160px,2fr)_80px_80px_130px_130px_minmax(140px,1.5fr)_40px] gap-1.5 px-2 py-1.5 items-center">
                      <div className="text-center text-xs text-gray-500 font-semibold">{idx + 1}</div>
                      <input className="input-field !text-xs !py-1.5" placeholder="VD: NÆ°á»›c rá»­a tay" value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                      <input className="input-field !text-xs !py-1.5" placeholder="chai" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                      <input className="input-field !text-xs !py-1.5 text-right" inputMode="decimal" placeholder="0" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      <input className="input-field !text-xs !py-1.5 text-right" inputMode="numeric" placeholder="0" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', formatVND(e.target.value))} />
                      <div className="px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs text-right font-semibold truncate" title={itemTotal(it).toLocaleString('de-DE') + 'Ä‘'}>
                        {itemTotal(it) > 0 ? itemTotal(it).toLocaleString('de-DE') + 'Ä‘' : 'â€”'}
                      </div>
                      <input className="input-field !text-xs !py-1.5" placeholder="Ghi chÃº..." value={it.note} onChange={e => updateItem(idx, 'note', e.target.value)} />
                      <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                        title="XÃ³a dÃ²ng">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                      </button>
                    </div>
                    {/* File attachments per item - row phá»¥ náº±m dÆ°á»›i row chÃ­nh */}
                    <div className="px-2 pb-2 pl-[52px] flex flex-wrap items-center gap-1.5">
                      {itFiles.map((f, fi) => (
                        <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[10px] text-blue-700 max-w-[200px]">
                          <span className="flex-shrink-0">{getFileIcon(f.name)}</span>
                          <span className="truncate" title={f.name}>{f.name}</span>
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeItemFile(idx, fi); }}
                            className="flex-shrink-0 text-red-400 hover:text-red-600 ml-0.5" title="XÃ³a file">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </a>
                      ))}
                      <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-[10px] text-gray-500 ${uploadingItemIdx === idx ? 'opacity-50 pointer-events-none' : ''}`}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        {uploadingItemIdx === idx ? 'Äang táº£i...' : (itFiles.length > 0 ? 'ThÃªm file' : 'ÄÃ­nh kÃ¨m file')}
                        <input type="file" multiple className="hidden" onChange={(e) => handleItemFileUpload(idx, e)} />
                      </label>
                    </div>
                  </div>
                  );
                })}
                {/* Tá»•ng cá»™ng hÃ ng cuá»‘i */}
                {items.some(it => it.name && it.name.trim()) && (
                  <div className="grid grid-cols-[40px_minmax(160px,2fr)_80px_80px_130px_130px_minmax(140px,1.5fr)_40px] gap-1.5 px-2 py-2 bg-emerald-50/50 border-t-2 border-emerald-200 text-xs font-bold">
                    <div></div>
                    <div className="col-span-4 text-right text-gray-700">Tá»•ng cá»™ng:</div>
                    <div className="text-right text-emerald-700">{itemsGrandTotal(items).toLocaleString('de-DE')}Ä‘</div>
                    <div></div>
                    <div></div>
                  </div>
                )}
              </div>

              {/* Mobile: stack card layout */}
              <div className="md:hidden space-y-2">
                {items.map((it, idx) => {
                  const itFiles = Array.isArray(it.files) ? it.files : [];
                  return (
                  <div key={idx} className="border border-gray-200 rounded-xl p-2.5 bg-gray-50/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">DÃ²ng #{idx + 1}</span>
                      <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1}
                        className="text-red-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed" title="XÃ³a dÃ²ng">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <input className="input-field !text-xs !py-1.5" placeholder="TÃªn máº·t hÃ ng *" value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input className="input-field !text-xs !py-1.5" placeholder="ÄVT (chai, cÃ¡i...)" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                        <input className="input-field !text-xs !py-1.5 text-right" inputMode="decimal" placeholder="Sá»‘ lÆ°á»£ng" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      </div>
                      <input className="input-field !text-xs !py-1.5 text-right" inputMode="numeric" placeholder="ÄÆ¡n giÃ¡" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', formatVND(e.target.value))} />
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 text-xs">
                        <span className="text-gray-500">Tá»•ng giÃ¡:</span>
                        <span className="font-semibold text-emerald-700">{itemTotal(it) > 0 ? itemTotal(it).toLocaleString('de-DE') + 'Ä‘' : 'â€”'}</span>
                      </div>
                      <input className="input-field !text-xs !py-1.5" placeholder="Ghi chÃº..." value={it.note} onChange={e => updateItem(idx, 'note', e.target.value)} />
                      {/* File attachments per item - mobile */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {itFiles.map((f, fi) => (
                          <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[10px] text-blue-700 max-w-[180px]">
                            <span className="flex-shrink-0">{getFileIcon(f.name)}</span>
                            <span className="truncate" title={f.name}>{f.name}</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeItemFile(idx, fi); }}
                              className="flex-shrink-0 text-red-400 hover:text-red-600 ml-0.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </a>
                        ))}
                        <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer text-[10px] text-gray-500 ${uploadingItemIdx === idx ? 'opacity-50 pointer-events-none' : ''}`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          {uploadingItemIdx === idx ? 'Äang táº£i...' : (itFiles.length > 0 ? 'ThÃªm file' : 'ÄÃ­nh kÃ¨m file')}
                          <input type="file" multiple className="hidden" onChange={(e) => handleItemFileUpload(idx, e)} />
                        </label>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {items.some(it => it.name && it.name.trim()) && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                    <span className="text-xs font-bold text-gray-700">Tá»•ng cá»™ng:</span>
                    <span className="text-sm font-bold text-emerald-700">{itemsGrandTotal(items).toLocaleString('de-DE')}Ä‘</span>
                  </div>
                )}
              </div>

              <button type="button" onClick={addItem}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                style={{ color: '#123524' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                ThÃªm dÃ²ng má»›i
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">NgÆ°á»i duyá»‡t * <span className="text-gray-400">(TGÄ / Káº¿ toÃ¡n)</span></label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {approvers.length === 0 ? <p className="p-3 text-xs text-gray-400">ChÆ°a cÃ³ TGÄ hoáº·c Káº¿ toÃ¡n</p> : approvers.map(m => (
                  <div key={m.id} onClick={() => setApproverIds(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 last:border-b-0 transition-all ${approverIds.includes(m.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${approverIds.includes(m.id) ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'}`}>
                      {approverIds.includes(m.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: m.avatar_color, color: '#333' }}>{ini(m.name)}</div>
                    <div className="flex-1"><p className="text-xs font-medium">{m.name}</p><p className="text-[10px] text-gray-400">{m.role === 'director' ? 'Tá»•ng GiÃ¡m Ä‘á»‘c' : 'Káº¿ toÃ¡n'}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">NgÆ°á»i theo dÃµi <span className="text-gray-400">(chá»n nhiá»u)</span></label>
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
              {watcherIds.length > 0 && <p className="text-[10px] text-blue-600 mt-1">{watcherIds.length} ngÆ°á»i Ä‘Ã£ chá»n</p>}
            </div>

            {/* File upload - each file on its own line */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ÄÃ­nh kÃ¨m file</label>
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

            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>{submitting ? 'Äang gá»­i...' : 'Gá»­i Ä‘á» xuáº¥t'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary !text-xs">Há»§y</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-5">
        {(() => {
          // NhÃ³m theo ngÃ y táº¡o (VN) â€” dá»… quan sÃ¡t "ngÃ y hÃ´m nay, hÃ´m qua, ..."
          const byDay = {};
          for (const p of filteredProposals) {
            const key = (() => {
              const d = new Date(p.created_at);
              const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
              return vn.toISOString().slice(0, 10);
            })();
            if (!byDay[key]) byDay[key] = [];
            byDay[key].push(p);
          }
          const todayKey = (() => {
            const d = new Date();
            const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
            return vn.toISOString().slice(0, 10);
          })();
          const yesterdayKey = (() => {
            const d = new Date();
            d.setUTCDate(d.getUTCDate() - 1);
            const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
            return vn.toISOString().slice(0, 10);
          })();
          function dayLabel(k) {
            if (k === todayKey) return 'HÃ´m nay';
            if (k === yesterdayKey) return 'HÃ´m qua';
            const dt = new Date(k + 'T12:00:00Z');
            const w = ['CN','T2','T3','T4','T5','T6','T7'][dt.getUTCDay()];
            return `${w}, ${dt.toLocaleDateString('vi-VN')}`;
          }
          const sortedKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
          return sortedKeys.map(dayKey => (
            <div key={'day-' + dayKey}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5 text-gray-500">{dayLabel(dayKey)} <span className="text-gray-400 font-semibold">({byDay[dayKey].length})</span></p>
              <div className="space-y-2">
                {byDay[dayKey].map(p => {
                  const sc = STS[p.status]; const isExp = expanded === p.id;
                  return (
            <div key={p.id} id={'proposal-row-' + p.id} className="card p-4 transition-all">
              <div className="flex items-start gap-3 cursor-pointer" onClick={() => { setExpanded(isExp ? null : p.id); if (!isExp && !comments[p.id]) loadComments(p.id); }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ background: p.creator?.avatar_color, color: '#333' }}>{ini(p.creator?.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{p.title}</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: sc.c + '15', color: sc.c }}>{sc.l}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500">{p.category_name}</span>
                    {p.branch && <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 font-semibold">{branchLabel(p.branch)}</span>}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{p.creator?.name} Â· {fmtDT(p.created_at)} {p.estimated_cost ? ` Â· ${fmtCost(p.estimated_cost)}` : ''}</p>
                </div>
                <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform mt-1 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
              {isExp && (
                <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in">
                  {isDirector && (
                    <div className="flex justify-end mb-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteProposal(p.id, p.title); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                        title="XoÃ¡ vÄ©nh viá»…n (chá»‰ TGÄ)">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                        XoÃ¡ Ä‘á» xuáº¥t
                      </button>
                    </div>
                  )}
                  {p.description && <p className="text-xs text-gray-600 mb-2 leading-relaxed">{p.description}</p>}
                  {p.estimated_cost && <p className="text-xs mb-2">Chi phÃ­: <strong>{fmtCost(p.estimated_cost)}</strong></p>}

                  {/* Chi tiáº¿t máº·t hÃ ng (readonly) â€” chá»‰ hiá»‡n náº¿u cÃ³ items */}
                  {Array.isArray(p.items) && p.items.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Chi tiáº¿t ({p.items.length} máº·t hÃ ng)</p>
                      {/* Desktop table */}
                      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[32px_minmax(120px,2fr)_60px_60px_110px_110px_minmax(100px,1.5fr)] gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200 text-[9px] font-semibold text-gray-500 uppercase">
                          <div className="text-center">#</div>
                          <div>TÃªn</div>
                          <div>ÄVT</div>
                          <div className="text-right">SL</div>
                          <div className="text-right">ÄÆ¡n giÃ¡</div>
                          <div className="text-right">Tá»•ng</div>
                          <div>Ghi chÃº</div>
                        </div>
                        {p.items.map((it, idx) => {
                          const itFiles = Array.isArray(it.files) ? it.files : [];
                          return (
                          <div key={idx} className="border-b border-gray-100 last:border-b-0">
                            <div className="grid grid-cols-[32px_minmax(120px,2fr)_60px_60px_110px_110px_minmax(100px,1.5fr)] gap-1 px-2 py-1.5 text-[11px] items-center">
                              <div className="text-center text-gray-400">{idx + 1}</div>
                              <div className="font-medium text-gray-700 truncate" title={it.name}>{it.name}</div>
                              <div className="text-gray-500">{it.unit || 'â€”'}</div>
                              <div className="text-right text-gray-600">{Number(it.quantity || 0).toLocaleString('de-DE')}</div>
                              <div className="text-right text-gray-600">{Number(it.unit_price || 0).toLocaleString('de-DE')}Ä‘</div>
                              <div className="text-right font-semibold text-emerald-700">{itemTotal(it).toLocaleString('de-DE')}Ä‘</div>
                              <div className="text-gray-500 truncate" title={it.note}>{it.note || 'â€”'}</div>
                            </div>
                            {itFiles.length > 0 && (
                              <div className="px-2 pb-1.5 pl-[44px] flex flex-wrap items-center gap-1">
                                {itFiles.map((f, fi) => (
                                  <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[10px] text-blue-700 max-w-[200px]">
                                    <span className="flex-shrink-0">{getFileIcon(f.name)}</span>
                                    <span className="truncate" title={f.name}>{f.name}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}
                        <div className="grid grid-cols-[32px_minmax(120px,2fr)_60px_60px_110px_110px_minmax(100px,1.5fr)] gap-1 px-2 py-1.5 bg-emerald-50/60 border-t-2 border-emerald-200 text-xs font-bold">
                          <div></div>
                          <div className="col-span-4 text-right text-gray-700">Tá»•ng cá»™ng:</div>
                          <div className="text-right text-emerald-700">{itemsGrandTotal(p.items).toLocaleString('de-DE')}Ä‘</div>
                          <div></div>
                        </div>
                      </div>
                      {/* Mobile stack */}
                      <div className="md:hidden space-y-1.5">
                        {p.items.map((it, idx) => {
                          const itFiles = Array.isArray(it.files) ? it.files : [];
                          return (
                          <div key={idx} className="border border-gray-200 rounded-lg p-2 bg-white text-[11px]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] font-bold text-gray-400">#{idx + 1}</span>
                              <span className="font-semibold text-gray-800 flex-1 truncate">{it.name}</span>
                              <span className="font-bold text-emerald-700">{itemTotal(it).toLocaleString('de-DE')}Ä‘</span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                              <span>SL: <strong className="text-gray-700">{Number(it.quantity || 0).toLocaleString('de-DE')}</strong>{it.unit && ` ${it.unit}`}</span>
                              <span>ÄÆ¡n giÃ¡: <strong className="text-gray-700">{Number(it.unit_price || 0).toLocaleString('de-DE')}Ä‘</strong></span>
                            </div>
                            {it.note && <p className="text-[10px] text-gray-500 mt-0.5 italic">"{it.note}"</p>}
                            {itFiles.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 pt-1 border-t border-gray-100">
                                {itFiles.map((f, fi) => (
                                  <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[10px] text-blue-700 max-w-[160px]">
                                    <span className="flex-shrink-0">{getFileIcon(f.name)}</span>
                                    <span className="truncate" title={f.name}>{f.name}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 border-2 border-emerald-200">
                          <span className="text-[11px] font-bold text-gray-700">Tá»•ng cá»™ng:</span>
                          <span className="text-xs font-bold text-emerald-700">{itemsGrandTotal(p.items).toLocaleString('de-DE')}Ä‘</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {p.files?.length > 0 && (<div className="mb-3"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">File Ä‘Ã­nh kÃ¨m ({p.files.length})</p><div className="space-y-1">{p.files.map(f => <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"><span className="text-sm flex-shrink-0">{getFileIcon(f.file_name)}</span><span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">{f.file_name}</span><span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.file_size)}</span><svg className="w-3 h-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></a>)}</div></div>)}
                  <div className="mb-2"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">NgÆ°á»i duyá»‡t</p>
                    {p.approvers?.map(a => (
                      <div key={a.id} className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: a.user?.avatar_color, color: '#333' }}>{ini(a.user?.name)}</div>
                        <span className="text-xs flex-1">{a.user?.name}</span>
                        {a.status === 'approved' && <span className="text-[10px] text-green-600 font-semibold">âœ“ Duyá»‡t {a.decided_at ? fmtDT(a.decided_at) : ''}</span>}
                        {a.status === 'rejected' && <span className="text-[10px] text-red-600 font-semibold">âœ— Tá»« chá»‘i</span>}
                        {a.status === 'pending' && a.user_id === userId && canApprove && (
                          <div className="flex gap-1"><button onClick={() => handleApprove(p.id, userId, 'approved')} className="px-2 py-0.5 bg-green-600 text-white rounded text-[10px]">Duyá»‡t</button><button onClick={() => handleApprove(p.id, userId, 'rejected')} className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px]">Tá»« chá»‘i</button></div>
                        )}
                        {a.status === 'pending' && (a.user_id !== userId || !canApprove) && <span className="text-[10px] text-amber-600">Chá»...</span>}
                      </div>
                    ))}
                  </div>
                  {p.watchers?.length > 0 && (<div className="mb-2"><p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Theo dÃµi</p><div className="flex gap-1 flex-wrap">{p.watchers.map(w => <span key={w.id} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500">{w.user?.name}</span>)}</div></div>)}
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">BÃ¬nh luáº­n {comments[p.id]?.length > 0 && `(${comments[p.id].length})`}</p>
                    {comments[p.id]?.map(c => (<div key={c.id} className="flex gap-2 mb-2"><div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: c.user?.avatar_color, color: '#333' }}>{ini(c.user?.name)}</div><div className="flex-1 min-w-0"><p className="text-[10px]"><strong>{c.user?.name}</strong> Â· {timeAgo(c.created_at)}</p>{c.content && <p className="text-xs text-gray-600">{renderMentions(c.content, mentionables)}</p>}{c.files && c.files.length > 0 && <div className="space-y-1 mt-1">{c.files.map((f, fi) => <a key={fi} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 group"><span className="text-sm">{getFileIcon(f.name)}</span><span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">{f.name}</span><span className="text-[9px] text-gray-400">{formatFileSize(f.size)}</span></a>)}</div>}</div></div>))}
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
                        <label className="flex items-center px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-500" title="ÄÃ­nh kÃ¨m file">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          <input type="file" multiple className="hidden" onChange={handleAddCommentFile} />
                        </label>
                        <button onClick={() => addComment(p.id)} disabled={uploading} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>{uploading ? '...' : 'Gá»­i'}</button>
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
              </div>
            </div>
          ));
        })()}
        {filteredProposals.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">ChÆ°a cÃ³ Ä‘á» xuáº¥t nÃ o trong má»¥c nÃ y</div>}
      </div>
    </div>
  );
}
