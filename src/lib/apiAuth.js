// ════════════════════════════════════════════════════════════════════
// src/lib/apiAuth.js — xác thực người gọi cho API route (chỉ dùng phía server)
// ════════════════════════════════════════════════════════════════════
// Danh tính người gọi CHỈ lấy từ access token Supabase trong header
// `Authorization: Bearer <access_token>` (trình duyệt gắn qua lib/apiFetch).
// KHÔNG BAO GIỜ tin requesterId / userId do trình duyệt tự khai: mọi tài khoản
// đều đọc được uuid người khác từ bảng profiles, nên uuid không phải bằng chứng.
import { timingSafeEqual } from 'crypto';

// '*' thay vì liệt kê cột: cột `active` thêm bằng migration riêng — nếu kho nào
// chưa chạy migration đó, liệt kê cột sẽ làm MỌI API trả 500.
const PROFILE_COLUMNS = '*';

export function bearerToken(req) {
  const h = req.headers?.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Lời gọi từ máy chủ (Vercel Cron / CLI): khoá khớp CRON_SECRET.
// Nhận Bearer (Vercel Cron tự gửi), x-api-key hoặc ?key=.
// CRON_SECRET chưa đặt → luôn false (trước đây undefined === undefined lọt qua).
export function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const key = req.headers?.['x-api-key'] || req.query?.key || bearerToken(req);
  return !!key && sameSecret(key, secret);
}

// Xác thực nhân viên đang làm việc. Trả về hồ sơ người gọi, hoặc null sau khi
// đã trả 401 (thiếu/sai token) / 403 (không có hồ sơ hoặc hồ sơ bị khoá).
// `admin` là client service_role của route.
export async function requireStaff(req, res, admin) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ — tải lại trang rồi thử lại' });
    return null;
  }
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (authErr || !user) {
    res.status(401).json({ error: 'Phiên đăng nhập hết hạn — đăng nhập lại' });
    return null;
  }
  const { data: profile, error: pErr } = await admin
    .from('profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  if (pErr) {
    res.status(500).json({ error: 'Không đọc được hồ sơ người gọi: ' + pErr.message });
    return null;
  }
  if (!profile) {
    res.status(403).json({ error: 'Tài khoản chưa có hồ sơ nhân viên' });
    return null;
  }
  if (profile.active === false) {
    res.status(403).json({ error: 'Tài khoản đã bị khoá' });
    return null;
  }
  return profile;
}
