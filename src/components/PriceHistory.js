// Feature 10: Lá»‹ch sá»­ giÃ¡ - Theo dÃµi giÃ¡ mua cá»§a tá»«ng máº·t hÃ ng qua cÃ¡c Ä‘á» xuáº¥t.
// PhÃ¡t hiá»‡n giÃ¡ tÄƒng/giáº£m báº¥t thÆ°á»ng (>20% so vá»›i giÃ¡ trung bÃ¬nh).
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { branchLabel } from '@/lib/branches';

// Chuáº©n hoÃ¡ tÃªn máº·t hÃ ng: lowercase, bá» dáº¥u, trim, thu gá»n space.
function normalizeName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fmtVND(n) {
  if (!n && n !== 0) return 'â€”';
  return Number(n).toLocaleString('de-DE') + 'â‚«';
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Tráº£ vá» category + mÃ u cho má»©c chÃªnh lá»‡ch so vá»›i avg.
function priceClassify(latest, avg) {
  if (!avg || !latest) return { kind: 'unknown', color: '#9ca3af', label: 'â€”', pct: null };
  const pct = ((latest - avg) / avg) * 100;
  if (pct > 50) return { kind: 'spike', color: '#dc2626', label: 'TÄƒng máº¡nh', pct };
  if (pct > 20) return { kind: 'up', color: '#ea580c', label: 'TÄƒng', pct };
  if (pct < -20) return { kind: 'down', color: '#16a34a', label: 'Giáº£m', pct };
  return { kind: 'normal', color: '#6b7280', label: 'BÃ¬nh thÆ°á»ng', pct };
}

export default function PriceHistorySection({ department }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('abnormal'); // abnormal | recent | name | count
  const [expandedKey, setExpandedKey] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all | approved | pending

  useEffect(() => { fetchProposals(); }, [department]);

  async function fetchProposals() {
    setLoading(true);
    const q = supabase
      .from('proposals')
      .select('id, title, category_name, status, department, branch, created_at, items, creator:profiles!proposals_created_by_fkey(name)')
      .eq('department', department)
      .not('items', 'is', null)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) { console.error('[PriceHistory] fetch error', error); setProposals([]); }
    else setProposals(data || []);
    setLoading(false);
  }

  // Gá»™p táº¥t cáº£ items theo tÃªn Ä‘Ã£ chuáº©n hoÃ¡.
  const itemGroups = useMemo(() => {
    const groups = new Map();
    for (const p of proposals) {
      // Chá»‰ tÃ­nh Ä‘á» xuáº¥t Mua hÃ ng (loáº¡i trá»« Thanh toÃ¡n).
      if (p.category_name === 'Thanh toÃ¡n') continue;
      if (filterStatus === 'approved' && p.status !== 'approved') continue;
      if (filterStatus === 'pending' && p.status !== 'pending') continue;
      const items = Array.isArray(p.items) ? p.items : [];
      for (const it of items) {
        if (!it || !it.name || !it.unit_price) continue;
        const price = Number(it.unit_price);
        if (!price || price <= 0) continue;
        const key = normalizeName(it.name);
        if (!key) continue;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            displayName: it.name.trim(),
            entries: [],
          });
        }
        groups.get(key).entries.push({
          proposalId: p.id,
          proposalTitle: p.title,
          creator: p.creator?.name || 'â€”',
          status: p.status,
          branch: p.branch,
          category: p.category_name,
          date: p.created_at,
          price,
          quantity: Number(it.quantity) || 0,
          unit: it.unit || '',
          note: it.note || '',
        });
      }
    }
    // TÃ­nh stats cho má»—i group
    const list = [];
    for (const g of groups.values()) {
      g.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
      const prices = g.entries.map(e => e.price);
      const avg = prices.reduce((s, x) => s + x, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const latest = g.entries[0].price;
      const oldest = g.entries[g.entries.length - 1].price;
      const classify = priceClassify(latest, avg);
      list.push({
        ...g,
        count: g.entries.length,
        avg,
        min,
        max,
        latest,
        oldest,
        classify,
        latestDate: g.entries[0].date,
      });
    }
    return list;
  }, [proposals, filterStatus]);

  // Filter theo search + sort
  const filteredGroups = useMemo(() => {
    let arr = itemGroups;
    if (search.trim()) {
      const q = normalizeName(search);
      arr = arr.filter(g => normalizeName(g.displayName).includes(q));
    }
    switch (sortBy) {
      case 'abnormal':
        // TÄƒng máº¡nh -> tÄƒng -> giáº£m -> bÃ¬nh thÆ°á»ng
        const rank = { spike: 0, up: 1, down: 2, normal: 3, unknown: 4 };
        arr = [...arr].sort((a, b) => {
          const ra = rank[a.classify.kind] ?? 5;
          const rb = rank[b.classify.kind] ?? 5;
          if (ra !== rb) return ra - rb;
          return new Date(b.latestDate) - new Date(a.latestDate);
        });
        break;
      case 'recent':
        arr = [...arr].sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
        break;
      case 'name':
        arr = [...arr].sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
        break;
      case 'count':
        arr = [...arr].sort((a, b) => b.count - a.count);
        break;
    }
    return arr;
  }, [itemGroups, search, sortBy]);

  const abnormalCount = itemGroups.filter(g => g.classify.kind === 'spike' || g.classify.kind === 'up').length;
  const trackedCount = itemGroups.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Lá»‹ch sá»­ giÃ¡ mua hÃ ng</h3>
        <button onClick={fetchProposals} className="text-[11px] text-gray-500 hover:text-gray-700">
          {loading ? 'Äang táº£i...' : 'â†» LÃ m má»›i'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Máº·t hÃ ng theo dÃµi</p>
          <p className="text-xl font-bold mt-1" style={{ color: '#123524' }}>{trackedCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">GiÃ¡ tÄƒng báº¥t thÆ°á»ng</p>
          <p className="text-xl font-bold mt-1" style={{ color: abnormalCount > 0 ? '#dc2626' : '#16a34a' }}>
            {abnormalCount}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Äá» xuáº¥t Ä‘Ã£ duyá»‡t</p>
          <p className="text-xl font-bold mt-1 text-gray-700">
            {proposals.filter(p => p.status === 'approved').length}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="ðŸ” TÃ¬m máº·t hÃ ng..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field !py-1.5 !text-xs flex-1 min-w-[180px]"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-field !py-1.5 !text-xs !w-auto">
          <option value="all">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
          <option value="approved">ÄÃ£ duyá»‡t</option>
          <option value="pending">Äang chá»</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="input-field !py-1.5 !text-xs !w-auto">
          <option value="abnormal">Báº¥t thÆ°á»ng trÆ°á»›c</option>
          <option value="recent">Gáº§n Ä‘Ã¢y nháº¥t</option>
          <option value="count">Nhiá»u láº§n mua</option>
          <option value="name">TÃªn A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-gray-400">Äang táº£i...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">
          {search ? 'KhÃ´ng tÃ¬m tháº¥y máº·t hÃ ng nÃ o' : 'ChÆ°a cÃ³ dá»¯ liá»‡u giÃ¡ mua hÃ ng'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredGroups.map(g => {
            const isExp = expandedKey === g.key;
            const pctStr = g.classify.pct != null ? (g.classify.pct > 0 ? '+' : '') + g.classify.pct.toFixed(0) + '%' : '';
            return (
              <div key={g.key} className="card overflow-hidden">
                {/* Row header */}
                <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedKey(isExp ? null : g.key)}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style={{ background: g.classify.color + '20' }}>
                    {g.classify.kind === 'spike' ? 'ðŸš¨' : g.classify.kind === 'up' ? 'ðŸ“ˆ' : g.classify.kind === 'down' ? 'ðŸ“‰' : 'ðŸ“¦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{g.displayName}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ color: g.classify.color, background: g.classify.color + '15' }}>
                        {g.classify.label} {pctStr}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {g.count} láº§n
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                      <span>Gáº§n nháº¥t: <strong className="text-gray-700">{fmtVND(g.latest)}</strong></span>
                      <span>TB: {fmtVND(Math.round(g.avg))}</span>
                      <span>Min-Max: {fmtVND(g.min)} â†’ {fmtVND(g.max)}</span>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExp ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded history */}
                {isExp && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-3">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Lá»‹ch sá»­ mua ({g.entries.length} láº§n)
                    </p>
                    <div className="space-y-1.5">
                      {g.entries.map((e, idx) => {
                        const prev = g.entries[idx + 1]; // entries sorted desc, prev is older
                        const changePct = prev ? ((e.price - prev.price) / prev.price) * 100 : null;
                        const changeColor = changePct == null ? '#9ca3af' : changePct > 5 ? '#dc2626' : changePct < -5 ? '#16a34a' : '#6b7280';
                        return (
                          <div key={e.proposalId + '_' + idx} className="bg-white rounded-lg p-2 flex items-center gap-2 text-[11px]">
                            <div className="flex-shrink-0 text-gray-400 w-20">{fmtDate(e.date)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate">
                                {e.proposalTitle}
                              </p>
                              <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-0.5">
                                <span>{e.creator}</span>
                                {e.branch && <span>Â· {branchLabel(e.branch)}</span>}
                                <span className={`px-1 rounded ${e.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : e.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {e.status === 'approved' ? 'Duyá»‡t' : e.status === 'rejected' ? 'Tá»« chá»‘i' : 'Chá»'}
                                </span>
                                {e.quantity ? <span>Â· SL: {e.quantity} {e.unit}</span> : null}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="font-bold text-gray-800">{fmtVND(e.price)}</p>
                              {changePct != null && Math.abs(changePct) >= 0.5 && (
                                <p className="text-[9px] font-semibold" style={{ color: changeColor }}>
                                  {changePct > 0 ? 'â–²' : 'â–¼'} {Math.abs(changePct).toFixed(0)}%
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 text-center">
        ðŸ’¡ GiÃ¡ Ä‘Æ°á»£c gáº¯n nhÃ£n "TÄƒng báº¥t thÆ°á»ng" khi giÃ¡ mua gáº§n nháº¥t vÆ°á»£t quÃ¡ 20% so vá»›i giÃ¡ trung bÃ¬nh.
      </p>
    </div>
  );
}
