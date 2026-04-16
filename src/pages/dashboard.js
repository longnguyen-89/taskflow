import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerPush } from '@/lib/push';
import TaskList from '@/components/TaskList';
import CreateTask from '@/components/CreateTask';
import Performance from '@/components/Performance';
import Notifications from '@/components/Notifications';
import Proposals from '@/components/Proposals';
import AdminPanel from '@/components/AdminPanel';
import RecurringTasks from '@/components/RecurringTasks';
import SearchModal from '@/components/SearchModal';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';

export default function Dashboard() {
  const { user, profile, loading: authLoading, signOut, isAdmin, isDirector, isAccountant, canApprove } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const canViewAll = isDirector || isAccountant;
  const [dept, setDept] = useState('nail');
  // branch: chi nhánh đang xem (chỉ áp dụng khi dept='nail'). null = tất cả chi nhánh user có quyền.
  const [branch, setBranch] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [taskGroups, setTaskGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [appearance, setAppearance] = useState({ primaryColor: '#2D5A3D', bgUrl: '', bannerText: '', bannerColor: '#2D5A3D', bannerEnabled: false });
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [focusProposalId, setFocusProposalId] = useState(null);

  // Khi click vào 1 thông báo -> chuyển tab & focus vào task/proposal tương ứng.
  const handleOpenNotification = useCallback(async (n) => {
    if (!n) return;
    if (n.task_id) {
      // Lấy task để biết department/branch rồi chuyển tab Dashboard + focus.
      const { data: tk } = await supabase.from('tasks').select('id, department, branch, parent_id').eq('id', n.task_id).maybeSingle();
      if (tk) {
        if (tk.department && tk.department !== dept) setDept(tk.department);
        if (tk.department === 'nail' && tk.branch && canViewAll) setBranch(tk.branch);
        // Nếu là sub-task, focus vào parent.
        setFocusTaskId(tk.parent_id || tk.id);
        setTab('dashboard');
      } else {
        setFocusTaskId(n.task_id);
        setTab('dashboard');
      }
    } else if (n.proposal_id) {
      const { data: pr } = await supabase.from('proposals').select('id, department, branch').eq('id', n.proposal_id).maybeSingle();
      if (pr) {
        if (pr.department && pr.department !== dept) setDept(pr.department);
        if (pr.department === 'nail' && pr.branch && canViewAll) setBranch(pr.branch);
        setFocusProposalId(pr.id);
        setTab('proposals');
      } else {
        setFocusProposalId(n.proposal_id);
        setTab('proposals');
      }
    }
  }, [dept, canViewAll]);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'appearance').single().then(({ data }) => {
      if (data) {
        const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setAppearance(prev => ({ ...prev, ...v }));
      }
    });
  }, []);

  useEffect(() => {
    if (profile && !canViewAll) {
      setDept(profile.department || 'nail');
    }
  }, [profile, canViewAll]);

  // Xác định danh sách chi nhánh user được phép xem (cho Nail).
  // - TGĐ/Kế toán: cả 4 chi nhánh
  // - Quản lý (admin): các chi nhánh được gán trong profile.branches
  // - Nhân viên: 1 chi nhánh trong profile.branches
  const allowedBranches = (canViewAll
    ? NAIL_BRANCHES.map(b => b.id)
    : (Array.isArray(profile?.branches) ? profile.branches : [])
  );
  // Khi profile load xong, nếu user chỉ có 1 chi nhánh → auto chọn. Nếu nhiều → để null (all).
  useEffect(() => {
    if (!profile) return;
    if (dept !== 'nail') { setBranch(null); return; }
    if (!canViewAll && allowedBranches.length === 1) setBranch(allowedBranches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dept, canViewAll]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', show: true },
    { id: 'create', label: 'Giao task', icon: 'M12 4v16m8-8H4', show: isAdmin },
    { id: 'recurring', label: 'Lặp lại', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', show: isAdmin },
    { id: 'proposals', label: 'Đề xuất', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', show: true },
    { id: 'performance', label: 'Đánh giá', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', show: true },
    { id: 'notifications', label: 'Thông báo', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', show: true },
    { id: 'admin', label: 'Quản trị', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', show: isDirector },
  ].filter(t => t.show);

  const fetchData = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);

    let taskQuery = supabase.from('tasks').select(`
      *, creator:profiles!tasks_created_by_fkey(id, name, avatar_color, position),
      assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position)),
      watchers:task_watchers(user_id, user:profiles!task_watchers_user_id_fkey(id, name, avatar_color)),
      files:task_files(*)
    `).eq('department', dept).order('created_at', { ascending: false });

    const { data: allTasks } = await taskQuery;

    let filtered = allTasks || [];

    // Lọc theo chi nhánh (chỉ áp dụng cho Nail).
    if (dept === 'nail') {
      if (branch) {
        // Tab cụ thể: chỉ lấy task thuộc chi nhánh đang chọn.
        filtered = filtered.filter(t => t.branch === branch);
      } else if (!canViewAll) {
        // Admin xem "tất cả": giới hạn trong các chi nhánh được gán.
        const allowed = Array.isArray(profile?.branches) ? profile.branches : [];
        if (allowed.length > 0) {
          filtered = filtered.filter(t => t.branch && allowed.includes(t.branch));
        }
      }
    }

    // Lọc theo vai trò:
    // - TGĐ / Kế toán: thấy toàn bộ (trong phạm vi dept/branch đã lọc)
    // - Quản lý (admin): thấy toàn bộ task trong các chi nhánh mình phụ trách
    // - Nhân viên (member): chỉ thấy task liên quan đến mình (assignee, watcher, creator)
    if (!isDirector && !isAccountant && profile?.role === 'member') {
      filtered = filtered.filter(t =>
        t.assignees?.some(a => a.user_id === user.id) ||
        t.watchers?.some(w => w.user_id === user.id) ||
        t.created_by === user.id
      );
    }
    setTasks(filtered);

    const { data: allMembers } = await supabase.from('profiles').select('*').order('name');
    setMembers(allMembers || []);

    const { data: groups } = await supabase.from('task_groups').select('*').eq('department', dept).order('name');
    setTaskGroups(groups || []);

    const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    setNotifications(notifs || []);
    setUnreadCount(notifs?.filter(n => !n.read).length || 0);

    setLoading(false);
  }, [user, profile, dept, branch, isDirector, isAccountant, canViewAll]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    fetchData();
    registerPush(user.id).catch(() => {});
  }, [user, authLoading, profile, router, fetchData]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchData]);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  if (authLoading || !profile) return <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]"><div className="animate-pulse text-gray-400">Đang tải...</div></div>;

  // Stats only count parent tasks (not sub-tasks)
  const parentTasks = tasks.filter(t => !t.parent_id && t.approval_status !== 'pending');
  const stats = {
    total: parentTasks.length,
    doing: parentTasks.filter(t => t.status === 'doing').length,
    done: parentTasks.filter(t => t.status === 'done').length,
    waiting: parentTasks.filter(t => t.status === 'waiting').length,
    overdue: parentTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length,
  };

  const approvedTasks = tasks.filter(t => t.approval_status !== 'pending');

  const getInitials = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const ROLE_LABELS = { director: 'Tổng GĐ', admin: 'Quản lý', accountant: 'Kế toán', member: 'Nhân viên' };

  const pc = appearance.primaryColor || '#2D5A3D';

  return (
    <div className="min-h-screen" style={{ background: appearance.bgUrl ? `url(${appearance.bgUrl}) center/cover fixed` : '#F8F7F4' }}>
      {appearance.bannerEnabled && appearance.bannerText && (
        <div className="text-center py-2 text-xs font-semibold text-white" style={{ background: appearance.bannerColor || pc }}>
          {appearance.bannerText}
        </div>
      )}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2D5A3D, #4A7C5C)' }}>
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-sm sm:text-base truncate" style={{ color: '#2D5A3D' }}>
            <span className="hidden sm:inline">CCE - </span>TasksFlow
          </h1>

          {/* Nail/Hotel — pills (desktop + mobile, vẫn đủ gọn) */}
          {canViewAll ? (
            <div className="flex ml-1 sm:ml-3 p-0.5 rounded-lg flex-shrink-0" style={{ background: '#f0ebe4' }}>
              {[{ id: 'nail', l: 'Nail' }, { id: 'hotel', l: 'Hotel' }].map(d => (
                <button key={d.id} onClick={() => { setDept(d.id); setBranch(null); }}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${dept === d.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{d.l}</button>
              ))}
            </div>
          ) : (
            <span className="ml-1 sm:ml-3 px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-white shadow-sm text-gray-700 flex-shrink-0">{dept === 'hotel' ? 'Hotel' : 'Nail'}</span>
          )}

          {/* Branch switcher — desktop pills */}
          {dept === 'nail' && allowedBranches.length > 1 && (
            <div className="hidden md:flex p-0.5 rounded-lg ml-1" style={{ background: '#f0ebe4' }}>
              {canViewAll && (
                <button onClick={() => setBranch(null)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${branch === null ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  Tất cả
                </button>
              )}
              {NAIL_BRANCHES.filter(b => allowedBranches.includes(b.id)).map(b => (
                <button key={b.id} onClick={() => setBranch(b.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${branch === b.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
          {/* Branch switcher — mobile dropdown (gọn, tiết kiệm diện tích) */}
          {dept === 'nail' && allowedBranches.length > 1 && (
            <select
              value={branch || ''}
              onChange={e => setBranch(e.target.value || null)}
              className="md:hidden ml-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white shadow-sm text-gray-800 border border-gray-200 flex-shrink-0 max-w-[110px] focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Chọn chi nhánh"
            >
              {canViewAll && <option value="">Tất cả CN</option>}
              {NAIL_BRANCHES.filter(b => allowedBranches.includes(b.id)).map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          )}
          {dept === 'nail' && !canViewAll && allowedBranches.length === 1 && (
            <span className="ml-1 px-2 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 flex-shrink-0">
              {branchLabel(allowedBranches[0])}
            </span>
          )}

          <div className="flex-1" />

          {/* Search: icon-only trên mobile */}
          <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-500 hover:bg-gray-200 flex-shrink-0" title="Tìm kiếm">
            <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="hidden sm:inline">Tìm kiếm</span>
            <kbd className="hidden lg:inline px-1 py-0.5 bg-white rounded text-[10px] text-gray-400 border">Ctrl+K</kbd>
          </button>

          <span className="hidden sm:inline px-2 py-1 rounded-md text-[10px] font-semibold flex-shrink-0" style={{ background: '#e8f5ee', color: '#2D5A3D' }}>{ROLE_LABELS[profile.role]}</span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: profile.avatar_color, color: '#333' }} title={profile.name + ' · ' + ROLE_LABELS[profile.role]}>{getInitials(profile.name)}</div>
          <button onClick={signOut} className="text-gray-400 hover:text-gray-600 flex-shrink-0" title="Đăng xuất">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-100 sticky top-12 sm:top-14 z-30">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 flex gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab === t.id ? { borderBottomColor: '#2D5A3D' } : {}}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
              {t.label}
              {t.id === 'notifications' && unreadCount > 0 && <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">{unreadCount}</span>}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {tab === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              {[
                { l: 'Tổng', v: stats.total, c: '#1a1a1a' },
                { l: 'Đang làm', v: stats.doing, c: '#2563eb' },
                { l: 'Hoàn thành', v: stats.done, c: '#16a34a' },
                { l: 'Chờ phản hồi', v: stats.waiting, c: '#d97706' },
                { l: 'Trễ hạn', v: stats.overdue, c: '#dc2626' },
              ].map(s => (
                <div key={s.l} className="bg-white rounded-2xl p-3.5 border border-gray-100">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.l}</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: s.c }}>{s.v}</p>
                </div>
              ))}
            </div>
            <TaskList tasks={approvedTasks} members={members} isAdmin={isDirector || isAccountant} isDirector={isDirector} userId={user.id} onRefresh={fetchData} department={dept} currentUserRole={profile?.role} currentUserName={profile?.name} focusTaskId={focusTaskId} clearFocus={() => setFocusTaskId(null)} />
          </div>
        )}
        {tab === 'create' && isAdmin && <CreateTask members={members.filter(m => m.department === dept || m.role === 'accountant' || m.role === 'director')} userId={user.id} userName={profile.name} department={dept} branch={branch} allowedBranches={allowedBranches} canViewAll={canViewAll} taskGroups={taskGroups} onCreated={() => { fetchData(); setTab('dashboard'); }} />}
        {tab === 'proposals' && <Proposals userId={user.id} userName={profile.name} members={members} department={dept} branch={branch} allowedBranches={allowedBranches} canViewAll={canViewAll} profile={profile} isDirector={isDirector} isAccountant={isAccountant} canApprove={canApprove} focusProposalId={focusProposalId} clearFocus={() => setFocusProposalId(null)} />}
        {tab === 'performance' && <Performance tasks={tasks} members={members} department={dept} userId={user.id} profile={profile} isAdmin={isDirector || isAccountant} isDirector={isDirector} />}
        {tab === 'notifications' && <Notifications notifications={notifications} userId={user.id} onRefresh={fetchData} onOpen={handleOpenNotification} />}
        {tab === 'admin' && isDirector && <AdminPanel members={members} department={dept} onRefresh={fetchData} />}
        {tab === 'recurring' && isAdmin && <RecurringTasks members={members} department={dept} userId={user.id} taskGroups={taskGroups} />}
      </main>

      {showSearch && <SearchModal tasks={tasks} onClose={() => setShowSearch(false)} onSelect={() => { setShowSearch(false); setTab('dashboard'); }} />}
    </div>
  );
}
