import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});
const COLORS = ['#E6F1FB', '#E1F5EE', '#FAEEDA', '#EEEDFE', '#FAECE7', '#FBEAF0', '#EAF3DE', '#F1EFE8'];

const DEFAULT_PERMISSIONS = {
  member_create_task: false,
  admin_delete_tasks: false,
  admin_delete_proposals: false,
  admin_approve_proposals: false,
  admin_manage_users: false,
  member_view_reports: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id); else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id); else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid) {
    try {
      const { data: profData } = await supabase.from('profiles').select('*').eq('id', uid).single();
      setProfile(profData);
      // Load permissions separately - non-blocking, fallback to defaults
      try {
        const { data: permData } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
        if (permData && permData.value) {
          const v = typeof permData.value === 'string' ? JSON.parse(permData.value) : permData.value;
          setPermissions(prev => ({ ...prev, ...v }));
        }
      } catch (e) { /* permissions fetch failed - use defaults, non-fatal */ }
    } catch (e) {
      console.error('fetchProfile error:', e);
    }
    setLoading(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function createUser(email, password, name, role, position, department, branches) {
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role, position, department, branches, requesterId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error } };
      return { data };
    } catch (err) {
      return { error: { message: err.message } };
    }
  }

  async function signOut() { await supabase.auth.signOut(); }

  async function changePassword(email, oldPassword, newPassword) {
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error } };
      return { data };
    } catch (err) {
      return { error: { message: err.message } };
    }
  }

  async function resetPassword(targetUserId, newPassword) {
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, newPassword, requesterId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error } };
      return { data };
    } catch (err) {
      return { error: { message: err.message } };
    }
  }

  const isDirector = profile?.role === 'director';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isAccountant = profile?.role === 'accountant';
  const canApprove = isAdmin || isAccountant;

  // Permission-aware checks (mở rộng quyền dựa trên cấu hình TGĐ)
  const canCreateTask = isAdmin || (profile?.role === 'member' && permissions.member_create_task);
  const canDeleteTask = isDirector || (profile?.role === 'admin' && permissions.admin_delete_tasks);
  const canDeleteProposal = isDirector || (profile?.role === 'admin' && permissions.admin_delete_proposals);
  const canApproveProposal = canApprove || (profile?.role === 'admin' && permissions.admin_approve_proposals);
  const canManageUsers = isDirector || (profile?.role === 'admin' && permissions.admin_manage_users);
  const canViewReports = isAdmin || isAccountant || permissions.member_view_reports;

  return (
    <AuthContext.Provider value={{
      user, profile, loading, permissions,
      signIn, createUser, signOut, changePassword, resetPassword,
      isDirector, isAdmin, isAccountant, canApprove,
      canCreateTask, canDeleteTask, canDeleteProposal, canApproveProposal, canManageUsers, canViewReports,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
