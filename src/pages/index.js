import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/Toaster';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const router = useRouter();

  // Auto redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && profile) {
      router.replace('/dashboard');
    }
  }, [user, profile, authLoading, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) { toast('Sai email hoặc mật khẩu', 'error'); setLoading(false); return; }
    router.push('/dashboard');
    setLoading(false);
  }

  // Show loading while checking session
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F5F1EB 0%, #E8E0D4 50%, #F5F1EB 100%)' }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #2D5A3D 0%, #4A7C5C 100%)' }}>
            <svg className="w-8 h-8 text-amber-200 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
              <path d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">Đang kiểm tra đăng nhập…</p>
        </div>
      </div>
    );
  }

  // If already logged in, show nothing (will redirect)
  if (user && profile) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #F5F1EB 0%, #E8E0D4 50%, #F5F1EB 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #2D5A3D 0%, #4A7C5C 100%)' }}>
            <svg className="w-8 h-8 text-amber-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
              <path d="M12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: '#2D5A3D' }}>CCE - TasksFlow</h1>
          <p className="text-xs mt-1" style={{ color: '#8B7355' }}>Bản quyền @Coco Group</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <h2 className="text-center text-sm font-medium text-gray-700 mb-5">Đăng nhập hệ thống</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input type="email" className="input-field" placeholder="email@congty.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Mật khẩu</label>
              <input type="password" className="input-field" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #2D5A3D 0%, #4A7C5C 100%)' }}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-center text-[11px] text-gray-400 mt-4">Liên hệ Tổng Giám đốc để được cấp tài khoản</p>
        </div>
      </div>
    </div>
  );
}
