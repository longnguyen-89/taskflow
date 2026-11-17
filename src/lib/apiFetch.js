// Gọi /api/* kèm access token của phiên đăng nhập (Authorization: Bearer).
// Server xác định người gọi từ token này (lib/apiAuth) — không gửi requesterId.
import { supabase } from '@/lib/supabase';

export async function apiFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
