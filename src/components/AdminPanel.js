import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/contexts/AuthContext';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';
import { ACTION_LABELS, ACTION_ICONS } from '@/lib/activityLog';
import PriceHistorySection from '@/components/PriceHistory';
import { BranchCompareSection, TrendChartSection, WorkHeatmapSection } from '@/components/Analytics';

const POSITIONS = ['Quáº£n lÃ½', 'Ká»¹ thuáº­t viÃªn', 'Lá»… tÃ¢n', 'Káº¿ toÃ¡n', 'Buá»“ng phÃ²ng', 'Báº£o vá»‡'];
const ROLES = [
  { v: 'director', l: 'Tá»•ng GiÃ¡m Ä‘á»‘c', d: 'ToÃ n quyá»n há»‡ thá»‘ng, quáº£n trá»‹, phÃ¢n quyá»n', c: '#123524' },
  { v: 'admin', l: 'Quáº£n lÃ½', d: 'Táº¡o task, xem Ä‘Ã¡nh giÃ¡, duyá»‡t Ä‘á» xuáº¥t, nháº­n task tá»« TGÄ', c: '#2563eb' },
  { v: 'accountant', l: 'Káº¿ toÃ¡n', d: 'Duyá»‡t Ä‘á» xuáº¥t, xem lá»‹ch sá»­ lá»‡nh, cáº£ 2 Ä‘Æ¡n vá»‹', c: '#d97706' },
  { v: 'member', l: 'NhÃ¢n viÃªn', d: 'Xem task, cáº­p nháº­t tráº¡ng thÃ¡i, táº¡o Ä‘á» xuáº¥t', c: '#6b7280' },
];
const COLORS = ['#E6F1FB', '#E1F5EE', '#FAEEDA', '#EEEDFE', '#FAECE7', '#FBEAF0', '#EAF3DE', '#F1EFE8'];

const MENU = [
  { id: 'users', label: 'TÃ i khoáº£n', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'branches', label: 'Chi nhÃ¡nh', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'permissions', label: 'PhÃ¢n quyá»n', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'groups', label: 'NhÃ³m cÃ´ng viá»‡c', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'categories', label: 'Loáº¡i Ä‘á» xuáº¥t', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { id: 'activity', label: 'Lá»‹ch sá»­', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'price_history', label: 'Lá»‹ch sá»­ giÃ¡', icon: 'M3 3v18h18M7 14l4-4 4 4 5-5' },
  { id: 'reports', label: 'BÃ¡o cÃ¡o', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'branch_compare', label: 'So sÃ¡nh CN', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { id: 'trend', label: 'Xu hÆ°á»›ng', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'heatmap', label: 'Heatmap giá»', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'appearance', label: 'Giao diá»‡n', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
];

export default function AdminPanel({ members, department, onRefresh, dynamicBranches, onBranchesChanged }) {
  const [section, setSection] = useState('users');
  const { createUser, user: currentAuthUser, isDirector, resetPassword } = useAuth();

  return (
    <div className="animate-fade-in">
      <h2 className="font-display font-bold text-lg mb-4" style={{ color: '#123524' }}>Quáº£n trá»‹ há»‡ thá»‘ng</h2>

      {/* Sub-menu */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {MENU.map(m => (
          <button key={m.id} onClick={() => setSection(m.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium border transition-all ${
              section === m.id ? 'bg-white shadow-sm border-gray-200 text-gray-900' : 'border-transparent text-gray-500 hover:bg-white/50'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={m.icon} /></svg>
            {m.label}
          </button>
        ))}
      </div>

      {section === 'users' && <UsersSection members={members} department={department} createUser={createUser} onRefresh={onRefresh} isDirector={isDirector} currentUserId={currentAuthUser?.id} resetPassword={resetPassword} />}
      {section === 'branches' && <BranchesSection onBranchesChanged={onBranchesChanged} />}
      {section === 'permissions' && <PermissionsSection />}
      {section === 'groups' && <GroupsSection department={department} onRefresh={onRefresh} />}
      {section === 'categories' && <CategoriesSection />}
      {section === 'activity' && <ActivityLogSection department={department} />}
      {section === 'price_history' && <PriceHistorySection department={department} />}
      {section === 'reports' && <ReportsSection department={department} isDirector={isDirector} currentUserId={currentAuthUser?.id} />}
      {section === 'branch_compare' && <BranchCompareSection department={department} dynamicBranches={dynamicBranches} />}
      {section === 'trend' && <TrendChartSection department={department} />}
      {section === 'heatmap' && <WorkHeatmapSection department={department} />}
      {section === 'appearance' && <AppearanceSection />}
    </div>
  );
}

function UsersSection({ members, department, createUser, onRefresh, isDirector, currentUserId, resetPassword }) {
  const [resetPwUserId, setResetPwUserId] = useState(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);

  async function handleResetPw() {
    if (!resetPwValue || resetPwValue.length < 6) { toast('Máº­t kháº©u má»›i tá»‘i thiá»ƒu 6 kÃ½ tá»±', 'error'); return; }
    setResetPwLoading(true);
    const { error } = await resetPassword(resetPwUserId, resetPwValue);
    setResetPwLoading(false);
    if (error) { toast('Lá»—i: ' + error.message, 'error'); return; }
    toast('ÄÃ£ reset máº­t kháº©u!', 'success');
    setResetPwUserId(null); setResetPwValue('');
  }

  async function handleDeleteUser(m) {
    if (!isDirector) return;
    if (m.id === currentUserId) { toast('KhÃ´ng thá»ƒ tá»± xoÃ¡ chÃ­nh mÃ¬nh', 'error'); return; }
    const ok = typeof window !== 'undefined' && window.confirm(
      `âš  XOÃ VÄ¨NH VIá»„N tÃ i khoáº£n nÃ y?\n\n${m.name} (${m.email})\n\nSáº½ xoÃ¡: tÃ i khoáº£n Ä‘Äƒng nháº­p, phÃ¢n quyá»n, liÃªn káº¿t task/Ä‘á» xuáº¥t, bÃ¬nh luáº­n. KHÃ”NG thá»ƒ khÃ´i phá»¥c.\n\nLÆ°u Ã½: náº¿u user nÃ y Ä‘Ã£ táº¡o nhiá»u task/Ä‘á» xuáº¥t, cáº§n xoÃ¡ cÃ¡c task/Ä‘á» xuáº¥t Ä‘Ã³ TRÆ¯á»šC, náº¿u khÃ´ng sáº½ lá»—i khoÃ¡ ngoáº¡i.`
    );
    if (!ok) return;
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: m.id, requesterId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) { toast('Lá»—i: ' + data.error, 'error'); return; }
      toast(`ÄÃ£ xoÃ¡ ${m.name}`, 'success');
      onRefresh && onRefresh();
    } catch (e) {
      toast('Lá»—i máº¡ng: ' + e.message, 'error');
    }
  }

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [position, setPosition] = useState('Ká»¹ thuáº­t viÃªn');
  const [userDept, setUserDept] = useState(department);
  const [userBranches, setUserBranches] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');

  function reset() { setName(''); setEmail(''); setPassword(''); setRole('member'); setPosition('Ká»¹ thuáº­t viÃªn'); setUserDept(department); setUserBranches([]); setShowForm(false); setEditId(null); }

  function toggleBranch(bid) {
    setUserBranches(prev => prev.includes(bid) ? prev.filter(x => x !== bid) : [...prev, bid]);
  }

  // TGÄ & Káº¿ toÃ¡n tháº¥y toÃ n bá»™, khÃ´ng cáº§n branches. Hotel dÃ¹ng department thay branch.
  const needsBranch = userDept === 'nail' && role !== 'director' && role !== 'accountant';
  // Member chá»‰ nÃªn cÃ³ 1 chi nhÃ¡nh; admin cÃ³ thá»ƒ nhiá»u.
  const maxBranches = role === 'member' ? 1 : NAIL_BRANCHES.length;

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return toast('Äiá»n Ä‘áº§y Ä‘á»§', 'error');
    if (password.length < 6) return toast('Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±', 'error');
    if (needsBranch && userBranches.length === 0) return toast('Chá»n Ã­t nháº¥t 1 chi nhÃ¡nh', 'error');
    setSubmitting(true);
    const branchesToSave = needsBranch ? userBranches : null;
    const { error } = await createUser(email.trim(), password, name.trim(), role, position, userDept, branchesToSave);
    if (error) { toast('Lá»—i: ' + error.message, 'error'); setSubmitting(false); return; }
    toast(`ÄÃ£ táº¡o tÃ i khoáº£n ${name}!`, 'success'); reset(); setSubmitting(false); onRefresh();
  }

  async function handleUpdate() {
    if (needsBranch && userBranches.length === 0) return toast('Chá»n Ã­t nháº¥t 1 chi nhÃ¡nh', 'error');
    setSubmitting(true);
    const branchesToSave = needsBranch ? userBranches : null;
    const { error } = await supabase.from('profiles').update({ role, position, department: userDept, branches: branchesToSave }).eq('id', editId);
    if (error) toast('Lá»—i: ' + error.message, 'error');
    else { toast('ÄÃ£ cáº­p nháº­t!', 'success'); reset(); onRefresh(); }
    setSubmitting(false);
  }

  function startEdit(m) {
    setEditId(m.id); setName(m.name); setEmail(m.email); setRole(m.role);
    setPosition(m.position || ''); setUserDept(m.department || 'nail');
    setUserBranches(Array.isArray(m.branches) ? m.branches : []);
    setShowForm(true);
  }
  const getInitials = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const filtered = filter === 'all' ? members : members.filter(m => m.department === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['all', 'nail', 'hotel'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white shadow-sm border border-gray-200' : 'text-gray-500'}`}>
              {f === 'all' ? 'Táº¥t cáº£' : f === 'nail' ? 'Nail' : 'Hotel'} ({(f === 'all' ? members : members.filter(m => m.department === f)).length})
            </button>
          ))}
        </div>
        {!showForm && <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#123524' }}>+ Táº¡o tÃ i khoáº£n</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-5 animate-slide-up">
          <h3 className="font-semibold text-sm mb-4">{editId ? `Sá»­a: ${name}` : 'Táº¡o tÃ i khoáº£n má»›i'}</h3>
          <form onSubmit={editId ? (e) => { e.preventDefault(); handleUpdate(); } : handleAdd} className="space-y-3">
            {!editId && (
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Há» tÃªn *</label><input className="input-field !text-sm" value={name} onChange={e => setName(e.target.value)} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" className="input-field !text-sm" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Máº­t kháº©u *</label><input type="text" className="input-field !text-sm" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vai trÃ²</label>
                <select className="input-field !text-sm" value={role} onChange={e => setRole(e.target.value)}>
                  {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ÄÆ¡n vá»‹</label>
                <select className="input-field !text-sm" value={userDept} onChange={e => setUserDept(e.target.value)}>
                  <option value="nail">Nail</option><option value="hotel">Hotel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vá»‹ trÃ­</label>
                <select className="input-field !text-sm" value={position} onChange={e => setPosition(e.target.value)}>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {/* Role description */}
            <div className="p-2.5 rounded-lg text-xs text-gray-600 leading-relaxed" style={{ background: '#F3EFE4' }}>
              {ROLES.find(r => r.v === role)?.d}
            </div>

            {/* Branch picker â€” only for nail, non-director/non-accountant */}
            {needsBranch && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Chi nhÃ¡nh Nail {role === 'admin' ? '(quáº£n lÃ½ â€” chá»n nhiá»u chi nhÃ¡nh phá»¥ trÃ¡ch)' : '(nhÃ¢n viÃªn â€” chá»n 1 chi nhÃ¡nh)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NAIL_BRANCHES.map(b => {
                    const active = userBranches.includes(b.id);
                    return (
                      <button key={b.id} type="button" onClick={() => {
                        if (role === 'member') setUserBranches([b.id]); // member: single select
                        else toggleBranch(b.id);
                      }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {b.label}
                      </button>
                    );
                  })}
                </div>
                {userBranches.length > 0 && <p className="text-[10px] text-emerald-600 mt-1.5">ÄÃ£ chá»n: {userBranches.map(branchLabel).join(', ')}</p>}
              </div>
            )}
            {userDept === 'nail' && (role === 'director' || role === 'accountant') && (
              <p className="text-[11px] text-gray-500 italic">TGÄ & Káº¿ toÃ¡n xem Ä‘Æ°á»£c toÃ n bá»™ 4 chi nhÃ¡nh (khÃ´ng cáº§n chá»n).</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>{submitting ? 'Äang xá»­ lÃ½...' : (editId ? 'Cáº­p nháº­t' : 'Táº¡o tÃ i khoáº£n')}</button>
              <button type="button" onClick={reset} className="btn-secondary !text-xs">Há»§y</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(m => {
          const rc = ROLES.find(r => r.v === m.role) || ROLES[3];
          return (
            <div key={m.id} className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: m.avatar_color, color: '#333' }}>{getInitials(m.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: rc.c + '15', color: rc.c }}>{rc.l}</span>
              <span className="text-[10px] text-gray-400">{m.department === 'hotel' ? 'Hotel' : 'Nail'}</span>
              {m.department === 'nail' && Array.isArray(m.branches) && m.branches.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-medium">{m.branches.map(branchLabel).join(', ')}</span>
              )}
              <span className="text-[10px] text-gray-400">{m.position}</span>
              <button onClick={() => startEdit(m)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Sá»­a">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              {isDirector && m.id !== currentUserId && (
                <button onClick={() => { setResetPwUserId(m.id); setResetPwValue(''); }} className="p-1 rounded hover:bg-amber-50 text-amber-400 hover:text-amber-600" title="Reset máº­t kháº©u">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </button>
              )}
              {isDirector && m.id !== currentUserId && (
                <button onClick={() => handleDeleteUser(m)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="XoÃ¡ vÄ©nh viá»…n (chá»‰ TGÄ)">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Reset password modal */}
      {resetPwUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResetPwUserId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-1" style={{ color: '#123524' }}>Reset máº­t kháº©u</h3>
            <p className="text-[11px] text-gray-500 mb-3">Cho: {members.find(m => m.id === resetPwUserId)?.name || 'â€”'}</p>
            <input type="text" className="input-field !text-sm mb-3" placeholder="Máº­t kháº©u má»›i (tá»‘i thiá»ƒu 6 kÃ½ tá»±)" value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleResetPw} disabled={resetPwLoading} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>{resetPwLoading ? 'Äang xá»­ lÃ½...' : 'Reset'}</button>
              <button onClick={() => setResetPwUserId(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100">Há»§y</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsSection({ department, onRefresh }) {
  const [groups, setGroups] = useState([]);
  const [newName, setNewName] = useState('');
  const { user } = useAuth();

  useEffect(() => { fetchGroups(); }, [department]);
  async function fetchGroups() {
    const { data } = await supabase.from('task_groups').select('*').eq('department', department).order('name');
    setGroups(data || []);
  }
  async function addGroup() {
    if (!newName.trim()) return;
    await supabase.from('task_groups').insert({ name: newName.trim(), department, created_by: user.id });
    setNewName(''); toast('ÄÃ£ táº¡o nhÃ³m!', 'success'); fetchGroups(); onRefresh();
  }
  async function deleteGroup(id) {
    await supabase.from('task_groups').delete().eq('id', id);
    toast('ÄÃ£ xÃ³a!', 'success'); fetchGroups(); onRefresh();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input className="input-field !text-sm flex-1" placeholder="TÃªn nhÃ³m má»›i..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()} />
        <button onClick={addGroup} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#123524' }}>ThÃªm</button>
      </div>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="card p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{g.name}</span>
            <button onClick={() => deleteGroup(g.id)} className="text-red-400 hover:text-red-600 text-xs">XÃ³a</button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-6">ChÆ°a cÃ³ nhÃ³m nÃ o</p>}
      </div>
    </div>
  );
}

function CategoriesSection() {
  const [cats, setCats] = useState([]);
  const [newName, setNewName] = useState('');
  const { user } = useAuth();

  useEffect(() => { fetchCats(); }, []);
  async function fetchCats() {
    const { data } = await supabase.from('proposal_categories').select('*').order('name');
    setCats(data || []);
  }
  async function addCat() {
    if (!newName.trim()) return;
    await supabase.from('proposal_categories').insert({ name: newName.trim(), created_by: user.id });
    setNewName(''); toast('ÄÃ£ thÃªm!', 'success'); fetchCats();
  }
  async function deleteCat(id) {
    await supabase.from('proposal_categories').delete().eq('id', id);
    toast('ÄÃ£ xÃ³a!', 'success'); fetchCats();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input className="input-field !text-sm flex-1" placeholder="TÃªn loáº¡i Ä‘á» xuáº¥t má»›i..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} />
        <button onClick={addCat} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#123524' }}>ThÃªm</button>
      </div>
      <div className="space-y-2">
        {cats.map(c => (
          <div key={c.id} className="card p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{c.name}</span>
            <button onClick={() => deleteCat(c.id)} className="text-red-400 hover:text-red-600 text-xs">XÃ³a</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â• ACTIVITY LOG SECTION â•â•â•â•â•â•â•â•â•â•â•
function ActivityLogSection({ department }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [limit, setLimit] = useState(50);

  useEffect(() => { fetchLogs(); }, [department, filterAction]);

  async function fetchLogs() {
    setLoading(true);
    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (department) q = q.eq('department', department);
    if (filterAction !== 'all') q = q.eq('action', filterAction);
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }

  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const actionList = Object.entries(ACTION_LABELS);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Lá»‹ch sá»­ hoáº¡t Ä‘á»™ng</h3>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterAction('all')} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterAction === 'all' ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterAction === 'all' ? { background: '#123524' } : {}}>Táº¥t cáº£</button>
        {actionList.map(([k, l]) => (
          <button key={k} onClick={() => setFilterAction(k)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filterAction === k ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`} style={filterAction === k ? { background: '#123524' } : {}}>
            {ACTION_ICONS[k] || ''} {l}
          </button>
        ))}
      </div>
      {loading ? <div className="card p-8 text-center text-sm text-gray-400">Äang táº£i...</div> : logs.length === 0 ? <div className="card p-8 text-center text-sm text-gray-400">ChÆ°a cÃ³ hoáº¡t Ä‘á»™ng nÃ o</div> : (
        <div className="space-y-1.5">
          {logs.map(log => (
            <div key={log.id} className="card p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">{ACTION_ICONS[log.action] || 'ðŸ“Œ'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-800">{log.user_name || 'Há»‡ thá»‘ng'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{ACTION_LABELS[log.action] || log.action}</span>
                </div>
                {log.target_title && <p className="text-xs text-gray-600 mt-0.5 truncate">"{log.target_title}"</p>}
                {log.details && typeof log.details === 'object' && log.details.old_status && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{log.details.old_status} â†’ {log.details.new_status}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">{fmtDT(log.created_at)}</p>
              </div>
            </div>
          ))}
          {logs.length >= limit && (
            <button onClick={() => { setLimit(l => l + 50); setTimeout(fetchLogs, 0); }}
              className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 rounded-xl">
              Táº£i thÃªm...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â• BRANCHES SECTION â•â•â•â•â•â•â•â•â•â•â•
function BranchesSection({ onBranchesChanged }) {
  const [branches, setBranches] = useState([]);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDept, setNewDept] = useState('nail');
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => { fetchBranches(); }, []);
  async function fetchBranches() {
    const { data } = await supabase.from('branches').select('*').order('sort_order');
    setBranches(data || []);
  }

  async function addBranch() {
    const slug = newId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!slug || !newLabel.trim()) return toast('Nháº­p ID vÃ  tÃªn chi nhÃ¡nh', 'error');
    if (branches.some(b => b.id === slug)) return toast('ID Ä‘Ã£ tá»“n táº¡i', 'error');
    const maxSort = branches.length > 0 ? Math.max(...branches.map(b => b.sort_order || 0)) + 1 : 1;
    const { error } = await supabase.from('branches').insert({ id: slug, label: newLabel.trim(), department: newDept, sort_order: maxSort });
    if (error) return toast('Lá»—i: ' + error.message, 'error');
    toast('ÄÃ£ thÃªm chi nhÃ¡nh!', 'success');
    setNewId(''); setNewLabel(''); fetchBranches(); if (onBranchesChanged) onBranchesChanged();
  }

  async function saveEdit(id) {
    if (!editLabel.trim()) return;
    await supabase.from('branches').update({ label: editLabel.trim() }).eq('id', id);
    toast('ÄÃ£ cáº­p nháº­t!', 'success'); setEditId(null); fetchBranches(); if (onBranchesChanged) onBranchesChanged();
  }

  async function toggleActive(b) {
    await supabase.from('branches').update({ active: !b.active }).eq('id', b.id);
    fetchBranches(); if (onBranchesChanged) onBranchesChanged();
  }

  async function deleteBranch(b) {
    if (!window.confirm(`XÃ³a chi nhÃ¡nh "${b.label}"? Chá»‰ nÃªn xÃ³a náº¿u chÆ°a cÃ³ task/user nÃ o thuá»™c chi nhÃ¡nh nÃ y.`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', b.id);
    if (error) return toast('Lá»—i: ' + error.message, 'error');
    toast('ÄÃ£ xÃ³a!', 'success'); fetchBranches(); if (onBranchesChanged) onBranchesChanged();
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-4">Quáº£n lÃ½ chi nhÃ¡nh</h3>
      <div className="card p-4 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">ThÃªm chi nhÃ¡nh má»›i</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input className="input-field !text-xs" placeholder="ID (vd: phu_nhuan)" value={newId} onChange={e => setNewId(e.target.value)} />
          <input className="input-field !text-xs" placeholder="TÃªn hiá»ƒn thá»‹ (vd: PhÃº Nhuáº­n)" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
          <select className="input-field !text-xs" value={newDept} onChange={e => setNewDept(e.target.value)}>
            <option value="nail">Nail</option><option value="hotel">Hotel</option>
          </select>
        </div>
        <button onClick={addBranch} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#123524' }}>+ ThÃªm</button>
      </div>
      <div className="space-y-2">
        {branches.map(b => (
          <div key={b.id} className={`card p-3 flex items-center gap-3 ${!b.active ? 'opacity-50' : ''}`}>
            <span className="text-[10px] font-mono text-gray-400 w-24 truncate">{b.id}</span>
            {editId === b.id ? (
              <input className="input-field !text-xs !py-1 flex-1" value={editLabel} onChange={e => setEditLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(b.id)} autoFocus />
            ) : (
              <span className="text-xs font-medium flex-1">{b.label}</span>
            )}
            <span className="text-[10px] text-gray-400">{b.department}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${b.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.active ? 'Hoáº¡t Ä‘á»™ng' : 'Táº¡m dá»«ng'}</span>
            {editId === b.id ? (
              <button onClick={() => saveEdit(b.id)} className="text-xs text-emerald-600 font-semibold">LÆ°u</button>
            ) : (
              <button onClick={() => { setEditId(b.id); setEditLabel(b.label); }} className="text-xs text-blue-600">Sá»­a</button>
            )}
            <button onClick={() => toggleActive(b)} className="text-xs text-amber-600">{b.active ? 'Dá»«ng' : 'Báº­t'}</button>
            <button onClick={() => deleteBranch(b)} className="text-xs text-red-600">XÃ³a</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â• PERMISSIONS SECTION â•â•â•â•â•â•â•â•â•â•â•
function PermissionsSection() {
  const DEFAULT_PERMS = {
    member_create_task: false,
    admin_delete_tasks: false,
    admin_delete_proposals: false,
    admin_approve_proposals: false,
    admin_manage_users: false,
    member_view_reports: true,
  };
  const PERM_LIST = [
    { key: 'member_create_task', label: 'NhÃ¢n viÃªn Ä‘Æ°á»£c táº¡o task', desc: 'Cho phÃ©p Member táº¡o task má»›i (khÃ´ng chá»‰ Admin/TGÄ). Task cá»§a Member sáº½ cáº§n duyá»‡t.' },
    { key: 'admin_delete_tasks', label: 'Quáº£n lÃ½ Ä‘Æ°á»£c xÃ³a task', desc: 'Cho phÃ©p Admin xÃ³a task (hiá»‡n chá»‰ TGÄ).' },
    { key: 'admin_delete_proposals', label: 'Quáº£n lÃ½ Ä‘Æ°á»£c xÃ³a Ä‘á» xuáº¥t', desc: 'Cho phÃ©p Admin xÃ³a Ä‘á» xuáº¥t (hiá»‡n chá»‰ TGÄ).' },
    { key: 'admin_approve_proposals', label: 'Quáº£n lÃ½ Ä‘Æ°á»£c duyá»‡t Ä‘á» xuáº¥t', desc: 'Cho phÃ©p Admin phÃª duyá»‡t/tá»« chá»‘i Ä‘á» xuáº¥t (hiá»‡n chá»‰ TGÄ/Káº¿ toÃ¡n).' },
    { key: 'admin_manage_users', label: 'Quáº£n lÃ½ Ä‘Æ°á»£c quáº£n trá»‹ user', desc: 'Cho phÃ©p Admin táº¡o/sá»­a tÃ i khoáº£n nhÃ¢n viÃªn (hiá»‡n chá»‰ TGÄ).' },
    { key: 'member_view_reports', label: 'NhÃ¢n viÃªn xem bÃ¡o cÃ¡o', desc: 'Cho phÃ©p Member/nhÃ¢n viÃªn tháº¥y tab ÄÃ¡nh giÃ¡. Táº¯t = chá»‰ Admin trá»Ÿ lÃªn tháº¥y.' },
  ];

  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle().then(({ data }) => {
      if (data) {
        const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setPerms(prev => ({ ...prev, ...v }));
      }
      setLoaded(true);
    });
  }, []);

  async function savePerms() {
    setSaving(true);
    await supabase.from('app_settings').upsert({ key: 'permissions', value: perms }, { onConflict: 'key' });
    toast('ÄÃ£ lÆ°u phÃ¢n quyá»n! Thay Ä‘á»•i cÃ³ hiá»‡u lá»±c khi user táº£i láº¡i trang.', 'success');
    setSaving(false);
  }

  if (!loaded) return <div className="card p-8 text-center text-sm text-gray-400">Äang táº£i...</div>;

  return (
    <div>
      <h3 className="font-semibold text-sm mb-1">Cáº¥u hÃ¬nh phÃ¢n quyá»n</h3>
      <p className="text-[11px] text-gray-500 mb-4">Báº­t/táº¯t cÃ¡c quyá»n má»Ÿ rá»™ng. Thay Ä‘á»•i Ã¡p dá»¥ng cho táº¥t cáº£ user thuá»™c vai trÃ² tÆ°Æ¡ng á»©ng khi há» táº£i láº¡i trang.</p>
      <div className="space-y-3">
        {PERM_LIST.map(p => (
          <div key={p.key} className="card p-4 flex items-start gap-3">
            <div className="relative w-10 h-5 rounded-full cursor-pointer transition-colors mt-0.5 flex-shrink-0"
              style={{ background: perms[p.key] ? '#123524' : '#d1d5db' }}
              onClick={() => setPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: perms[p.key] ? '22px' : '2px' }} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-800">{p.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold flex-shrink-0 ${perms[p.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {perms[p.key] ? 'Báº¬T' : 'Táº®T'}
            </span>
          </div>
        ))}
      </div>
      <button onClick={savePerms} disabled={saving}
        className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: '#123524' }}>
        {saving ? 'Äang lÆ°u...' : 'LÆ°u phÃ¢n quyá»n'}
      </button>
    </div>
  );
}

function ReportsSection({ department, isDirector, currentUserId }) {
  const [proposals, setProposals] = useState([]);
  const [prevProposals, setPrevProposals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [prevTasks, setPrevTasks] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [ceoReportSending, setCeoReportSending] = useState(false);
  const [telegramInfo, setTelegramInfo] = useState(null);
  const [telegramChecking, setTelegramChecking] = useState(false);

  async function handleSendCEOReport(reportPeriod) {
    if (!isDirector) { toast('Chá»‰ Tá»•ng giÃ¡m Ä‘á»‘c má»›i Ä‘Æ°á»£c gá»­i bÃ¡o cÃ¡o CEO', 'error'); return; }
    if (!currentUserId) return;
    if (!window.confirm(`Gá»­i bÃ¡o cÃ¡o ${reportPeriod === 'month' ? 'thÃ¡ng' : 'tuáº§n'} ngay cho táº¥t cáº£ Tá»•ng GiÃ¡m Ä‘á»‘c? (in-app + push + email/Telegram náº¿u cÃ³)`)) return;
    setCeoReportSending(true);
    try {
      const res = await fetch(`/api/send-ceo-report?period=${reportPeriod}&requesterId=${currentUserId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast('Lá»—i: ' + (data.error || 'KhÃ´ng gá»­i Ä‘Æ°á»£c'), 'error'); return; }
      const count = (data.notifyResults || []).length;
      const tg = (data.telegramResults || []).filter(t => t.ok).length;
      const tgTotal = (data.telegramResults || []).length;
      toast(`âœ… ÄÃ£ gá»­i bÃ¡o cÃ¡o ${reportPeriod === 'month' ? 'thÃ¡ng' : 'tuáº§n'}: ${count} TGÄ${tgTotal ? `, Telegram ${tg}/${tgTotal}` : ''}`, 'success');
    } catch (e) {
      toast('Lá»—i máº¡ng: ' + e.message, 'error');
    } finally {
      setCeoReportSending(false);
    }
  }

  async function handleCheckTelegram() {
    if (!currentUserId) return;
    setTelegramChecking(true);
    try {
      const res = await fetch(`/api/telegram-check?requesterId=${currentUserId}`);
      const data = await res.json();
      setTelegramInfo(data);
      if (!data.configured) toast('Bot Telegram chÆ°a cáº¥u hÃ¬nh. Xem hÆ°á»›ng dáº«n trong panel.', 'error');
    } catch (e) {
      toast('Lá»—i: ' + e.message, 'error');
    } finally {
      setTelegramChecking(false);
    }
  }

  useEffect(() => { fetchReport(); }, [department, period, dateFrom, dateTo]);

  // â”€â”€â”€ Period helpers â”€â”€â”€
  function getPeriodRange() {
    const now = new Date();
    let start;
    if (dateFrom && dateTo) { start = new Date(dateFrom); return { start, end: new Date(dateTo + 'T23:59:59') }; }
    if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
    else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
    else { start = new Date(now.getFullYear(), 0, 1); }
    return { start, end: now };
  }
  function getPrevRange() {
    const { start, end } = getPeriodRange();
    const dur = end - start;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - dur);
    return { start: prevStart, end: prevEnd };
  }
  const periodLabel = { week: 'tuáº§n', month: 'thÃ¡ng', quarter: 'quÃ½', year: 'nÄƒm' };

  // â”€â”€â”€ Fetch â”€â”€â”€
  async function fetchReport() {
    setLoading(true);
    const { start, end } = getPeriodRange();
    const prev = getPrevRange();
    const endISO = end.toISOString();
    const [pR, tR, ppR, ptR, mR, cR] = await Promise.all([
      supabase.from('proposals').select('*').eq('department', department).gte('created_at', start.toISOString()).lte('created_at', endISO),
      supabase.from('tasks').select('*, assignees:task_assignees(user_id)').eq('department', department).is('parent_id', null).gte('created_at', start.toISOString()).lte('created_at', endISO),
      supabase.from('proposals').select('*').eq('department', department).gte('created_at', prev.start.toISOString()).lte('created_at', prev.end.toISOString()),
      supabase.from('tasks').select('id, status, deadline, completed_at').eq('department', department).is('parent_id', null).gte('created_at', prev.start.toISOString()).lte('created_at', prev.end.toISOString()),
      supabase.from('profiles').select('id, name, avatar_color, position, department, branches').order('name'),
      supabase.from('proposal_categories').select('*').order('name'),
    ]);
    setProposals(pR.data || []); setTasks(tR.data || []);
    setPrevProposals(ppR.data || []); setPrevTasks(ptR.data || []);
    setAllMembers(mR.data || []); setCategories(cR.data || []);
    setLoading(false);
  }

  // â”€â”€â”€ Current period metrics â”€â”€â”€
  const now = new Date();
  const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v) + 'Ä‘';
  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const totalTasks = tasks.length;
  const taskDone = tasks.filter(t => t.status === 'done').length;
  const taskDoing = tasks.filter(t => t.status === 'doing').length;
  const taskWaiting = tasks.filter(t => t.status === 'waiting').length;
  const taskOverdue = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
  const taskRate = totalTasks > 0 ? Math.round((taskDone / totalTasks) * 100) : 0;

  // On-time rate: done + (completed before deadline OR no deadline)
  const doneOnTime = tasks.filter(t => t.status === 'done' && (!t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline))).length;
  const onTimeRate = taskDone > 0 ? Math.round((doneOnTime / taskDone) * 100) : 0;

  // Avg completion time (days)
  const doneTasks = tasks.filter(t => t.status === 'done' && t.completed_at);
  const avgDays = doneTasks.length > 0 ? (doneTasks.reduce((s, t) => s + (new Date(t.completed_at) - new Date(t.created_at)) / 86400000, 0) / doneTasks.length).toFixed(1) : 'â€”';

  const totalProposals = proposals.length;
  const totalApproved = proposals.filter(p => p.status === 'approved').length;
  const totalPending = proposals.filter(p => p.status === 'pending' || p.status === 'partial').length;
  const totalRejected = proposals.filter(p => p.status === 'rejected').length;
  const totalCost = proposals.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);
  const approvalRate = totalProposals > 0 ? Math.round((totalApproved / totalProposals) * 100) : 0;

  // â”€â”€â”€ Previous period metrics (for trend) â”€â”€â”€
  const prevTaskTotal = prevTasks.length;
  const prevTaskDone = prevTasks.filter(t => t.status === 'done').length;
  const prevTaskRate = prevTaskTotal > 0 ? Math.round((prevTaskDone / prevTaskTotal) * 100) : 0;
  const prevTaskOverdue = prevTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
  const prevPropTotal = prevProposals.length;
  const prevPropApproved = prevProposals.filter(p => p.status === 'approved').length;
  const prevCost = prevProposals.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);

  // Trend helper: returns { delta, pct, direction }
  function trend(cur, prev) {
    const d = cur - prev;
    const pct = prev > 0 ? Math.round(Math.abs(d) / prev * 100) : (cur > 0 ? 100 : 0);
    return { delta: d, pct, dir: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' };
  }

  // â”€â”€â”€ Health Score (0-100) â”€â”€â”€
  // Weights: completion 35%, on-time 25%, low-overdue 20%, approval-rate 20%
  const healthScore = Math.round(
    taskRate * 0.35 +
    onTimeRate * 0.25 +
    (totalTasks > 0 ? Math.max(0, 100 - (taskOverdue / totalTasks) * 200) : 100) * 0.20 +
    approvalRate * 0.20
  );
  const healthColor = healthScore >= 75 ? '#16a34a' : healthScore >= 50 ? '#d97706' : '#dc2626';
  const healthLabel = healthScore >= 75 ? 'Tá»‘t' : healthScore >= 50 ? 'Trung bÃ¬nh' : 'Cáº§n cáº£i thiá»‡n';

  // â”€â”€â”€ Bottleneck: overdue breakdown â”€â”€â”€
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now);
  const od1to3 = overdueTasks.filter(t => { const d = (now - new Date(t.deadline)) / 86400000; return d >= 0 && d < 3; }).length;
  const od3to7 = overdueTasks.filter(t => { const d = (now - new Date(t.deadline)) / 86400000; return d >= 3 && d < 7; }).length;
  const od7plus = overdueTasks.filter(t => (now - new Date(t.deadline)) / 86400000 >= 7).length;

  // â”€â”€â”€ Employee efficiency (only dept members, exclude director) â”€â”€â”€
  const deptMembers = allMembers.filter(m => m.department === department && m.id);
  const empStats = deptMembers.map(m => {
    const mt = tasks.filter(t => (t.assignees || []).some(a => a.user_id === m.id));
    const done = mt.filter(t => t.status === 'done').length;
    const overdue = mt.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
    const rate = mt.length > 0 ? Math.round((done / mt.length) * 100) : -1; // -1 = no tasks
    return { ...m, total: mt.length, done, overdue, rate };
  }).filter(e => e.total > 0).sort((a, b) => b.rate - a.rate);

  // Top/bottom performers
  const topPerformers = empStats.filter(e => e.rate >= 0).slice(0, 3);
  const needAttention = empStats.filter(e => e.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5);

  // â”€â”€â”€ Category breakdown â”€â”€â”€
  const catStats = categories.map(cat => {
    const items = proposals.filter(p => p.category_name === cat.name);
    const approved = items.filter(p => p.status === 'approved');
    const pending = items.filter(p => p.status === 'pending' || p.status === 'partial');
    const rejected = items.filter(p => p.status === 'rejected');
    const cost = approved.reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);
    return { name: cat.name, total: items.length, approved: approved.length, pending: pending.length, rejected: rejected.length, cost };
  }).filter(c => c.total > 0);
  const maxCatTotal = Math.max(...catStats.map(c => c.total), 1);

  // â”€â”€â”€ AI Insights â”€â”€â”€
  const insights = [];
  if (taskOverdue > 0) {
    const sev = taskOverdue >= 5 ? 'high' : taskOverdue >= 2 ? 'medium' : 'low';
    insights.push({ sev, icon: 'ðŸš¨', text: `${taskOverdue} task Ä‘ang trá»… háº¡n${od7plus > 0 ? ` (${od7plus} trá»… hÆ¡n 7 ngÃ y â€” cáº§n xá»­ lÃ½ gáº¥p)` : ''}. Cáº§n rÃ  soÃ¡t láº¡i khá»‘i lÆ°á»£ng cÃ´ng viá»‡c hoáº·c deadline.` });
  }
  if (needAttention.length > 0) {
    const names = needAttention.slice(0, 2).map(e => e.name).join(', ');
    insights.push({ sev: 'high', icon: 'ðŸ‘¤', text: `${needAttention.length} nhÃ¢n sá»± cÃ³ task trá»… háº¡n (${names}${needAttention.length > 2 ? '...' : ''}). NÃªn trao Ä‘á»•i trá»±c tiáº¿p Ä‘á»ƒ há»— trá»£ hoáº·c Ä‘iá»u chá»‰nh.` });
  }
  if (totalPending > 0 && totalPending >= totalApproved) {
    insights.push({ sev: 'medium', icon: 'ðŸ“‹', text: `${totalPending} Ä‘á» xuáº¥t Ä‘ang chá» duyá»‡t (â‰¥ sá»‘ Ä‘Ã£ duyá»‡t). Bottleneck phÃª duyá»‡t cÃ³ thá»ƒ lÃ m cháº­m hoáº¡t Ä‘á»™ng.` });
  }
  { const t = trend(taskRate, prevTaskRate);
    if (t.dir === 'up' && t.pct >= 10) insights.push({ sev: 'low', icon: 'ðŸ“ˆ', text: `Tá»· lá»‡ hoÃ n thÃ nh tÄƒng ${t.pct}% so vá»›i ká»³ trÆ°á»›c â€” Ä‘á»™i ngÅ© Ä‘ang cáº£i thiá»‡n tá»‘t.` });
    if (t.dir === 'down' && t.pct >= 10) insights.push({ sev: 'medium', icon: 'ðŸ“‰', text: `Tá»· lá»‡ hoÃ n thÃ nh giáº£m ${t.pct}% so vá»›i ká»³ trÆ°á»›c. Cáº§n xem láº¡i khá»‘i lÆ°á»£ng hoáº·c nÄƒng lá»±c.` });
  }
  if (taskRate >= 85 && onTimeRate >= 85) insights.push({ sev: 'low', icon: 'ðŸ†', text: `HoÃ n thÃ nh ${taskRate}%, Ä‘Ãºng háº¡n ${onTimeRate}% â€” Váº­n hÃ nh xuáº¥t sáº¯c! Duy trÃ¬ phong Ä‘á»™.` });
  if (totalCost > 0 && prevCost > 0) {
    const ct = trend(totalCost, prevCost);
    if (ct.dir === 'up' && ct.pct >= 20) insights.push({ sev: 'medium', icon: 'ðŸ’°', text: `Chi phÃ­ Ä‘á» xuáº¥t tÄƒng ${ct.pct}% so vá»›i ká»³ trÆ°á»›c (${fmtMoney(totalCost)} vs ${fmtMoney(prevCost)}). Cáº§n kiá»ƒm soÃ¡t ngÃ¢n sÃ¡ch.` });
  }
  if (taskWaiting >= 3) insights.push({ sev: 'medium', icon: 'â³', text: `${taskWaiting} task Ä‘ang chá» pháº£n há»“i â€” cÃ³ thá»ƒ bá»‹ "treo" do thiáº¿u thÃ´ng tin hoáº·c quyáº¿t Ä‘á»‹nh.` });
  if (insights.length === 0 && totalTasks > 0) insights.push({ sev: 'low', icon: 'âœ…', text: 'KhÃ´ng phÃ¡t hiá»‡n váº¥n Ä‘á» Ä‘Ã¡ng lÆ°u Ã½. Váº­n hÃ nh á»•n Ä‘á»‹nh.' });
  const sevOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);

  // â”€â”€â”€ Trend arrow component â”€â”€â”€
  function TrendBadge({ cur, prev, inverse }) {
    // inverse = true khi sá»‘ giáº£m lÃ  Tá»T (e.g. overdue)
    const t = trend(cur, prev);
    if (t.dir === 'flat' || prev === 0) return <span className="text-[9px] text-gray-400">â€”</span>;
    const good = inverse ? t.dir === 'down' : t.dir === 'up';
    const color = good ? 'text-green-600' : 'text-red-600';
    const arrow = t.dir === 'up' ? 'â†‘' : 'â†“';
    return <span className={`text-[10px] font-semibold ${color}`}>{arrow}{t.pct}%</span>;
  }

  if (loading) return <div className="card p-10 text-center text-sm text-gray-400">Äang phÃ¢n tÃ­ch dá»¯ liá»‡u...</div>;

  return (
    <div className="space-y-5">
      {/* â”€â”€ HEADER + FILTERS â”€â”€ */}
      <div>
        <h3 className="font-display font-bold text-base mb-1" style={{ color: '#123524' }}>
          BÃ¡o cÃ¡o C-Level â€” {department === 'hotel' ? 'Hotel' : 'Nail'}
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">PhÃ¢n tÃ­ch toÃ n diá»‡n giÃºp ra quyáº¿t Ä‘á»‹nh nhanh. Dá»¯ liá»‡u so sÃ¡nh vá»›i ká»³ trÆ°á»›c cÃ¹ng thá»i lÆ°á»£ng.</p>
        <div className="flex gap-2 flex-wrap items-center">
          {['week', 'month', 'quarter', 'year'].map(p => (
            <button key={p} onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p && !dateFrom ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`}
              style={period === p && !dateFrom ? { background: '#123524' } : {}}>
              {p === 'week' ? 'Tuáº§n' : p === 'month' ? 'ThÃ¡ng' : p === 'quarter' ? 'QuÃ½' : 'NÄƒm'}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-1">hoáº·c</span>
          <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-xs text-gray-400">â†’</span>
          <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:underline">XÃ³a</button>}
        </div>

        {/* CEO Report actions (director only) */}
        {isDirector && (
          <div className="mt-3 flex gap-2 flex-wrap items-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-[11px] text-amber-900 font-medium">ðŸ“¬ Gá»­i bÃ¡o cÃ¡o CEO ngay:</span>
            <button onClick={() => handleSendCEOReport('week')} disabled={ceoReportSending}
              className="text-[11px] px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              {ceoReportSending ? 'Äang gá»­i...' : 'BÃ¡o cÃ¡o tuáº§n'}
            </button>
            <button onClick={() => handleSendCEOReport('month')} disabled={ceoReportSending}
              className="text-[11px] px-2.5 py-1 rounded bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              BÃ¡o cÃ¡o thÃ¡ng
            </button>
            <span className="text-[10px] text-amber-700 ml-auto">Tá»± Ä‘á»™ng: Thá»© 2 hÃ ng tuáº§n + ngÃ y 1 hÃ ng thÃ¡ng</span>
          </div>
        )}

        {/* Telegram bot setup (director only) */}
        {isDirector && (
          <div className="mt-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[11px] text-sky-900 font-medium">ðŸ¤– Telegram bot:</span>
              <button onClick={handleCheckTelegram} disabled={telegramChecking}
                className="text-[11px] px-2.5 py-1 rounded bg-white border border-sky-300 text-sky-900 hover:bg-sky-100 disabled:opacity-50">
                {telegramChecking ? 'Äang kiá»ƒm tra...' : 'Kiá»ƒm tra tráº¡ng thÃ¡i'}
              </button>
              {telegramInfo && telegramInfo.configured && telegramInfo.bot && (
                <a href={telegramInfo.bot.link} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2.5 py-1 rounded bg-white border border-sky-300 text-sky-700 hover:bg-sky-100">
                  Má»Ÿ @{telegramInfo.bot.username}
                </a>
              )}
              {telegramInfo && (
                <span className={`text-[10px] ml-auto ${telegramInfo.configured ? 'text-sky-700' : 'text-red-600'}`}>
                  {telegramInfo.configured ? `${telegramInfo.chats?.length || 0} chat Ä‘ang nháº­n` : 'ChÆ°a cáº¥u hÃ¬nh'}
                </span>
              )}
            </div>
            {telegramInfo && !telegramInfo.configured && (
              <div className="mt-2 text-[10px] text-sky-800 space-y-0.5">
                <div className="font-semibold">HÆ°á»›ng dáº«n set up (3 phÃºt):</div>
                {(telegramInfo.setupSteps || []).map((s, i) => <div key={i}>{s}</div>)}
              </div>
            )}
            {telegramInfo && telegramInfo.configured && telegramInfo.chats && telegramInfo.chats.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-semibold text-sky-800">Chat Ä‘ang káº¿t ná»‘i:</div>
                {telegramInfo.chats.map(c => (
                  <div key={c.id} className="text-[10px] text-sky-700 flex gap-2 items-center bg-white rounded px-2 py-1 border border-sky-100">
                    <code className="font-mono">{c.id}</code>
                    <span className="text-sky-500">Â·</span>
                    <span>{c.type === 'private' ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : c.title || '(khÃ´ng tÃªn)'}</span>
                    {c.username && <span className="text-sky-400">@{c.username}</span>}
                  </div>
                ))}
                <div className="text-[10px] bg-white rounded px-2 py-1.5 border border-sky-200">
                  <div className="font-semibold text-sky-800 mb-0.5">Chuá»—i CSV Ä‘á»ƒ paste vÃ o Vercel env <code className="font-mono">TELEGRAM_CHAT_IDS</code>:</div>
                  <code className="font-mono text-sky-900 break-all">{telegramInfo.csv}</code>
                </div>
                {telegramInfo.currentEnv?.TELEGRAM_CHAT_IDS && telegramInfo.currentEnv.TELEGRAM_CHAT_IDS !== '(chua set)' && (
                  <div className="text-[10px] text-sky-700">
                    Env hiá»‡n táº¡i: <code className="font-mono">{telegramInfo.currentEnv.TELEGRAM_CHAT_IDS}</code>
                  </div>
                )}
              </div>
            )}
            {telegramInfo && telegramInfo.configured && telegramInfo.chats && telegramInfo.chats.length === 0 && (
              <div className="mt-2 text-[10px] text-sky-800">
                {telegramInfo.hint || 'ChÆ°a cÃ³ ai nháº¯n tin cho bot. HÃ£y nhá» CEO vÃ o t.me/<bot> â†’ báº¥m Start.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 1: HEALTH SCORE + KPI CARDS â•â•â•â•â•â•â•â•â•â• */}
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
        {/* Health Score gauge */}
        <div className="card p-4 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={healthColor} strokeWidth="8"
                strokeDasharray={`${healthScore * 2.64} 264`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: healthColor }}>{healthScore}</span>
              <span className="text-[8px] text-gray-400">/100</span>
            </div>
          </div>
          <p className="text-[10px] font-semibold mt-1.5" style={{ color: healthColor }}>{healthLabel}</p>
          <p className="text-[8px] text-gray-400 text-center mt-0.5">Äiá»ƒm sá»©c khá»e váº­n hÃ nh</p>
        </div>

        {/* KPI cards with trend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[
            { l: 'Task táº¡o má»›i', v: totalTasks, prev: prevTaskTotal, c: '#1a1a1a' },
            { l: 'HoÃ n thÃ nh', v: taskDone, prev: prevTaskDone, c: '#16a34a' },
            { l: 'Tá»· lá»‡ xong', v: taskRate + '%', prev: prevTaskRate, c: taskRate >= 70 ? '#16a34a' : '#d97706', raw: taskRate },
            { l: 'Trá»… háº¡n', v: taskOverdue, prev: prevTaskOverdue, c: '#dc2626', inverse: true },
            { l: 'ÄÃºng háº¡n', v: onTimeRate + '%', c: onTimeRate >= 80 ? '#16a34a' : '#d97706' },
          ].map(k => (
            <div key={k.l} className="card p-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-wide">{k.l}</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-xl font-bold" style={{ color: k.c }}>{k.v}</p>
                {k.prev !== undefined && <TrendBadge cur={k.raw ?? (typeof k.v === 'number' ? k.v : 0)} prev={k.prev} inverse={k.inverse} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 2: TREND SO Vá»šI Ká»² TRÆ¯á»šC â•â•â•â•â•â•â•â•â•â• */}
      <div className="card p-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          So sÃ¡nh vá»›i {dateFrom ? 'ká»³ trÆ°á»›c' : periodLabel[period] + ' trÆ°á»›c'}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: 'Task má»›i', cur: totalTasks, prev: prevTaskTotal },
            { l: 'HoÃ n thÃ nh', cur: taskDone, prev: prevTaskDone },
            { l: 'Äá» xuáº¥t', cur: totalProposals, prev: prevPropTotal },
            { l: 'Chi phÃ­ duyá»‡t', cur: totalCost, prev: prevCost, isMoney: true },
          ].map(r => {
            const t = trend(r.cur, r.prev);
            return (
              <div key={r.l} className="rounded-xl p-3 bg-gray-50">
                <p className="text-[9px] text-gray-500 uppercase">{r.l}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-gray-800">{r.isMoney ? fmtMoney(r.cur) : r.cur}</span>
                  <span className="text-[9px] text-gray-400">vs</span>
                  <span className="text-[10px] text-gray-500">{r.isMoney ? fmtMoney(r.prev) : r.prev}</span>
                </div>
                <div className="mt-1">
                  {t.dir === 'flat' ? <span className="text-[10px] text-gray-400">KhÃ´ng Ä‘á»•i</span> : (
                    <span className={`text-[10px] font-semibold ${t.dir === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.dir === 'up' ? 'â–²' : 'â–¼'} {t.pct}% ({t.delta > 0 ? '+' : ''}{r.isMoney ? fmtMoney(t.delta) : t.delta})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 3: BOTTLENECK ANALYSIS â•â•â•â•â•â•â•â•â•â• */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Overdue breakdown */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            PhÃ¢n tÃ­ch trá»… háº¡n
          </h4>
          {taskOverdue === 0 ? (
            <div className="text-center py-4"><p className="text-2xl">âœ…</p><p className="text-xs text-gray-500 mt-1">KhÃ´ng cÃ³ task trá»… háº¡n</p></div>
          ) : (
            <div className="space-y-2">
              {[
                { l: '1â€“3 ngÃ y', v: od1to3, c: '#d97706', bg: '#fef3c7' },
                { l: '3â€“7 ngÃ y', v: od3to7, c: '#ea580c', bg: '#ffedd5' },
                { l: '> 7 ngÃ y', v: od7plus, c: '#dc2626', bg: '#fee2e2' },
              ].map(b => (
                <div key={b.l} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16">{b.l}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                    {b.v > 0 && <div className="h-full rounded-md flex items-center justify-center text-[9px] text-white font-bold" style={{ width: `${Math.max((b.v / taskOverdue) * 100, 15)}%`, background: b.c }}>{b.v}</div>}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 mt-1">Tá»•ng: {taskOverdue} task trá»… háº¡n{od7plus > 0 ? ' â€” âš  cÃ³ task trá»… nghiÃªm trá»ng' : ''}</p>
            </div>
          )}
        </div>

        {/* Staff needing attention */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.694 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            NhÃ¢n sá»± cáº§n chÃº Ã½
          </h4>
          {needAttention.length === 0 ? (
            <div className="text-center py-4"><p className="text-2xl">ðŸ‘</p><p className="text-xs text-gray-500 mt-1">Táº¥t cáº£ nhÃ¢n sá»± Ä‘ang on-track</p></div>
          ) : (
            <div className="space-y-2">
              {needAttention.map((e, i) => (
                <div key={e.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: e.avatar_color || '#f3f4f6', color: '#333' }}>{ini(e.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{e.name}</p>
                    <p className="text-[9px] text-gray-400">{e.done}/{e.total} xong Â· {e.rate}%</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-600 flex-shrink-0">{e.overdue} trá»…</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 4: EMPLOYEE EFFICIENCY RANKING â•â•â•â•â•â•â•â•â•â• */}
      {empStats.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Xáº¿p háº¡ng hiá»‡u quáº£ nhÃ¢n sá»± ({empStats.length} ngÆ°á»i)
          </h4>
          <div className="space-y-1.5">
            {empStats.map((e, i) => {
              const rc = e.rate >= 80 ? '#16a34a' : e.rate >= 50 ? '#d97706' : '#dc2626';
              return (
                <div key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-[10px] font-bold text-gray-300 w-5 text-right">#{i + 1}</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold flex-shrink-0" style={{ background: e.avatar_color, color: '#333' }}>{ini(e.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{e.name}</span>
                      <span className="text-[9px] text-gray-400">{e.position}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full" style={{ width: `${e.rate}%`, background: rc }} />
                      </div>
                      <span className="text-[9px] text-gray-400">{e.done}/{e.total}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold w-10 text-right" style={{ color: rc }}>{e.rate}%</span>
                  {e.overdue > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold flex-shrink-0">{e.overdue} trá»…</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 5: Äá»€ XUáº¤T + CHI PHÃ â•â•â•â•â•â•â•â•â•â• */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Proposal summary */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3">Äá» xuáº¥t & PhÃª duyá»‡t</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center"><p className="text-lg font-bold" style={{ color: '#123524' }}>{totalProposals}</p><p className="text-[9px] text-gray-500">Tá»•ng</p></div>
            <div className="bg-gray-50 rounded-xl p-2.5 text-center"><p className="text-lg font-bold text-green-600">{approvalRate}%</p><p className="text-[9px] text-gray-500">Tá»· lá»‡ duyá»‡t</p></div>
          </div>
          {/* Mini donut-like status breakdown */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
              {totalProposals > 0 && totalApproved > 0 && <div className="bg-green-500 h-full" style={{ width: `${(totalApproved / totalProposals) * 100}%` }} />}
              {totalProposals > 0 && totalPending > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(totalPending / totalProposals) * 100}%` }} />}
              {totalProposals > 0 && totalRejected > 0 && <div className="bg-red-400 h-full" style={{ width: `${(totalRejected / totalProposals) * 100}%` }} />}
            </div>
          </div>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" />{totalApproved} duyá»‡t</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" />{totalPending} chá»</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" />{totalRejected} tá»« chá»‘i</span>
          </div>
        </div>

        {/* Cost analysis */}
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3">PhÃ¢n tÃ­ch chi phÃ­</h4>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Tá»•ng chi phÃ­ Ä‘Ã£ duyá»‡t</span>
              <span className="text-sm font-bold" style={{ color: '#123524' }}>{fmtMoney(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">So vá»›i ká»³ trÆ°á»›c</span>
              {(() => { const t = trend(totalCost, prevCost); return t.dir === 'flat' ? <span className="text-[10px] text-gray-400">KhÃ´ng Ä‘á»•i</span> : <span className={`text-[10px] font-semibold ${t.dir === 'up' ? 'text-red-600' : 'text-green-600'}`}>{t.dir === 'up' ? 'â–²' : 'â–¼'} {t.pct}%</span>; })()}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">TB/Ä‘á» xuáº¥t duyá»‡t</span>
              <span className="text-xs font-semibold text-gray-700">{totalApproved > 0 ? fmtMoney(Math.round(totalCost / totalApproved)) : 'â€”'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">TB hoÃ n thÃ nh task</span>
              <span className="text-xs font-semibold text-gray-700">{avgDays} ngÃ y</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category breakdown (enhanced) */}
      {catStats.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3">Äá» xuáº¥t theo loáº¡i</h4>
          <div className="space-y-2.5">
            {catStats.map(cat => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium">{cat.name}</span>
                  <span className="text-[10px] text-gray-400">{cat.total} Â· {fmtMoney(cat.cost)}</span>
                </div>
                <div className="flex h-4 rounded-md overflow-hidden bg-gray-100">
                  {cat.approved > 0 && <div className="bg-green-500 flex items-center justify-center text-[8px] text-white font-bold" style={{ width: `${(cat.approved / maxCatTotal) * 100}%`, minWidth: '16px' }}>{cat.approved}</div>}
                  {cat.pending > 0 && <div className="bg-amber-400 flex items-center justify-center text-[8px] text-white font-bold" style={{ width: `${(cat.pending / maxCatTotal) * 100}%`, minWidth: '16px' }}>{cat.pending}</div>}
                  {cat.rejected > 0 && <div className="bg-red-400 flex items-center justify-center text-[8px] text-white font-bold" style={{ width: `${(cat.rejected / maxCatTotal) * 100}%`, minWidth: '16px' }}>{cat.rejected}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 6: CÃ”NG VIá»†C Tá»”NG QUAN (enhanced) â•â•â•â•â•â•â•â•â•â• */}
      <div className="card p-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-3">Tá»•ng quan cÃ´ng viá»‡c</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {[
            { l: 'Tá»•ng task', v: totalTasks, c: '#1a1a1a' },
            { l: 'HoÃ n thÃ nh', v: taskDone, c: '#16a34a' },
            { l: 'Äang lÃ m', v: taskDoing, c: '#2563eb' },
            { l: 'Chá» pháº£n há»“i', v: taskWaiting, c: '#d97706' },
            { l: 'Trá»… háº¡n', v: taskOverdue, c: '#dc2626' },
          ].map(s => (
            <div key={s.l} className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[9px] text-gray-500">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-20">HoÃ n thÃ nh</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-green-500" style={{ width: `${taskRate}%` }} /></div>
            <span className="text-[10px] font-bold w-9 text-right" style={{ color: taskRate >= 70 ? '#16a34a' : taskRate >= 40 ? '#d97706' : '#dc2626' }}>{taskRate}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-20">ÄÃºng háº¡n</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${onTimeRate}%`, background: onTimeRate >= 80 ? '#2563eb' : '#d97706' }} /></div>
            <span className="text-[10px] font-bold w-9 text-right" style={{ color: onTimeRate >= 80 ? '#2563eb' : '#d97706' }}>{onTimeRate}%</span>
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â• SECTION 7: KHUYáº¾N NGHá»Š AI â•â•â•â•â•â•â•â•â•â• */}
      {insights.length > 0 && (
        <div className="card p-4">
          <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Khuyáº¿n nghá»‹ hÃ nh Ä‘á»™ng
          </h4>
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const bg = ins.sev === 'high' ? 'bg-red-50 border-l-red-500' : ins.sev === 'medium' ? 'bg-amber-50 border-l-amber-500' : 'bg-emerald-50 border-l-emerald-500';
              return (
                <div key={i} className={`p-3 rounded-lg border-l-[3px] ${bg}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm flex-shrink-0">{ins.icon}</span>
                    <p className="text-xs text-gray-700 leading-relaxed">{ins.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AppearanceSection() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bgFile, setBgFile] = useState(null);
  const [loginBgFile, setLoginBgFile] = useState(null);
  const [bannerText, setBannerText] = useState('');
  const [bannerColor, setBannerColor] = useState('#123524');
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#123524');
  const [bgUrl, setBgUrl] = useState('');
  const [loginBgUrl, setLoginBgUrl] = useState('');

  const PRESET_THEMES = [
    { name: 'CCE (máº·c Ä‘á»‹nh)', primary: '#123524', bg: '' },
    { name: 'Lá»… 30/4 - Cá» Viá»‡t Nam', primary: '#DA251D', bg: '', banner: 'ChÃºc má»«ng ngÃ y Giáº£i phÃ³ng 30/4!' , bannerColor: '#DA251D' },
    { name: 'Táº¿t NguyÃªn ÄÃ¡n', primary: '#B8860B', bg: '', banner: 'ChÃºc Má»«ng NÄƒm Má»›i!' , bannerColor: '#B8860B' },
    { name: 'Sinh nháº­t CÃ´ng ty', primary: '#8B5CF6', bg: '', banner: 'Happy Birthday CCE Group!' , bannerColor: '#8B5CF6' },
    { name: 'GiÃ¡ng Sinh', primary: '#DC2626', bg: '', banner: 'Merry Christmas!' , bannerColor: '#166534' },
    { name: 'Quá»‘c táº¿ Phá»¥ ná»¯ 8/3', primary: '#EC4899', bg: '', banner: 'Happy Women\'s Day 8/3!' , bannerColor: '#EC4899' },
  ];

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').eq('key', 'appearance').single();
    if (data) {
      const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      setSettings(v);
      setPrimaryColor(v.primaryColor || '#123524');
      setBgUrl(v.bgUrl || '');
      setLoginBgUrl(v.loginBgUrl || '');
      setBannerText(v.bannerText || '');
      setBannerColor(v.bannerColor || '#123524');
      setBannerEnabled(v.bannerEnabled || false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    const value = { primaryColor, bgUrl, loginBgUrl, bannerText, bannerColor, bannerEnabled };
    await supabase.from('app_settings').upsert({ key: 'appearance', value }, { onConflict: 'key' });
    toast('ÄÃ£ lÆ°u giao diá»‡n!', 'success');
    setSaving(false);
    window.location.reload();
  }

  async function uploadBg(file, type) {
    if (!file) return;
    setUploading(true);
    // Sanitize filename: remove Vietnamese chars, spaces, special chars
    const safeName = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/Ä‘/g, 'd').replace(/Ä/g, 'D')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
    const path = `appearance/${type}_${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file);
    if (error) { toast('Lá»—i upload: ' + error.message, 'error'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
    if (type === 'bg') setBgUrl(publicUrl);
    else setLoginBgUrl(publicUrl);
    toast('ÄÃ£ upload áº£nh!', 'success');
    setUploading(false);
  }

  function applyPreset(preset) {
    setPrimaryColor(preset.primary);
    if (preset.banner) { setBannerText(preset.banner); setBannerEnabled(true); }
    if (preset.bannerColor) setBannerColor(preset.bannerColor);
    toast('ÄÃ£ Ã¡p dá»¥ng theme: ' + preset.name, 'info');
  }

  return (
    <div>
      <h3 className="font-semibold text-sm mb-4">TÃ¹y chá»‰nh giao diá»‡n</h3>

      {/* Preset themes */}
      <div className="mb-6">
        <p className="text-xs font-medium text-gray-600 mb-2">Theme cÃ³ sáºµn (báº¥m chá»n)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_THEMES.map(t => (
            <button key={t.name} onClick={() => applyPreset(t)}
              className="card p-3 text-left hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: t.primary }} />
                <span className="text-xs font-medium">{t.name}</span>
              </div>
              {t.banner && <p className="text-[10px] text-gray-400 truncate">{t.banner}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Primary color */}
      <div className="card p-4 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">MÃ u chá»§ Ä‘áº¡o</p>
        <div className="flex items-center gap-3">
          <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border-0" />
          <input className="input-field !text-sm !w-32" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
          <div className="flex gap-1">
            {['#123524', '#DA251D', '#B8860B', '#8B5CF6', '#EC4899', '#2563eb', '#DC2626'].map(c => (
              <button key={c} onClick={() => setPrimaryColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{ background: c, borderColor: primaryColor === c ? '#000' : 'transparent' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-600">Banner thÃ´ng bÃ¡o</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[10px] text-gray-400">{bannerEnabled ? 'Báº­t' : 'Táº¯t'}</span>
            <div className="relative w-9 h-5 rounded-full transition-colors" style={{ background: bannerEnabled ? '#123524' : '#d1d5db' }}
              onClick={() => setBannerEnabled(!bannerEnabled)}>
              <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: bannerEnabled ? '18px' : '2px' }} />
            </div>
          </label>
        </div>
        {bannerEnabled && (
          <div className="space-y-2">
            <input className="input-field !text-sm" placeholder="Ná»™i dung banner, VD: ChÃºc má»«ng 30/4!"
              value={bannerText} onChange={e => setBannerText(e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">MÃ u banner:</span>
              <input type="color" value={bannerColor} onChange={e => setBannerColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
            </div>
            {bannerText && (
              <div className="rounded-lg p-2.5 text-center text-xs font-semibold text-white" style={{ background: bannerColor }}>
                {bannerText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Background images */}
      <div className="card p-4 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">áº¢nh ná»n Dashboard</p>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={e => setBgFile(e.target.files[0])}
            className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100" />
          <button onClick={() => uploadBg(bgFile, 'bg')} disabled={!bgFile || uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>
            {uploading ? 'Äang táº£i...' : 'Upload'}
          </button>
          {bgUrl && <button onClick={() => setBgUrl('')} className="text-xs text-red-500">XÃ³a</button>}
        </div>
        {bgUrl && <img src={bgUrl} alt="bg" className="mt-2 rounded-lg h-20 object-cover w-full" />}
      </div>

      <div className="card p-4 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">áº¢nh ná»n trang ÄÄƒng nháº­p</p>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={e => setLoginBgFile(e.target.files[0])}
            className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100" />
          <button onClick={() => uploadBg(loginBgFile, 'login')} disabled={!loginBgFile || uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>
            {uploading ? 'Äang táº£i...' : 'Upload'}
          </button>
          {loginBgUrl && <button onClick={() => setLoginBgUrl('')} className="text-xs text-red-500">XÃ³a</button>}
        </div>
        {loginBgUrl && <img src={loginBgUrl} alt="login bg" className="mt-2 rounded-lg h-20 object-cover w-full" />}
      </div>

      {/* Save button */}
      <button onClick={saveSettings} disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: primaryColor }}>
        {saving ? 'Äang lÆ°u...' : 'LÆ°u thay Ä‘á»•i giao diá»‡n'}
      </button>

      <p className="text-[10px] text-gray-400 mt-2 text-center">Sau khi lÆ°u, trang sáº½ tá»± refresh Ä‘á»ƒ Ã¡p dá»¥ng giao diá»‡n má»›i</p>
    </div>
  );
}
