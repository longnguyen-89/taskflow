// Supabase GIẢ cho phép thử API — thay '@supabase/supabase-js' qua tests/hooks.mjs.
// Bảng trong bộ nhớ + ghi lại mọi lần ghi DB và mọi lệnh auth.admin.* để phép thử
// kiểm được "403 thì KHÔNG có gì bị ghi". Không có mạng, không đụng kho thật.

export const state = {
  tables: {},      // { tên_bảng: [hàng] }
  tokens: {},      // { access_token: user_id }
  writes: [],      // [{ table, op, payload }]
  adminCalls: [],  // [{ fn, args }]
  pushes: [],      // web-push đã gửi (mock-web-push ghi vào đây)
  fetches: [],     // fetch ra ngoài (bị chặn)
};

export function reset({ tables = {}, tokens = {} } = {}) {
  state.tables = JSON.parse(JSON.stringify(tables));
  state.tokens = { ...tokens };
  state.writes.length = 0;
  state.adminCalls.length = 0;
  state.pushes.length = 0;
  state.fetches.length = 0;
}

let seq = 0;
const rowsOf = (t) => (state.tables[t] ||= []);

class Query {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.filters = [];
    this.payload = null;
    this.wantRows = false;
    this.mode = 'many';
    this.headCount = false;
  }
  select(_cols, opts) { if (this.op === 'select') this.wantRows = true; else this.wantRows = true; if (opts?.head) this.headCount = true; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push(r => r[c] === v); return this; }
  neq(c, v) { this.filters.push(r => r[c] !== v); return this; }
  in(c, vs) { this.filters.push(r => (vs || []).includes(r[c])); return this; }
  gte(c, v) { this.filters.push(r => r[c] >= v); return this; }
  gt(c, v) { this.filters.push(r => r[c] > v); return this; }
  lte(c, v) { this.filters.push(r => r[c] <= v); return this; }
  lt(c, v) { this.filters.push(r => r[c] < v); return this; }
  is(c, v) { this.filters.push(r => (r[c] ?? null) === v); return this; }
  not() { return this; }
  or(expr) {
    const alts = String(expr).split(',').map(s => s.split('.'));
    this.filters.push(r => alts.some(([c, op, ...v]) => op === 'eq' && String(r[c]) === v.join('.')));
    return this;
  }
  order() { return this; }
  limit() { return this; }
  range() { return this; }
  contains() { return this; }
  overlaps() { return this; }
  ilike() { return this; }
  filter() { return this; }
  match(o) { for (const [c, v] of Object.entries(o || {})) this.eq(c, v); return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  run() {
    const rows = rowsOf(this.table);
    const hit = (r) => this.filters.every(f => f(r));
    let out = [];
    if (this.op === 'select') {
      out = rows.filter(hit);
      if (this.headCount) return { data: null, count: out.length, error: null };
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      state.writes.push({ table: this.table, op: this.op, payload: this.payload });
      for (const p of list) {
        const row = { id: p.id ?? `gen-${++seq}`, ...p };
        const i = rows.findIndex(r => r.id === row.id);
        if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row);
        out.push(row);
      }
    } else if (this.op === 'update') {
      state.writes.push({ table: this.table, op: 'update', payload: this.payload });
      for (const r of rows) if (hit(r)) { Object.assign(r, this.payload); out.push(r); }
    } else if (this.op === 'delete') {
      state.writes.push({ table: this.table, op: 'delete', payload: null });
      state.tables[this.table] = rows.filter(r => !hit(r));
    }
    if (this.mode === 'single') {
      if (out.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
      return { data: out[0], error: null };
    }
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null };
    return { data: out, error: null, count: out.length };
  }
  then(resolve, reject) {
    try { resolve(this.run()); } catch (e) { reject(e); }
  }
}

class Client {
  constructor() {
    this.auth = {
      getUser: async (token) => {
        const id = state.tokens[token];
        if (!token || !id) return { data: { user: null }, error: { message: 'invalid JWT' } };
        return { data: { user: { id } }, error: null };
      },
      admin: {
        updateUserById: async (...args) => { state.adminCalls.push({ fn: 'updateUserById', args }); return { data: {}, error: null }; },
        createUser: async (...args) => { state.adminCalls.push({ fn: 'createUser', args }); return { data: { user: { id: `new-${++seq}` } }, error: null }; },
        deleteUser: async (...args) => { state.adminCalls.push({ fn: 'deleteUser', args }); return { data: {}, error: null }; },
      },
    };
  }
  from(table) { return new Query(table); }
  rpc() { return Promise.resolve({ data: null, error: null }); }
}

export function createClient() { return new Client(); }
