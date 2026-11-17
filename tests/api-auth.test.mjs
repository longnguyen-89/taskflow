// Phép thử xác thực API (17-11-2026): gọi ĐÚNG handler thật trong src/pages/api/
// với Supabase giả. Chạy: bash tests/chay-thu.sh  (chạy trên bản sao, env sạch).
//
// Mục tiêu: danh tính người gọi CHỈ lấy từ access token; requesterId trình duyệt gửi
// lên không còn tác dụng; khoá NEXT_PUBLIC_CRON_SECRET không còn mở được send-push.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { state, reset } from './mock-supabase.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.TASKFLOW_ROOT || path.resolve(here, '..');

const CRON = 'cron-thu-nghiem-123';
const OLD_PUBLIC = 'khoa-cong-khai-cu-456';
process.env.CRON_SECRET = CRON;
process.env.NEXT_PUBLIC_CRON_SECRET = OLD_PUBLIC;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://kho-gia.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'khoa-gia';
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_IDS;
delete process.env.RESEND_API_KEY;

const SEED = {
  tables: {
    profiles: [
      { id: 'u-dir', name: 'TGĐ', role: 'director', department: 'nail', active: true },
      { id: 'u-mem', name: 'Nhân viên', role: 'member', department: 'nail', active: true },
      { id: 'u-admin', name: 'Quản lý', role: 'admin', department: 'nail', active: true },
      { id: 'u-locked', name: 'TGĐ cũ bị khoá', role: 'director', active: false },
      { id: 'u-target', name: 'Người bị đổi', role: 'member', department: 'nail', active: true },
    ],
    tasks: [{ id: 't1', parent_id: null, status: 'todo' }],
    proposals: [{ id: 'p1', status: 'pending' }],
    app_settings: [{ id: 'perm', key: 'permissions', value: { admin_manage_users: false } }],
  },
  tokens: {
    'tok-dir': 'u-dir',
    'tok-mem': 'u-mem',
    'tok-admin': 'u-admin',
    'tok-locked': 'u-locked',
    'tok-noprofile': 'u-ghost',
  },
};

beforeEach(() => reset(SEED));

const cache = {};
async function load(route) {
  if (!cache[route]) {
    cache[route] = (await import(pathToFileURL(path.join(root, 'src/pages/api', route + '.js')).href)).default;
  }
  return cache[route];
}

function mkRes() {
  return {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    setHeader() {}, end() { return this; },
  };
}

async function call(route, { method = 'POST', token, headers = {}, body = {}, query = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  const req = { method, headers: h, body, query };
  const res = mkRes();
  await (await load(route))(req, res);
  return res;
}

const noSideEffects = (label) => {
  assert.equal(state.writes.length, 0, `${label}: không được ghi DB, đã ghi ${JSON.stringify(state.writes)}`);
  assert.equal(state.adminCalls.length, 0, `${label}: không được gọi auth.admin, đã gọi ${JSON.stringify(state.adminCalls)}`);
  assert.equal(state.pushes.length, 0, `${label}: không được gửi push, đã gửi ${JSON.stringify(state.pushes)}`);
};

// Body "tấn công": tự khai là TGĐ (kiểu cũ đủ để qua cửa)
const FORGED = {
  'reset-password': { userId: 'u-target', newPassword: 'matkhau-moi', requesterId: 'u-dir' },
  'create-user': { email: 'x@x.vn', password: 'matkhau', name: 'Kẻ lạ', role: 'director', requesterId: 'u-dir' },
  'delete-user': { userId: 'u-target', requesterId: 'u-dir' },
  'set-user-active': { userId: 'u-target', active: false, requesterId: 'u-dir' },
  'delete-task': { taskId: 't1', requesterId: 'u-dir' },
  'delete-proposal': { proposalId: 'p1', requesterId: 'u-dir' },
  'telegram-check': { requesterId: 'u-dir' },
  'send-ceo-report': { requesterId: 'u-dir' },
  'send-push': { userId: 'u-dir', title: 'giả', body: 'giả' },
};
const methodOf = (r) => (r === 'telegram-check' ? 'GET' : 'POST');

test('Không token → 401 ở mọi đường cần đăng nhập, dù body/query tự khai là TGĐ', async () => {
  for (const route of Object.keys(FORGED)) {
    reset(SEED);
    const res = await call(route, { method: methodOf(route), body: FORGED[route], query: { requesterId: 'u-dir' } });
    assert.equal(res.statusCode, 401, `${route} phải 401, ra ${res.statusCode} ${JSON.stringify(res.body)}`);
    noSideEffects(route);
  }
});

test('Token sai / hết hạn → 401', async () => {
  const res = await call('reset-password', { token: 'tok-bia', body: FORGED['reset-password'] });
  assert.equal(res.statusCode, 401);
  noSideEffects('reset-password token sai');
});

const DIRECTOR_OR_PERMITTED = ['reset-password', 'create-user', 'delete-user', 'set-user-active',
  'delete-task', 'delete-proposal', 'telegram-check', 'send-ceo-report'];

test('Token nhân viên thường + requesterId của TGĐ trong body/query → vẫn 403, không ghi gì', async () => {
  for (const route of DIRECTOR_OR_PERMITTED) {
    reset(SEED);
    const res = await call(route, { method: methodOf(route), token: 'tok-mem', body: FORGED[route], query: { requesterId: 'u-dir' } });
    assert.equal(res.statusCode, 403, `${route} phải 403, ra ${res.statusCode} ${JSON.stringify(res.body)}`);
    noSideEffects(route);
  }
});

test('Tài khoản không có hồ sơ → 403; hồ sơ bị khoá (kể cả vai TGĐ) → 403', async () => {
  let res = await call('reset-password', { token: 'tok-noprofile', body: FORGED['reset-password'] });
  assert.equal(res.statusCode, 403);
  noSideEffects('không hồ sơ');
  res = await call('reset-password', { token: 'tok-locked', body: FORGED['reset-password'] });
  assert.equal(res.statusCode, 403);
  noSideEffects('bị khoá');
  res = await call('send-push', { token: 'tok-locked', body: FORGED['send-push'] });
  assert.equal(res.statusCode, 403);
  noSideEffects('send-push bị khoá');
});

test('TGĐ thật → reset-password đổi đúng mật khẩu người được chọn', async () => {
  const res = await call('reset-password', { token: 'tok-dir', body: { userId: 'u-target', newPassword: 'matkhau-moi' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(state.adminCalls, [{ fn: 'updateUserById', args: ['u-target', { password: 'matkhau-moi' }] }]);
});

test('TGĐ thật → create-user tạo tài khoản + hồ sơ', async () => {
  const res = await call('create-user', { token: 'tok-dir', body: { email: 'moi@cce.vn', password: 'matkhau', name: 'NV mới', role: 'member' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(state.adminCalls[0]?.fn, 'createUser');
  assert.ok(state.writes.some(w => w.table === 'profiles' && w.op === 'upsert'));
});

test('delete-user: TGĐ xoá được người khác, không tự xoá chính mình (theo token)', async () => {
  let res = await call('delete-user', { token: 'tok-dir', body: { userId: 'u-dir' } });
  assert.equal(res.statusCode, 400);
  noSideEffects('tự xoá');
  res = await call('delete-user', { token: 'tok-dir', body: { userId: 'u-target' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(state.adminCalls.map(c => c.fn), ['deleteUser']);
});

test('set-user-active: Quản lý CHƯA được cấp quyền → 403; được cấp → khoá được; không tự khoá mình', async () => {
  let res = await call('set-user-active', { token: 'tok-admin', body: { userId: 'u-target', active: false } });
  assert.equal(res.statusCode, 403, JSON.stringify(res.body));
  noSideEffects('admin chưa có quyền');

  state.tables.app_settings[0].value = { admin_manage_users: true };
  res = await call('set-user-active', { token: 'tok-admin', body: { userId: 'u-admin', active: false } });
  assert.equal(res.statusCode, 400, 'tự khoá chính mình (theo token) phải 400');
  noSideEffects('tự khoá');

  res = await call('set-user-active', { token: 'tok-admin', body: { userId: 'u-target', active: false } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(state.tables.profiles.find(p => p.id === 'u-target').active, false);
  assert.equal(state.adminCalls[0]?.fn, 'updateUserById');
});

test('delete-task / delete-proposal: TGĐ xoá được', async () => {
  let res = await call('delete-task', { token: 'tok-dir', body: { taskId: 't1' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(state.tables.tasks.length, 0);
  res = await call('delete-proposal', { token: 'tok-dir', body: { proposalId: 'p1' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(state.tables.proposals.length, 0);
});

test('send-push: khoá công khai cũ → 401; CRON_SECRET hoặc token nhân viên → qua', async () => {
  let res = await call('send-push', { headers: { 'x-api-key': OLD_PUBLIC }, body: FORGED['send-push'] });
  assert.equal(res.statusCode, 401, 'NEXT_PUBLIC_CRON_SECRET không được mở send-push');
  noSideEffects('khoá công khai cũ');
  res = await call('send-push', { headers: { 'x-api-key': CRON }, body: FORGED['send-push'] });
  assert.equal(res.statusCode, 200);
  res = await call('send-push', { token: CRON, body: FORGED['send-push'] });
  assert.equal(res.statusCode, 200);
  res = await call('send-push', { token: 'tok-mem', body: FORGED['send-push'] });
  assert.equal(res.statusCode, 200);
});

test('generate-recurring: giả User-Agent vercel-cron → 401; Bearer CRON_SECRET → qua', async () => {
  let res = await call('generate-recurring', { method: 'GET', headers: { 'user-agent': 'vercel-cron/1.0' } });
  assert.equal(res.statusCode, 401, 'User-Agent giả không được qua');
  noSideEffects('UA giả');
  res = await call('generate-recurring', { method: 'GET', token: CRON });
  assert.notEqual(res.statusCode, 401, JSON.stringify(res.body));
  assert.ok(res.statusCode < 500, `generate-recurring lỗi ${res.statusCode} ${JSON.stringify(res.body)}`);
});

test('check-deadlines: Bearer CRON_SECRET (kiểu Vercel Cron gửi) → qua; không khoá → 401; CRON_SECRET chưa đặt → 401', async () => {
  let res = await call('check-deadlines', { method: 'GET', token: CRON });
  assert.notEqual(res.statusCode, 401, JSON.stringify(res.body));
  assert.ok(res.statusCode < 500, `check-deadlines lỗi ${res.statusCode} ${JSON.stringify(res.body)}`);
  res = await call('check-deadlines', { method: 'GET' });
  assert.equal(res.statusCode, 401);
  delete process.env.CRON_SECRET;
  try {
    res = await call('check-deadlines', { method: 'GET' });
    assert.equal(res.statusCode, 401, 'CRON_SECRET chưa đặt + không khoá phải 401 (trước đây undefined === undefined lọt qua)');
  } finally {
    process.env.CRON_SECRET = CRON;
  }
});

test('send-ceo-report: cron vẫn chạy; TGĐ chạy tay được', async () => {
  let res = await call('send-ceo-report', { method: 'GET', token: CRON, query: { period: 'week' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  res = await call('send-ceo-report', { token: 'tok-dir', query: { period: 'week' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

test('telegram-check: TGĐ dùng được', async () => {
  const res = await call('telegram-check', { method: 'GET', token: 'tok-dir' });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.configured, false);
});

test('Không phép thử nào chạm mạng thật (đếm qua cả lượt chạy)', () => {
  // fetch bị chặn ở hooks.mjs; các handler chỉ fetch khi có khoá Telegram/Resend (đã xoá khỏi env)
  assert.ok(Array.isArray(globalThis.__fetchTatCa), 'hooks.mjs chưa được nạp');
  assert.deepEqual(globalThis.__fetchTatCa, []);
});
