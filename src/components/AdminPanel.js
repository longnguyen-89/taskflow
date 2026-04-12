import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/contexts/AuthContext';

const POSITIONS = ['Quản lý', 'Kỹ thuật viên', 'Lễ tân', 'Kế toán', 'Buồng phòng', 'Bảo vệ'];
const ROLES = [
  { v: 'director', l: 'Tổng Giám đốc', d: 'Toàn quyền hệ thống, quản trị, phân quyền', c: '#2D5A3D' },
  { v: 'admin', l: 'Quản lý', d: 'Tạo task, xem đánh giá, duyệt đề xuất, nhận task từ TGĐ', c: '#2563eb' },
  { v: 'accountant', l: 'Kế toán', d: 'Duyệt đề xuất, xem lịch sử lệnh, cả 2 đơn vị', c: '#d97706' },
  { v: 'member', l: 'Nhân viên', d: 'Xem task, cập nhật trạng thái, tạo đề xuất', c: '#6b7280' },
];
const COLORS = ['#E6F1FB', '#E1F5EE', '#FAEEDA', '#EEEDFE', '#FAECE7', '#FBEAF0', '#EAF3DE', '#F1EFE8'];

const MENU = [
  { id: 'users', label: 'Tài khoản & Phân quyền', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { id: 'groups', label: 'Nhóm công việc', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'categories', label: 'Loại đề xuất', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { id: 'reports', label: 'Báo cáo', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

export default function AdminPanel({ members, department, onRefresh }) {
  const [section, setSection] = useState('users');
  const { createUser } = useAuth();

  return (
    <div className="animate-fade-in">
      <h2 className="font-display font-bold text-lg mb-4" style={{ color: '#2D5A3D' }}>Quản trị hệ thống</h2>

      {/* Sub-menu */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {MENU.map(m => (
          <button key={m.id} onClick={() => setSection(m.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
              section === m.id ? 'bg-white shadow-sm border-gray-200 text-gray-900' : 'border-transparent text-gray-500 hover:bg-white/50'
            }`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={m.icon} /></svg>
            {m.label}
          </button>
        ))}
      </div>

      {section === 'users' && <UsersSection members={members} department={department} createUser={createUser} onRefresh={onRefresh} />}
      {section === 'groups' && <GroupsSection department={department} onRefresh={onRefresh} />}
      {section === 'categories' && <CategoriesSection />}
      {section === 'reports' && <ReportsSection department={department} />}
    </div>
  );
}

function UsersSection({ members, department, createUser, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [position, setPosition] = useState('Kỹ thuật viên');
  const [userDept, setUserDept] = useState(department);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');

  function reset() { setName(''); setEmail(''); setPassword(''); setRole('member'); setPosition('Kỹ thuật viên'); setUserDept(department); setShowForm(false); setEditId(null); }

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return toast('Điền đầy đủ', 'error');
    if (password.length < 6) return toast('Mật khẩu tối thiểu 6 ký tự', 'error');
    setSubmitting(true);
    const { error } = await createUser(email.trim(), password, name.trim(), role, position, userDept);
    if (error) { toast('Lỗi: ' + error.message, 'error'); setSubmitting(false); return; }
    toast(`Đã tạo tài khoản ${name}!`, 'success'); reset(); setSubmitting(false); onRefresh();
  }

  async function handleUpdate() {
    setSubmitting(true);
    const { error } = await supabase.from('profiles').update({ role, position, department: userDept }).eq('id', editId);
    if (error) toast('Lỗi: ' + error.message, 'error');
    else { toast('Đã cập nhật!', 'success'); reset(); onRefresh(); }
    setSubmitting(false);
  }

  function startEdit(m) { setEditId(m.id); setName(m.name); setEmail(m.email); setRole(m.role); setPosition(m.position || ''); setUserDept(m.department || 'nail'); setShowForm(true); }
  const getInitials = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const filtered = filter === 'all' ? members : members.filter(m => m.department === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['all', 'nail', 'hotel'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white shadow-sm border border-gray-200' : 'text-gray-500'}`}>
              {f === 'all' ? 'Tất cả' : f === 'nail' ? 'Nail' : 'Hotel'} ({(f === 'all' ? members : members.filter(m => m.department === f)).length})
            </button>
          ))}
        </div>
        {!showForm && <button onClick={() => { reset(); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>+ Tạo tài khoản</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-5 animate-slide-up">
          <h3 className="font-semibold text-sm mb-4">{editId ? `Sửa: ${name}` : 'Tạo tài khoản mới'}</h3>
          <form onSubmit={editId ? (e) => { e.preventDefault(); handleUpdate(); } : handleAdd} className="space-y-3">
            {!editId && (
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Họ tên *</label><input className="input-field !text-sm" value={name} onChange={e => setName(e.target.value)} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" className="input-field !text-sm" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Mật khẩu *</label><input type="text" className="input-field !text-sm" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vai trò</label>
                <select className="input-field !text-sm" value={role} onChange={e => setRole(e.target.value)}>
                  {ROLES.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Đơn vị</label>
                <select className="input-field !text-sm" value={userDept} onChange={e => setUserDept(e.target.value)}>
                  <option value="nail">Nail</option><option value="hotel">Hotel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vị trí</label>
                <select className="input-field !text-sm" value={position} onChange={e => setPosition(e.target.value)}>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            {/* Role description */}
            <div className="p-2.5 rounded-lg text-xs text-gray-600 leading-relaxed" style={{ background: '#f0ebe4' }}>
              {ROLES.find(r => r.v === role)?.d}
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#2D5A3D' }}>{submitting ? 'Đang xử lý...' : (editId ? 'Cập nhật' : 'Tạo tài khoản')}</button>
              <button type="button" onClick={reset} className="btn-secondary !text-xs">Hủy</button>
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
              <span className="text-[10px] text-gray-400">{m.position}</span>
              <button onClick={() => startEdit(m)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupsSection({ department, onRefresh }) {
  const [groups, setGroups] = useState([]);
  const [newName, setNewName] = useState('');
  const { user } = useAuth();

  useEffect(() => { fetch(); }, [department]);
  async function fetch() {
    const { data } = await supabase.from('task_groups').select('*').eq('department', department).order('name');
    setGroups(data || []);
  }
  async function addGroup() {
    if (!newName.trim()) return;
    await supabase.from('task_groups').insert({ name: newName.trim(), department, created_by: user.id });
    setNewName(''); toast('Đã tạo nhóm!', 'success'); fetch(); onRefresh();
  }
  async function deleteGroup(id) {
    await supabase.from('task_groups').delete().eq('id', id);
    toast('Đã xóa!', 'success'); fetch(); onRefresh();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input className="input-field !text-sm flex-1" placeholder="Tên nhóm mới..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()} />
        <button onClick={addGroup} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>Thêm</button>
      </div>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="card p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{g.name}</span>
            <button onClick={() => deleteGroup(g.id)} className="text-red-400 hover:text-red-600 text-xs">Xóa</button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Chưa có nhóm nào</p>}
      </div>
    </div>
  );
}

function CategoriesSection() {
  const [cats, setCats] = useState([]);
  const [newName, setNewName] = useState('');
  const { user } = useAuth();

  useEffect(() => { fetch(); }, []);
  async function fetch() {
    const { data } = await supabase.from('proposal_categories').select('*').order('name');
    setCats(data || []);
  }
  async function addCat() {
    if (!newName.trim()) return;
    await supabase.from('proposal_categories').insert({ name: newName.trim(), created_by: user.id });
    setNewName(''); toast('Đã thêm!', 'success'); fetch();
  }
  async function deleteCat(id) {
    await supabase.from('proposal_categories').delete().eq('id', id);
    toast('Đã xóa!', 'success'); fetch();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input className="input-field !text-sm flex-1" placeholder="Tên loại đề xuất mới..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} />
        <button onClick={addCat} className="px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: '#2D5A3D' }}>Thêm</button>
      </div>
      <div className="space-y-2">
        {cats.map(c => (
          <div key={c.id} className="card p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{c.name}</span>
            <button onClick={() => deleteCat(c.id)} className="text-red-400 hover:text-red-600 text-xs">Xóa</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsSection({ department }) {
  const [proposals, setProposals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchReport(); }, [department, period, dateFrom, dateTo]);

  async function fetchReport() {
    const now = new Date();
    let start;
    if (dateFrom && dateTo) { start = new Date(dateFrom); }
    else if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
    else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
    else { start = new Date(now.getFullYear(), 0, 1); }

    let pq = supabase.from('proposals').select('*').eq('department', department).gte('created_at', start.toISOString());
    if (dateTo) pq = pq.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data: p } = await pq;
    setProposals(p || []);

    let tq = supabase.from('tasks').select('*').eq('department', department).gte('created_at', start.toISOString());
    if (dateTo) tq = tq.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data: t } = await tq;
    setTasks(t || []);

    const { data: cats } = await supabase.from('proposal_categories').select('*').order('name');
    setCategories(cats || []);
  }

  const catStats = categories.map(cat => {
    const items = proposals.filter(p => p.category_name === cat.name);
    const approved = items.filter(p => p.status === 'approved');
    const pending = items.filter(p => p.status === 'pending' || p.status === 'partial');
    const rejected = items.filter(p => p.status === 'rejected');
    const totalCost = approved.reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);
    return { name: cat.name, total: items.length, approved: approved.length, pending: pending.length, rejected: rejected.length, totalCost };
  }).filter(c => c.total > 0);

  const totalProposals = proposals.length;
  const totalApproved = proposals.filter(p => p.status === 'approved').length;
  const totalPending = proposals.filter(p => p.status === 'pending' || p.status === 'partial').length;
  const totalCost = proposals.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);

  const totalTasks = tasks.length;
  const taskDone = tasks.filter(t => t.status === 'done').length;
  const taskDoing = tasks.filter(t => t.status === 'doing').length;
  const taskOverdue = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length;
  const taskRate = totalTasks > 0 ? Math.round((taskDone / totalTasks) * 100) : 0;

  const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
  const maxCatTotal = Math.max(...catStats.map(c => c.total), 1);

  return (
    <div>
      <h3 className="font-semibold text-sm mb-4">Báo cáo tổng quan — {department === 'hotel' ? 'Hotel' : 'Nail'}</h3>

      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {['week', 'month', 'quarter', 'year'].map(p => (
          <button key={p} onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p && !dateFrom ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`}
            style={period === p && !dateFrom ? { background: '#2D5A3D' } : {}}>
            {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Năm'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-1">hoặc</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center"><p className="text-2xl font-bold" style={{ color: '#2D5A3D' }}>{totalProposals}</p><p className="text-[10px] text-gray-500 mt-1">Tổng đề xuất</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-green-600">{totalApproved}</p><p className="text-[10px] text-gray-500 mt-1">Đã duyệt</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-amber-600">{totalPending}</p><p className="text-[10px] text-gray-500 mt-1">Chờ duyệt</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold" style={{ color: '#2D5A3D' }}>{fmtMoney(totalCost)}</p><p className="text-[10px] text-gray-500 mt-1">Tổng chi phí duyệt</p></div>
      </div>

      {/* Category breakdown with bar chart */}
      <div className="card p-5 mb-6">
        <h4 className="text-sm font-semibold mb-4">Đề xuất theo loại</h4>
        {catStats.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Chưa có dữ liệu</p> : (
          <div className="space-y-3">
            {catStats.map(cat => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{cat.name}</span>
                  <span className="text-[10px] text-gray-400">{cat.total} đề xuất · {fmtMoney(cat.totalCost)}</span>
                </div>
                <div className="flex h-5 rounded-lg overflow-hidden bg-gray-100">
                  {cat.approved > 0 && <div className="bg-green-500 flex items-center justify-center text-[9px] text-white font-semibold" style={{ width: `${(cat.approved / maxCatTotal) * 100}%`, minWidth: '20px' }}>{cat.approved}</div>}
                  {cat.pending > 0 && <div className="bg-amber-400 flex items-center justify-center text-[9px] text-white font-semibold" style={{ width: `${(cat.pending / maxCatTotal) * 100}%`, minWidth: '20px' }}>{cat.pending}</div>}
                  {cat.rejected > 0 && <div className="bg-red-400 flex items-center justify-center text-[9px] text-white font-semibold" style={{ width: `${(cat.rejected / maxCatTotal) * 100}%`, minWidth: '20px' }}>{cat.rejected}</div>}
                </div>
              </div>
            ))}
            <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> Duyệt</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Chờ</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400" /> Từ chối</span>
            </div>
          </div>
        )}
      </div>

      {/* Task overview */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold mb-4">Tổng quan công việc</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{totalTasks}</p><p className="text-[9px] text-gray-500">Tổng task</p></div>
          <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-green-600">{taskDone}</p><p className="text-[9px] text-gray-500">Hoàn thành</p></div>
          <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-blue-600">{taskDoing}</p><p className="text-[9px] text-gray-500">Đang làm</p></div>
          <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold text-red-600">{taskOverdue}</p><p className="text-[9px] text-gray-500">Trễ hạn</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-24">Tỷ lệ hoàn thành</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${taskRate}%`, background: taskRate >= 70 ? '#16a34a' : taskRate >= 40 ? '#d97706' : '#dc2626' }} />
          </div>
          <span className="text-sm font-bold w-12 text-right" style={{ color: taskRate >= 70 ? '#16a34a' : taskRate >= 40 ? '#d97706' : '#dc2626' }}>{taskRate}%</span>
        </div>
      </div>
    </div>
  );
}
