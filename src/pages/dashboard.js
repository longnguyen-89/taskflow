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
import SearchModal from '@/components/SearchModal';

export default function Dashboard() {
  const { user, profile, loading: authLoading, signOut, isAdmin, isDirector, isAccountant, canApprove } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [dept, setDept] = useState('nail');
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [taskGroups, setTaskGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [appearance, setAppearance] = useState({ primaryColor: '#2D5A3D', bgUrl: '', bannerText: '', bannerColor: '#2D5A3D', bannerEnabled: false });

  // Load appearance settings
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'appearance').single().then(({ data }) => {
      if (data) {
        const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setAppearance(prev => ({ ...prev, ...v }));
      }
    });
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', show: true },
    { id: 'create', label: 'Giao task', icon: 'M12 4v16m8-8H4', show: isAdmin },
    { id: 'proposals', label: 'Đề xuất', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', show: true },
    { id: 'performance', label: 'Đánh giá', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', show: true },
    { id: 'notifications', label: 'Thông báo', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', show: true },
    { id: 'admin', label: 'Quản trị', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', show: isDirector },
  ].filter(t => t.show);

  const fetchData = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);

    // Tasks: director sees all in dept, admin sees all in dept, member sees only assigned+watched
    let taskQuery = supabase.from('tasks').select(`
      *, creator:profiles!tasks_created_by_fkey(id, name, avatar_color, position),
      assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position)),
      watchers:task_watchers(user_id, user:profiles!task_watchers_user_id_fkey(id, name, avatar_color))
    `).eq('department', dept).order('created_at', { ascending: false });

    const { data: allTasks } = await taskQuery;

    // Filter for members: only see tasks assigned to them or watching
    let filtered = allTasks || [];
    if (!isAdmin && !isAccountant) {
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
  }, [user, profile, dept, isAdmin, isAccountant]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/'); return; }
    fetchData();
    // Register push notifications
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

  const approvedTasks = tasks.filter(t => t.approval_status !== 'pending');
  const stats = {
    total: approvedTasks.length,
    doing: approvedTasks.filter(t => t.status === 'doing').length,
    done: approvedTasks.filter(t => t.status === 'done').length,
    waiting: approvedTasks.filter(t => t.status === 'waiting').length,
    overdue: approvedTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length,
  };

  const getInitials = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const ROLE_LABELS = { director: 'Tổng GĐ', admin: 'Quản lý', accountant: 'Kế toán', member: 'Nhân viên' };

  const pc = appearance.primaryColor || '#2D5A3D';

  return (
    <div className="min-h-screen" style={{ background: appearance.bgUrl ? `url(${appearance.bgUrl}) center/cover fixed` : '#F8F7F4' }}>
      {/* Event Banner */}
      {appearance.bannerEnabled && appearance.bannerText && (
        <div className="text-center py-2 text-xs font-semibold text-white" style={{ background: appearance.bannerColor || pc }}>
          {appearance.bannerText}
        </div>
      )}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Brand logo */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #2D5A3D, #4A7C5C)' }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-base" style={{ color: '#2D5A3D' }}>CCE - TasksFlow</h1>

          {/* Dept switcher */}
          <div className="flex ml-3 p-0.5 rounded-lg" style={{ background: '#f0ebe4' }}>
            {[{ id: 'nail', l: 'Nail' }, { id: 'hotel', l: 'Hotel' }].map(d => (
              <button key={d.id} onClick={() => setDept(d.id)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${dept === d.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>{d.l}</button>
            ))}
          </div>

          <div className="flex-1" />

          <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-500 hover:bg-gray-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Tìm kiếm <kbd className="hidden sm:inline px-1 py-0.5 bg-white rounded text-[10px] text-gray-400 border">Ctrl+K</kbd>
          </button>

          <span className="px-2 py-1 rounded-md text-[10px] font-semibold" style={{ background: '#e8f5ee', color: '#2D5A3D' }}>{ROLE_LABELS[profile.role]}</span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: profile.avatar_color, color: '#333' }}>{getInitials(profile.name)}</div>
          <button onClick={signOut} className="text-gray-400 hover:text-gray-600" title="Đăng xuất">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-100 sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 flex gap-0.5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
            <TaskList tasks={approvedTasks} members={members} isAdmin={isAdmin} userId={user.id} onRefresh={fetchData} />
          </div>
        )}
        {tab === 'create' && isAdmin && <CreateTask members={members.filter(m => m.department === dept || m.role === 'accountant' || m.role === 'director')} userId={user.id} userName={profile.name} department={dept} taskGroups={taskGroups} onCreated={() => { fetchData(); setTab('dashboard'); }} />}
        {tab === 'proposals' && <Proposals userId={user.id} userName={profile.name} members={members} department={dept} isDirector={isDirector} canApprove={canApprove} />}
        {tab === 'performance' && <Performance tasks={tasks} members={members} department={dept} userId={user.id} profile={profile} isAdmin={isAdmin} isDirector={isDirector} />}
        {tab === 'notifications' && <Notifications notifications={notifications} userId={user.id} onRefresh={fetchData} />}
        {tab === 'admin' && isDirector && <AdminPanel members={members} department={dept} onRefresh={fetchData} />}
      </main>

      {showSearch && <SearchModal tasks={tasks} onClose={() => setShowSearch(false)} onSelect={() => { setShowSearch(false); setTab('dashboard'); }} />}
    </div>
  );
}
