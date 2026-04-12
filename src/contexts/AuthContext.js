import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});
const COLORS = ['#E6F1FB', '#E1F5EE', '#FAEEDA', '#EEEDFE', '#FAECE7', '#FBEAF0', '#EAF3DE', '#F1EFE8'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile(data); setLoading(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function createUser(email, password, name, role, position, department) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role, position, department } } });
    if (error) return { error };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id, email, name, role, position, department,
        avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    return { data, error };
  }

  async function signOut() { await supabase.auth.signOut(); }

  const isDirector = profile?.role === 'director';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';
  const isAccountant = profile?.role === 'accountant';
  const canApprove = isAdmin || isAccountant;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, createUser, signOut, isDirector, isAdmin, isAccountant, canApprove }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
