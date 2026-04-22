import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginBgUrl, setLoginBgUrl] = useState('');
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const router = useRouter();

  // Load login background from appearance settings
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'appearance').single().then(({ data }) => {
      if (data) {
        const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (v.loginBgUrl) setLoginBgUrl(v.loginBgUrl);
      }
    });
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-bone">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl2 mb-4" style={{
            background: 'rgba(212,162,76,.15)',
            border: '1px solid rgba(212,162,76,.35)',
            color: '#D4A24C',
          }}>
            <svg className="w-7 h-7 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <p className="text-sm text-muted-ink font-mono">Đang kiểm tra đăng nhập…</p>
        </div>
      </div>
    );
  }

  // If already logged in, show nothing (will redirect)
  if (user && profile) return null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans" style={loginBgUrl ? { background: `url(${loginBgUrl}) center/cover no-repeat fixed` } : { background: 'var(--bg)' }}>
      {/* Left: brand hero — desktop only takes flex-1, mobile compact header */}
      <div
        className="relative flex flex-col overflow-hidden p-8 sm:p-12 lg:p-12 flex-shrink-0 lg:flex-1"
        style={{
          background: 'linear-gradient(160deg, #123524 0%, #1F3A2A 60%, #2E6F4C 100%)',
          color: '#E8D3A2',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{
            background: 'rgba(212,162,76,.15)',
            border: '1px solid rgba(212,162,76,.35)',
            color: '#D4A24C',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-base tracking-tight" style={{ color: '#F5E7C3' }}>
              TasksFlow<span style={{ color: '#D4A24C' }}>.</span>
            </div>
            <div className="text-[11px] font-mono opacity-60">Coco Group · Internal</div>
          </div>
        </div>

        {/* Hero body */}
        <div className="my-auto max-w-[460px] py-8 lg:py-0 relative z-10">
          <div className="text-[11px] font-mono uppercase mb-3 lg:mb-4" style={{ letterSpacing: '.12em', color: 'rgba(232,211,162,.7)' }}>
            Quản lý công việc · Coco Group
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight" style={{ letterSpacing: '-.02em', color: '#F5E7C3' }}>
            Giao việc rõ ràng.<br/>
            Theo dõi dễ dàng.<br/>
            Quyết định nhanh hơn.
          </h1>
          <p className="hidden sm:block text-sm mt-4 lg:mt-5 leading-relaxed" style={{ color: 'rgba(232,211,162,.7)' }}>
            Một hệ thống duy nhất cho Spa, Nail và Hotel — từ task hàng ngày, đề xuất chi tiêu, đến báo cáo cho TGĐ.
          </p>
        </div>

        {/* Footer */}
        <div className="text-[11px] font-mono relative z-10" style={{ color: 'rgba(232,211,162,.5)' }}>
          © 2026 Coco Group · v2.0
        </div>

        {/* Decorative circles */}
        <svg className="absolute -bottom-20 -right-20 opacity-15 hidden sm:block pointer-events-none" width="360" height="360" viewBox="0 0 360 360">
          <circle cx="180" cy="180" r="170" stroke="#D4A24C" strokeWidth="1" fill="none"/>
          <circle cx="180" cy="180" r="130" stroke="#D4A24C" strokeWidth="1" fill="none"/>
          <circle cx="180" cy="180" r="90" stroke="#D4A24C" strokeWidth="1" fill="none"/>
          <circle cx="180" cy="180" r="50" stroke="#D4A24C" strokeWidth="1" fill="none"/>
        </svg>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10 flex-1 lg:flex-none lg:w-[460px] bg-bone">
        <div className="w-full max-w-[340px]">
          <div className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Đăng nhập</div>
          <div className="text-sm text-ink-3 mt-1 mb-7">Dùng tài khoản công ty do TGĐ cấp.</div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[11px] font-medium text-ink-2 mb-1.5">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="email@congty.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="block text-[11px] font-medium text-ink-2">Mật khẩu</label>
                <span className="text-[11px] text-muted-ink">Quên? Liên hệ TGĐ.</span>
              </div>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1.5 py-[11px] rounded-lg font-semibold text-sm disabled:opacity-50 transition-opacity hover:opacity-95 flex items-center justify-center gap-1.5"
              style={{
                background: 'linear-gradient(180deg, #2E6F4C, #123524)',
                color: '#F5E7C3',
                letterSpacing: '.005em',
              }}
            >
              {loading ? (
                <>Đang đăng nhập...</>
              ) : (
                <>Đăng nhập <span>→</span></>
              )}
            </button>
          </form>

          <div className="text-[11px] text-muted-ink mt-5 text-center font-mono">
            Chưa có tài khoản? Liên hệ TGĐ.
          </div>
        </div>
      </div>
    </div>
  );
}
