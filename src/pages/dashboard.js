import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerPush } from '@/lib/push';
import TaskList from '@/components/TaskList';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTask from '@/components/CreateTask';
import Performance from '@/components/Performance';
import Notifications from '@/components/Notifications';
import MyTasks from '@/components/MyTasks';
import Proposals from '@/components/Proposals';
import AdminPanel from '@/components/AdminPanel';
import RecurringTasks from '@/components/RecurringTasks';
import SearchModal from '@/components/SearchModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import TaskDetailModal from '@/components/TaskDetailModal';
import { toast } from '@/components/Toaster';
import { NAIL_BRANCHES, branchLabel, loadBranches } from '@/lib/branches';

export default function Dashboard() {
  const { user, profile, loading: authLoading, signOut, isAdmin, isDirector, isAccountant, canApprove, canCreateTask, canDeleteTask, canDeleteProposal, canApproveProposal, canManageUsers, canViewReports, changePassword } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const canViewAll = isDirector || isAccountant;
  const [dept, setDept] = useState('nail');
  const [branch, setBranch] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [taskGroups, setTaskGroups] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [myAllTasks, setMyAllTasks] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [dynamicBranches, setDynamicBranches] = useState(NAIL_BRANCHES);
  const [appearance, setAppearance] = useState({ primaryColor: '#123524', bgUrl: '', bannerText: '', bannerColor: '#123524', bannerEnabled: false });
  const [focusTaskId, setFocusTaskId] = useState(null);
  const [focusProposalId, setFocusProposalId] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const userMenuRef = useRef(null);
  const branchMenuRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('taskflow_view_mode');
    if (saved === 'kanban' || saved === 'list') setViewMode(saved);
  }, []);
  function changeViewMode(m) {
    setViewMode(m);
    if (typeof window !== 'undefined') localStorage.setItem('taskflow_view_mode', m);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
      if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) setShowBranchMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Mở thẳng modal chi tiết task — dùng cho click notification, click focus list, etc.
  // Fetch full task data (creator, assignees, watchers, files) để TaskDetailModal render đầy đủ.
  const openTaskDetail = useCallback(async (taskId) => {
    if (!taskId) return;
    setDetailLoading(true);
    try {
      // Fetch task; nếu là sub-task thì mở task cha (parent_id) để thấy đủ context.
      const { data: tk } = await supabase.from('tasks')
        .select('id, parent_id, department, branch')
        .eq('id', taskId).maybeSingle();
      const targetId = tk?.parent_id || tk?.id || taskId;
      const { data: full } = await supabase.from('tasks').select(`
        *, creator:profiles!tasks_created_by_fkey(id, name, avatar_color, position),
        assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position)),
        watchers:task_watchers(user_id, user:profiles!task_watchers_user_id_fkey(id, name, avatar_color)),
        files:task_files(*)
      `).eq('id', targetId).maybeSingle();
      if (full) {
        // Switch dept/branch context để TaskDetailModal có đúng members + permissions.
        if (full.department && full.department !== dept) setDept(full.department);
        if (full.department === 'nail') {
          const allowed = (isDirector || isAccountant) ? null : (Array.isArray(profile?.branches) ? profile.branches : []);
          if (full.branch && (!allowed || allowed.includes(full.branch))) setBranch(full.branch);
        }
        setDetailTask(full);
      } else {
        toast('Không tìm thấy task (có thể đã bị xoá)', 'error');
      }
    } catch (e) {
      toast('Lỗi mở chi tiết task', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [dept, isDirector, isAccountant, profile]);

  // Legacy: chỉ dùng cho focus-from-list (set focusTaskId, không mở modal). Giữ cho code path khác.
  const openTaskById = useCallback(async (taskId) => {
    if (!taskId) return;
    const { data: tk } = await supabase.from('tasks').select('id, department, branch, parent_id').eq('id', taskId).maybeSingle();
    if (tk) {
      if (tk.department && tk.department !== dept) setDept(tk.department);
      if (tk.department === 'nail') {
        const allowed = (isDirector || isAccountant) ? null : (Array.isArray(profile?.branches) ? profile.branches : []);
        if (tk.branch) {
          if (!allowed || allowed.includes(tk.branch)) setBranch(tk.branch);
        } else {
          setBranch(null);
        }
      }
      setFocusTaskId(tk.parent_id || tk.id);
    } else {
      setFocusTaskId(taskId);
    }
    setTab('dashboard');
  }, [dept, isDirector, isAccountant, profile]);

  const handleOpenNotification = useCallback(async (n) => {
    if (!n) return;
    if (n.task_id) {
      // Click notification có task → mở thẳng modal chi tiết (không cần navigate tab)
      await openTaskDetail(n.task_id);
    } else if (n.proposal_id) {
      const { data: pr } = await supabase.from('proposals').select('id, department, branch').eq('id', n.proposal_id).maybeSingle();
      if (pr) {
        if (pr.department && pr.department !== dept) setDept(pr.department);
        if (pr.department === 'nail') {
          const allowed = (isDirector || isAccountant) ? null : (Array.isArray(profile?.branches) ? profile.branches : []);
          if (pr.branch) {
            if (!allowed || allowed.includes(pr.branch)) setBranch(pr.branch);
          } else {
            setBranch(null);
          }
        }
        setFocusProposalId(pr.id);
        setTab('proposals');
      } else {
        setFocusProposalId(n.proposal_id);
        setTab('proposals');
      }
    }
  }, [dept, isDirector, isAccountant, profile, openTaskDetail]);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'appearance').single().then(({ data }) => {
      if (data) {
        const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setAppearance(prev => ({ ...prev, ...v }));
      }
    });
    loadBranches(supabase).then(b => { if (Array.isArray(b) && b.length > 0) setDynamicBranches(b); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (profile && !canViewAll) {
      setDept(profile.department || 'nail');
    }
  }, [profile, canViewAll]);

  const allBranchIds = (dynamicBranches || NAIL_BRANCHES).map(b => b.id);
  const allowedBranches = (canViewAll
    ? allBranchIds
    : (Array.isArray(profile?.branches) ? profile.branches : [])
  );
  useEffect(() => {
    if (!profile) return;
    if (dept !== 'nail') { setBranch(null); return; }
    if (!canViewAll && allowedBranches.length === 1) setBranch(allowedBranches[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, dept, canViewAll]);

  // Nav items — Coco Pro icons rendered via inline SVG
  const navItems = [
    { id: 'dashboard',     label: 'Tổng quan',      icon: 'home',     show: true },
    { id: 'mytasks',       label: 'Task của tôi',   icon: 'check',    show: true },
    { id: 'create',        label: 'Giao task',      icon: 'plus',     show: canCreateTask },
    { id: 'recurring',     label: 'Lặp lại',        icon: 'repeat',   show: isAdmin },
    { id: 'proposals',     label: 'Đề xuất',        icon: 'file',     show: true },
    { id: 'performance',   label: 'Đánh giá',       icon: 'chart',    show: canViewReports },
    { id: 'notifications', label: 'Thông báo',      icon: 'bell',     show: true, badge: unreadCount },
    { id: 'admin',         label: 'Quản trị',       icon: 'settings', show: isDirector || canManageUsers },
  ].filter(n => n.show);

  const TAB_TITLES = {
    dashboard: 'Tổng quan',
    mytasks: 'Task của tôi',
    create: 'Giao task mới',
    recurring: 'Task lặp lại',
    proposals: 'Đề xuất',
    performance: 'Hiệu suất',
    notifications: 'Thông báo',
    admin: 'Quản trị hệ thống',
  };

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

    const involvesMe = (t) =>
      t.assignees?.some(a => a.user_id === user.id) ||
      t.watchers?.some(w => w.user_id === user.id) ||
      t.created_by === user.id;

    if (dept === 'nail') {
      if (branch) {
        filtered = filtered.filter(t => t.branch === branch || involvesMe(t));
      } else if (!canViewAll) {
        const allowed = Array.isArray(profile?.branches) ? profile.branches : [];
        if (allowed.length > 0) {
          filtered = filtered.filter(t => (t.branch && allowed.includes(t.branch)) || involvesMe(t));
        }
      }
    }

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

    const { data: notifs } = await supabase.from('notifications')
      .select('*, task:tasks(department, branch), proposal:proposals(department, branch)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    // Filter theo dept + branch: nếu notif có task/proposal gắn thì phải match dept (và branch nếu đang chọn);
    // nếu không có task/proposal (như ceo_report, info system) → luôn hiện.
    const filteredNotifs = (notifs || []).filter(n => {
      const itemDept = n.task?.department || n.proposal?.department;
      const itemBranch = n.task?.branch || n.proposal?.branch;
      if (!itemDept) return true;
      if (itemDept !== dept) return false;
      if (dept === 'nail' && branch && itemBranch && itemBranch !== branch) return false;
      return true;
    });
    setNotifications(filteredNotifs);
    setUnreadCount(filteredNotifs.filter(n => !n.read).length);

    // Pending proposals count (cho KPI Dashboard)
    try {
      const { count: pendingCount } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('department', dept)
        .eq('status', 'pending');
      setPendingProposalsCount(pendingCount || 0);
    } catch (e) { /* non-fatal */ }

    const { data: myAssignIds } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id);
    const { data: myWatchIds } = await supabase.from('task_watchers').select('task_id').eq('user_id', user.id);
    const idSet = new Set([
      ...(myAssignIds || []).map(x => x.task_id),
      ...(myWatchIds || []).map(x => x.task_id),
    ]);
    let myTasksRaw = [];
    if (idSet.size > 0) {
      const { data: byRel } = await supabase.from('tasks').select(`
        *, creator:profiles!tasks_created_by_fkey(id, name, avatar_color, position),
        assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position)),
        watchers:task_watchers(user_id, user:profiles!task_watchers_user_id_fkey(id, name, avatar_color))
      `).in('id', Array.from(idSet));
      if (byRel) myTasksRaw = byRel;
    }
    const { data: byCreator } = await supabase.from('tasks').select(`
      *, creator:profiles!tasks_created_by_fkey(id, name, avatar_color, position),
      assignees:task_assignees(user_id, user:profiles!task_assignees_user_id_fkey(id, name, avatar_color, position)),
      watchers:task_watchers(user_id, user:profiles!task_watchers_user_id_fkey(id, name, avatar_color))
    `).eq('created_by', user.id).order('created_at', { ascending: false });
    const seen = new Set(myTasksRaw.map(t => t.id));
    for (const t of byCreator || []) if (!seen.has(t.id)) { myTasksRaw.push(t); seen.add(t.id); }
    setMyAllTasks(myTasksRaw);

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
    let debounceTimer = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 800);
    };
    const ch = supabase.channel('rt-' + dept)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `department=eq.${dept}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `department=eq.${dept}` }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, debouncedFetch)
      .subscribe();
    const notifCh = supabase.channel('rt-notif-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, debouncedFetch)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch);
      supabase.removeChannel(notifCh);
    };
  }, [user, dept, fetchData]);

  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  if (authLoading || !profile) return <div className="min-h-screen flex items-center justify-center bg-bone"><div className="animate-pulse text-muted-ink">Đang tải...</div></div>;

  const parentTasks = tasks.filter(t => !t.parent_id && t.approval_status !== 'pending');
  const stats = {
    total: parentTasks.length,
    doing: parentTasks.filter(t => t.status === 'doing').length,
    done: parentTasks.filter(t => t.status === 'done').length,
    waiting: parentTasks.filter(t => t.status === 'waiting').length,
    overdue: parentTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length,
  };

  const approvedTasks = tasks.filter(t => t.approval_status !== 'pending');

  // ═══════════ EXECUTIVE DASHBOARD DATA ═══════════
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today0 = startOfDay(now);
  const weekAgo = addDays(today0, -7);
  const twoWeeksAgo = addDays(today0, -14);

  // KPI data
  const openTasks = parentTasks.filter(t => t.status !== 'done');
  const openLastWeek = parentTasks.filter(t =>
    t.status !== 'done' && t.created_at && new Date(t.created_at) <= weekAgo
  );
  const doneThisWeek = parentTasks.filter(t =>
    t.status === 'done' && t.completed_at && new Date(t.completed_at) >= weekAgo
  );
  const donePrevWeek = parentTasks.filter(t =>
    t.status === 'done' && t.completed_at &&
    new Date(t.completed_at) >= twoWeeksAgo && new Date(t.completed_at) < weekAgo
  );
  const overdueTasks = parentTasks.filter(t =>
    t.status !== 'done' && t.deadline && new Date(t.deadline) < now
  );
  const overdueLastWeek = parentTasks.filter(t =>
    t.status !== 'done' && t.deadline && new Date(t.deadline) < weekAgo
  );

  // Sparkline: số task done mỗi ngày trong 10 ngày qua
  const sparkDone = Array.from({ length: 10 }, (_, i) => {
    const dayStart = addDays(today0, -(9 - i));
    const dayEnd = addDays(dayStart, 1);
    return parentTasks.filter(t => t.completed_at &&
      new Date(t.completed_at) >= dayStart && new Date(t.completed_at) < dayEnd
    ).length;
  });
  const sparkOpen = Array.from({ length: 10 }, (_, i) => {
    const dayStart = addDays(today0, -(9 - i));
    const dayEnd = addDays(dayStart, 1);
    return parentTasks.filter(t => t.created_at &&
      new Date(t.created_at) >= dayStart && new Date(t.created_at) < dayEnd
    ).length;
  });
  const sparkOverdue = Array.from({ length: 10 }, (_, i) => {
    const dayStart = addDays(today0, -(9 - i));
    const dayEnd = addDays(dayStart, 1);
    return parentTasks.filter(t => t.status !== 'done' && t.deadline &&
      new Date(t.deadline) >= dayStart && new Date(t.deadline) < dayEnd
    ).length;
  });
  const sparkProp = Array.from({ length: 10 }, (_, i) => Math.max(1, Math.round(pendingProposalsCount * (0.3 + 0.07 * i))));

  // Delta calculation
  const deltaDoneWeek = doneThisWeek.length - donePrevWeek.length;
  const deltaDoneWeekPct = donePrevWeek.length > 0
    ? Math.round((deltaDoneWeek / donePrevWeek.length) * 100)
    : (doneThisWeek.length > 0 ? 100 : 0);
  const deltaOpen = openTasks.length - openLastWeek.length;
  const deltaOverdue = overdueTasks.length - overdueLastWeek.length;

  // Focus list (top 5 task cần chú ý, ưu tiên pin + khẩn cấp)
  const taskUrgency = (t) => {
    if (t.status === 'done') return 99;
    if (!t.deadline) return 50;
    const diff = (new Date(t.deadline) - now) / 86400000;
    if (diff < 0) return 0;   // overdue
    if (diff < 1) return 10;  // today
    if (diff < 7) return 20;  // this week
    return 40;
  };
  const dueStateOf = (t) => {
    if (!t.deadline) return 'default';
    const diff = (new Date(t.deadline) - now) / 86400000;
    if (t.status === 'done') return 'default';
    if (diff < 0) return 'overdue';
    if (diff < 1) return 'today';
    if (diff < 7) return 'soon';
    return 'default';
  };
  const focusTasks = [...parentTasks]
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return taskUrgency(a) - taskUrgency(b);
    })
    .slice(0, 5);
  const focusCounts = {
    overdue: focusTasks.filter(t => dueStateOf(t) === 'overdue').length,
    today: focusTasks.filter(t => dueStateOf(t) === 'today').length,
    week: focusTasks.filter(t => dueStateOf(t) === 'soon').length,
  };

  // Health score (0-100)
  const doneAll = parentTasks.filter(t => t.status === 'done');
  const doneOnTime = doneAll.filter(t => !t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline));
  const onTimeRate = doneAll.length > 0 ? Math.round((doneOnTime.length / doneAll.length) * 100) : 0;
  const completionRate = parentTasks.length > 0 ? Math.round((doneAll.length / parentTasks.length) * 100) : 0;
  const healthScore = Math.round(onTimeRate * 0.5 + completionRate * 0.5);
  const healthTone = healthScore > 80 ? 'var(--accent)' : healthScore > 60 ? 'var(--warn)' : 'var(--danger)';
  const healthLabel = healthScore > 80 ? 'Vận hành tốt' : healthScore > 60 ? 'Cần chú ý' : 'Cần cải thiện';

  // Health vs last week
  const doneAllLastWeek = parentTasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at) < weekAgo);
  const doneOTLast = doneAllLastWeek.filter(t => !t.deadline || new Date(t.completed_at) <= new Date(t.deadline));
  const otRateLast = doneAllLastWeek.length > 0 ? Math.round((doneOTLast.length / doneAllLastWeek.length) * 100) : 0;
  const compRateLast = parentTasks.length > 0 ? Math.round((doneAllLastWeek.length / parentTasks.length) * 100) : 0;
  const healthLast = Math.round(otRateLast * 0.5 + compRateLast * 0.5);
  const healthDelta = healthScore - healthLast;

  // Assignee ranking (top 4 by completion rate)
  const memberStats = (members || [])
    .filter(m => m.department === dept && m.role !== 'director' && m.role !== 'accountant')
    .map(m => {
      const mine = parentTasks.filter(t => (t.assignees || []).some(a => a.user_id === m.id));
      const done = mine.filter(t => t.status === 'done');
      const rate = mine.length > 0 ? Math.round((done.length / mine.length) * 100) : 0;
      return { id: m.id, name: m.name, avatar_color: m.avatar_color, done: done.length, total: mine.length, rate };
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.rate - a.rate || b.done - a.done)
    .slice(0, 4);

  const roleGreeting = profile?.name || 'bạn';
  const todayLabel = (() => {
    const wk = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    const d = new Date();
    const p = (n) => n < 10 ? '0' + n : '' + n;
    return `${wk[d.getDay()]} · ${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()}`;
  })();

  // Components
  const Sparkline = ({ bars, tone }) => (
    <div className="h-[22px] mt-2.5 flex items-end gap-[2px]">
      {bars.map((v, i) => {
        const max = Math.max(...bars, 1);
        const pct = Math.max(6, Math.round((v / max) * 100));
        return (
          <div key={i} className="flex-1 rounded-[1px]"
            style={{ height: pct + '%', background: i === bars.length - 1 ? tone : 'var(--bg-soft)' }} />
        );
      })}
    </div>
  );
  const DeltaBadge = ({ up, value }) => (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: up ? 'var(--accent)' : 'var(--danger)' }}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {up
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        }
      </svg>
      {value}
    </span>
  );
  const AvatarChip = ({ m, size = 22 }) => (
    <div className="rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
      style={{ width: size, height: size, background: m?.avatar_color || '#E8F1EC', color: '#333', border: '2px solid #fff' }}
      title={m?.name}>
      {getInitials(m?.name)}
    </div>
  );

  const getInitials = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const ROLE_LABELS = { director: 'Tổng GĐ', admin: 'Quản lý', accountant: 'Kế toán', member: 'Nhân viên' };

  // Icons — Coco Pro inspired
  const navIcon = (name) => {
    const iconMap = {
      home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
      check: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      plus: 'M12 4v16m8-8H4',
      repeat: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      file: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    };
    return iconMap[name] || iconMap.home;
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-3.5">
        <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center border flex-shrink-0" style={{
          background: 'linear-gradient(135deg, #1F3A2A, #123524)',
          borderColor: 'rgba(212,162,76,.3)',
          color: '#D4A24C',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <div className="font-semibold text-sm tracking-tight" style={{ color: '#F5E7C3' }}>
          TasksFlow<span style={{ color: '#D4A24C' }}>.</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-0.5 mt-1.5 flex-1">
        {navItems.map(n => {
          const on = n.id === tab;
          return (
            <button
              key={n.id}
              onClick={() => { setTab(n.id); setSidebarOpen(false); }}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors text-left"
              style={{
                background: on ? 'rgba(212,162,76,.14)' : 'transparent',
                color: on ? '#F5E7C3' : '#E8D3A2',
                fontWeight: on ? 500 : 400,
              }}
            >
              <svg className="w-4 h-4 flex-shrink-0" style={{ opacity: on ? 1 : 0.6 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={navIcon(n.icon)} />
              </svg>
              <span className="flex-1">{n.label}</span>
              {n.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0" style={{ background: '#B5443A', color: '#fff' }}>
                  {n.badge > 99 ? '99+' : n.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Workspace switcher */}
      <div className="mt-auto pt-2.5 flex items-center gap-2.5 px-2.5" style={{ borderTop: '1px solid rgba(232,211,162,.12)' }}>
        <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center font-bold text-[11px] flex-shrink-0" style={{
          background: 'rgba(212,162,76,.15)',
          color: '#D4A24C',
          letterSpacing: '-.02em',
        }}>CG</div>
        <div className="leading-tight min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: '#F5E7C3' }}>Coco Group</div>
        </div>
      </div>
    </>
  );

  const currentTitle = TAB_TITLES[tab] || 'Tổng quan';
  const currentBranch = branch ? (dynamicBranches || NAIL_BRANCHES).find(b => b.id === branch) : null;
  const branchLabelStr = currentBranch ? currentBranch.label : 'Tất cả chi nhánh';

  return (
    <div className="min-h-screen flex flex-col bg-bone" style={{ background: appearance.bgUrl ? `url(${appearance.bgUrl}) center/cover fixed` : undefined }}>
      {appearance.bannerEnabled && appearance.bannerText && (
        <div className="text-center py-2 text-xs font-semibold text-white" style={{ background: appearance.bannerColor || '#123524' }}>
          {appearance.bannerText}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col flex-shrink-0" style={{
          width: 224,
          background: '#123524',
          padding: '18px 12px',
          fontSize: 13,
        }}>
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Drawer */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="relative flex flex-col animate-slide-right" style={{
              width: 256,
              background: '#123524',
              padding: '18px 12px',
              fontSize: 13,
            }}>
              <SidebarContent />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <div className="flex items-center gap-3 px-4 lg:px-6 bg-white border-b border-line flex-shrink-0" style={{ height: 56 }}>
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md hover:bg-bone-soft text-ink-2"
              title="Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb + title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline text-xs font-mono text-muted-ink">Coco Group</span>
              <span className="hidden sm:inline text-line">/</span>
              <span className="text-sm font-semibold text-ink truncate" style={{ letterSpacing: '-.005em' }}>
                {currentTitle}
              </span>
            </div>

            {/* Dept switcher (canViewAll only) — Nail / Hotel */}
            {canViewAll && (
              <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                {[{ id: 'nail', l: 'Nail' }, { id: 'hotel', l: 'Hotel' }].map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setDept(d.id); setBranch(null); }}
                    className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                    style={{
                      background: dept === d.id ? '#fff' : 'transparent',
                      color: dept === d.id ? 'var(--ink)' : 'var(--muted-ink)',
                      boxShadow: dept === d.id ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
                      minWidth: 56,
                    }}
                  >{d.l}</button>
                ))}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search pill */}
            <button
              onClick={() => setShowSearch(true)}
              className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-ink hover:bg-bone-soft transition-colors"
              style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)', minWidth: 220 }}
              title="Tìm kiếm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="flex-1 text-left">Tìm task, đề xuất…</span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-line text-muted-ink">⌘K</kbd>
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="md:hidden p-2 rounded-md hover:bg-bone-soft text-ink-2"
              title="Tìm kiếm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Branch selector */}
            {dept === 'nail' && allowedBranches.length > 1 && (
              <div ref={branchMenuRef} className="relative">
                <button
                  onClick={() => setShowBranchMenu(v => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white text-xs hover:bg-bone-soft transition-colors"
                  style={{ border: '1px solid var(--line)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  <span className="max-w-[120px] truncate">{branchLabelStr}</span>
                  <svg className="w-3 h-3 text-muted-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showBranchMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl2 border border-line shadow-pop overflow-hidden z-50 animate-fade-in" style={{ minWidth: 180 }}>
                    {canViewAll && (
                      <button
                        onClick={() => { setBranch(null); setShowBranchMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-bone-soft flex items-center gap-2"
                        style={{ color: branch === null ? 'var(--accent)' : 'var(--ink-2)', fontWeight: branch === null ? 600 : 400 }}
                      >
                        {branch === null && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                        <span>Tất cả chi nhánh</span>
                      </button>
                    )}
                    {(dynamicBranches || NAIL_BRANCHES).filter(b => allowedBranches.includes(b.id)).map(b => (
                      <button
                        key={b.id}
                        onClick={() => { setBranch(b.id); setShowBranchMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-bone-soft flex items-center gap-2"
                        style={{ color: branch === b.id ? 'var(--accent)' : 'var(--ink-2)', fontWeight: branch === b.id ? 600 : 400 }}
                      >
                        {branch === b.id && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {dept === 'nail' && !canViewAll && allowedBranches.length === 1 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 500 }}>
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                {branchLabel(allowedBranches[0])}
              </span>
            )}

            {/* Bell */}
            <button
              onClick={() => setTab('notifications')}
              className="relative w-8 h-8 rounded-lg bg-white hover:bg-bone-soft transition-colors flex items-center justify-center text-ink-2 flex-shrink-0"
              style={{ border: '1px solid var(--line)' }}
              title="Thông báo"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#B5443A' }} />
              )}
            </button>

            {/* Avatar + menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold hover:ring-2 hover:ring-accent-soft transition-all"
                style={{ background: profile.avatar_color, color: '#333' }}
                title={profile.name + ' · ' + ROLE_LABELS[profile.role]}
              >
                {getInitials(profile.name)}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl2 border border-line shadow-pop overflow-hidden z-50 animate-fade-in" style={{ minWidth: 220 }}>
                  <div className="px-3 py-2.5 border-b border-line" style={{ background: 'var(--bg-soft)' }}>
                    <div className="text-xs font-semibold text-ink truncate">{profile.name}</div>
                    <div className="text-[10px] font-mono text-muted-ink mt-0.5">{ROLE_LABELS[profile.role]} · {profile.email}</div>
                  </div>
                  <button
                    onClick={() => { setShowPwModal(true); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-bone-soft flex items-center gap-2 text-ink-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Đổi mật khẩu
                  </button>
                  <button
                    onClick={() => { signOut(); setShowUserMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-bone-soft flex items-center gap-2"
                    style={{ color: 'var(--danger)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-5">
              {tab === 'dashboard' && (
                <div className="animate-fade-in">
                  {/* Executive header */}
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-ink">{todayLabel}</div>
                      <div className="text-[22px] font-semibold mt-1 text-ink" style={{ letterSpacing: '-.015em' }}>Chào, {roleGreeting}.</div>
                      <div className="text-[13px] text-ink-3 mt-0.5">
                        Hôm nay có <b className="text-ink">{focusCounts.overdue + focusCounts.today} task</b> cần bạn để mắt
                        {pendingProposalsCount > 0 && <> và <b className="text-ink">{pendingProposalsCount} đề xuất</b> đợi duyệt</>}.
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {canViewReports && (
                        <button
                          onClick={() => setTab('performance')}
                          className="px-3 py-2 rounded-lg text-xs font-medium hover:bg-bone-soft transition-colors"
                          style={{ background: '#fff', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                        >Xem báo cáo</button>
                      )}
                      {canCreateTask && (
                        <button
                          onClick={() => setTab('create')}
                          className="px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                          style={{ background: 'var(--ink)', color: '#fff', border: '1px solid transparent' }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          Tạo task mới
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPI row with sparkline */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                      { l: 'Task đang mở',      v: openTasks.length,      d: deltaOpen,      pct: '', up: deltaOpen <= 0, tone: 'var(--accent)', bars: sparkOpen },
                      { l: 'Hoàn thành tuần này', v: doneThisWeek.length,  d: deltaDoneWeek,  pct: deltaDoneWeekPct ? `${deltaDoneWeekPct > 0 ? '+' : ''}${deltaDoneWeekPct}%` : null, up: deltaDoneWeek >= 0, tone: 'var(--accent)', bars: sparkDone },
                      { l: 'Trễ hạn',           v: overdueTasks.length,    d: deltaOverdue,   pct: '', up: deltaOverdue <= 0, tone: 'var(--danger)', bars: sparkOverdue },
                      { l: 'Đề xuất chờ duyệt', v: pendingProposalsCount,   d: null,           pct: '', up: true, tone: 'var(--warn)', bars: sparkProp },
                    ].map(k => (
                      <div key={k.l} className="card p-3.5">
                        <div className="eyebrow">{k.l}</div>
                        <div className="flex items-end justify-between mt-2">
                          <div className="text-[28px] font-semibold font-mono leading-none text-ink" style={{ letterSpacing: '-.02em' }}>{k.v}</div>
                          {k.d !== null && (
                            <DeltaBadge up={k.up} value={k.pct || (k.d > 0 ? `+${k.d}` : `${k.d}`)} />
                          )}
                        </div>
                        <Sparkline bars={k.bars} tone={k.tone} />
                      </div>
                    ))}
                  </div>

                  {/* View toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
                      <button
                        onClick={() => changeViewMode('list')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                        style={{
                          background: viewMode === 'list' ? '#fff' : 'transparent',
                          color: viewMode === 'list' ? 'var(--ink)' : 'var(--muted)',
                          boxShadow: viewMode === 'list' ? '0 1px 2px rgba(18,53,36,.05)' : 'none',
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        Danh sách
                      </button>
                      <button
                        onClick={() => changeViewMode('kanban')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                        style={{
                          background: viewMode === 'kanban' ? '#fff' : 'transparent',
                          color: viewMode === 'kanban' ? 'var(--ink)' : 'var(--muted)',
                          boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(18,53,36,.05)' : 'none',
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /></svg>
                        Kanban
                      </button>
                    </div>
                  </div>

                  {viewMode === 'kanban' ? (
                    <KanbanBoard
                      tasks={approvedTasks}
                      members={members}
                      isAdmin={isAdmin}
                      isDirector={isDirector}
                      canPinTasks={isAdmin || isAccountant}
                      canDeleteTask={canDeleteTask}
                      userId={user.id}
                      onRefresh={fetchData}
                      department={dept}
                      currentUserName={profile?.name}
                      currentUserRole={profile?.role}
                    />
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
                      {/* Left: Focus list */}
                      <div className="card overflow-hidden" style={{ padding: 0 }}>
                        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--line-2, var(--line))' }}>
                          <div>
                            <div className="text-[13px] font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Cần chú ý hôm nay</div>
                            <div className="text-[11px] text-muted-ink mt-0.5">{focusTasks.length} task — xếp theo mức khẩn cấp</div>
                          </div>
                          <div className="hidden sm:flex gap-1.5">
                            {focusCounts.overdue > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(181,68,58,.1)', color: 'var(--danger)' }}>
                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--danger)' }} />
                                Trễ {focusCounts.overdue}
                              </span>
                            )}
                            {focusCounts.today > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(212,162,76,.12)', color: 'var(--warn)' }}>
                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--warn)' }} />
                                Hôm nay {focusCounts.today}
                              </span>
                            )}
                            {focusCounts.week > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'var(--accent-soft, rgba(74,124,89,.12))', color: 'var(--accent)' }}>
                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
                                Tuần này {focusCounts.week}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {focusTasks.length === 0 && (
                            <div className="px-4 py-10 text-center text-xs text-muted-ink">
                              Tuyệt vời! Không có task khẩn cấp nào. 🎉
                            </div>
                          )}
                          {focusTasks.map((task, i) => {
                            const state = dueStateOf(task);
                            const dueTone = state === 'overdue' ? 'var(--danger)' : state === 'today' ? 'var(--warn)' : state === 'soon' ? 'var(--accent)' : 'var(--muted)';
                            const dueBg = state === 'overdue' ? 'rgba(181,68,58,.08)' : state === 'today' ? 'rgba(212,162,76,.1)' : state === 'soon' ? 'var(--accent-soft, rgba(74,124,89,.1))' : 'var(--bg-soft)';
                            const statusDotColor = task.status === 'done' ? 'var(--accent)' : task.status === 'doing' ? 'var(--accent)' : task.status === 'waiting' ? 'var(--warn)' : 'transparent';
                            const statusDotBorder = task.status === 'todo' ? '1.5px solid var(--muted)' : 'none';
                            const deadlineLabel = task.deadline
                              ? (() => {
                                  const d = new Date(task.deadline);
                                  const diff = Math.round((d - now) / 86400000);
                                  if (state === 'overdue') return `Trễ ${Math.abs(diff)}d`;
                                  if (state === 'today') return 'Hôm nay';
                                  if (diff === 1) return 'Ngày mai';
                                  if (diff < 7) return `Còn ${diff}d`;
                                  return `${d.getDate()}/${d.getMonth() + 1}`;
                                })()
                              : 'Chưa đặt';
                            const assigneeMembers = (task.assignees || []).map(a => a.user || members.find(m => m.id === a.user_id)).filter(Boolean);
                            return (
                              <button
                                key={task.id}
                                onClick={() => openTaskDetail(task.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bone-soft transition-colors text-left"
                                style={{
                                  borderBottom: i === focusTasks.length - 1 ? 'none' : '1px solid var(--line-2, var(--line))',
                                  background: task.pinned ? 'rgba(255,252,242,.6)' : 'transparent',
                                }}
                              >
                                <div className="flex flex-col items-center gap-1 w-4 flex-shrink-0">
                                  {task.pinned && (
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--warn)' }}>
                                      <path d="M12 2l2.39 7.36H22l-6.31 4.58L18.08 21 12 16.42 5.92 21l2.39-7.06L2 9.36h7.61L12 2z" />
                                    </svg>
                                  )}
                                  <span className="w-2 h-2 rounded-full" style={{ background: statusDotColor, border: statusDotBorder }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-ink truncate">{task.title}</div>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-ink font-mono">
                                    <span>#{String(task.id).slice(0, 6)}</span>
                                    {task.branch && <><span>·</span><span>{(dynamicBranches || NAIL_BRANCHES).find(b => b.id === task.branch)?.label || task.branch}</span></>}
                                    {task.files && task.files.length > 0 && (
                                      <><span>·</span><span className="inline-flex items-center gap-0.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                        {task.files.length}
                                      </span></>
                                    )}
                                  </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0" style={{ background: dueBg, color: dueTone }}>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {deadlineLabel}
                                </span>
                                <div className="flex -space-x-1.5 flex-shrink-0">
                                  {assigneeMembers.slice(0, 3).map((m, idx) => (
                                    <AvatarChip key={m.id || idx} m={m} size={22} />
                                  ))}
                                  {assigneeMembers.length > 3 && (
                                    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-semibold" style={{ background: 'var(--bg-soft)', color: 'var(--muted)', border: '2px solid #fff' }}>
                                      +{assigneeMembers.length - 3}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="px-4 py-2.5 text-right" style={{ borderTop: '1px solid var(--line-2, var(--line))', background: 'var(--bg-soft)' }}>
                          <button
                            onClick={() => changeViewMode('kanban')}
                            className="text-[11px] font-medium text-ink-2 hover:text-ink inline-flex items-center gap-1"
                          >
                            Xem toàn bộ task
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Right: Health + Ranking */}
                      <div className="flex flex-col gap-3">
                        {/* Health score */}
                        <div className="card p-4">
                          <div className="flex items-baseline justify-between mb-3">
                            <div className="text-[13px] font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Điểm sức khoẻ</div>
                            <div className="text-[11px] text-muted-ink font-mono">tuần này</div>
                          </div>
                          <div className="flex items-center gap-3.5">
                            <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
                              <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-soft)" strokeWidth="7" />
                              <circle cx="36" cy="36" r="30" fill="none" stroke={healthTone} strokeWidth="7"
                                strokeDasharray={`${(healthScore / 100) * 188} 188`} strokeLinecap="round"
                                transform="rotate(-90 36 36)" />
                              <text x="36" y="40" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--ink)">{healthScore}</text>
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-ink-2 mb-1.5">
                                {healthLabel}. Đúng hạn <b>{onTimeRate}%</b>, hoàn thành <b>{completionRate}%</b>.
                              </div>
                              <div className="text-[11px] text-muted-ink font-mono">
                                <span style={{ color: healthDelta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                                  {healthDelta >= 0 ? '▲' : '▼'} {healthDelta >= 0 ? '+' : ''}{healthDelta}
                                </span> so với tuần trước
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Assignee ranking */}
                        <div className="card overflow-hidden" style={{ padding: 0 }}>
                          <div className="px-4 pt-3.5 pb-2 flex items-baseline justify-between">
                            <div className="text-[13px] font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>Xếp hạng nhân sự</div>
                            <div className="text-[11px] text-muted-ink font-mono">hoàn thành / giao</div>
                          </div>
                          {memberStats.length === 0 && (
                            <div className="px-4 py-6 text-center text-xs text-muted-ink">Chưa có dữ liệu</div>
                          )}
                          {memberStats.map((p, i) => (
                            <div key={p.id} className="flex items-center gap-2.5 px-4 py-2" style={{ borderTop: '1px solid var(--line-2, var(--line))' }}>
                              <div className="w-3.5 text-[11px] text-muted-ink font-mono">#{i + 1}</div>
                              <AvatarChip m={p} size={22} />
                              <div className="flex-1 text-xs font-medium text-ink truncate">{p.name}</div>
                              <div className="w-[60px] h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-soft)' }}>
                                <div className="h-full rounded-full" style={{
                                  width: p.rate + '%',
                                  background: p.rate > 80 ? 'var(--accent)' : p.rate > 60 ? 'var(--accent)' : 'var(--warn)',
                                }} />
                              </div>
                              <div className="text-[11px] font-mono text-ink-2 w-[46px] text-right flex-shrink-0">
                                {p.done}/{p.total}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'create' && canCreateTask && <CreateTask members={members.filter(m => m.department === dept || m.role === 'accountant' || m.role === 'director')} userId={user.id} userName={profile.name} department={dept} branch={branch} allowedBranches={allowedBranches} canViewAll={canViewAll} taskGroups={taskGroups} onCreated={() => { fetchData(); setTab('dashboard'); }} />}
              {tab === 'proposals' && <Proposals userId={user.id} userName={profile.name} members={members} department={dept} branch={branch} allowedBranches={allowedBranches} canViewAll={canViewAll} profile={profile} isDirector={isDirector} isAccountant={isAccountant} canApprove={canApprove} canApproveProposal={canApproveProposal} canDeleteProposal={canDeleteProposal} focusProposalId={focusProposalId} clearFocus={() => setFocusProposalId(null)} />}
              {tab === 'performance' && canViewReports && <Performance tasks={tasks} members={members} department={dept} userId={user.id} profile={profile} isAdmin={isDirector || isAccountant} isDirector={isDirector} />}
              {tab === 'mytasks' && <MyTasks tasks={myAllTasks} members={members} userId={user.id} onOpenTask={openTaskById} profileName={profile.name} />}
              {tab === 'notifications' && <Notifications notifications={notifications} userId={user.id} onRefresh={fetchData} onOpen={handleOpenNotification} />}
              {tab === 'admin' && (isDirector || canManageUsers) && (
                <ErrorBoundary>
                  <AdminPanel members={members || []} department={dept} onRefresh={fetchData} dynamicBranches={dynamicBranches} onBranchesChanged={() => loadBranches(supabase).then(setDynamicBranches)} />
                </ErrorBoundary>
              )}
              {tab === 'recurring' && isAdmin && <RecurringTasks members={members} department={dept} userId={user.id} taskGroups={taskGroups} />}
            </div>
          </main>
        </div>
      </div>

      {showSearch && <SearchModal tasks={tasks} onClose={() => setShowSearch(false)} onSelect={() => { setShowSearch(false); setTab('dashboard'); }} />}

      {/* Task detail modal — mở từ click notification, focus list, etc. */}
      <TaskDetailModal
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        members={members}
        userId={user?.id}
        currentUserRole={profile?.role}
        currentUserName={profile?.name}
        department={detailTask?.department || dept}
        isAdmin={isAdmin}
        isDirector={isDirector}
        canPinTasks={isAdmin || isAccountant}
        canDeleteTask={canDeleteTask}
        onRefresh={fetchData}
      />
      {detailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="bg-white rounded-lg px-4 py-3 shadow-pop text-xs text-ink-3 animate-pulse">Đang mở chi tiết…</div>
        </div>
      )}

      {/* Password change modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={() => setShowPwModal(false)}>
          <div className="card max-w-sm w-full p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3 text-ink" style={{ letterSpacing: '-.005em' }}>Đổi mật khẩu</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">Mật khẩu hiện tại</label>
                <input type="password" className="input-field !text-sm" value={pwOld} onChange={e => setPwOld(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">Mật khẩu mới</label>
                <input type="password" className="input-field !text-sm" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-3 mb-1">Xác nhận mật khẩu mới</label>
                <input type="password" className="input-field !text-sm" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button disabled={pwLoading} onClick={async () => {
                if (!pwOld || !pwNew) return;
                if (pwNew !== pwConfirm) { alert('Mật khẩu mới không khớp'); return; }
                if (pwNew.length < 6) { alert('Mật khẩu mới tối thiểu 6 ký tự'); return; }
                setPwLoading(true);
                const { error } = await changePassword(profile.email, pwOld, pwNew);
                setPwLoading(false);
                if (error) { alert('Lỗi: ' + error.message); return; }
                alert('Đổi mật khẩu thành công!'); setShowPwModal(false); setPwOld(''); setPwNew(''); setPwConfirm('');
              }} className="btn-primary flex-1 disabled:opacity-50">
                {pwLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
              <button onClick={() => { setShowPwModal(false); setPwOld(''); setPwNew(''); setPwConfirm(''); }} className="btn-secondary">Hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
