// Feature 21, 22, 23 — Branch Compare + Trend + Heatmap
// Dung lai pattern fetch/aggregate cua ReportsSection (AdminPanel.js)
// Chi dung cho Nail department (Hotel khong chia chi nhanh)

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { NAIL_BRANCHES, branchLabel } from '@/lib/branches';

const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v || 0) + 'đ';
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;

// ─────────────────────────────────────────────────────────
// Feature 21 — BRANCH COMPARE
// ─────────────────────────────────────────────────────────
export function BranchCompareSection({ department, dynamicBranches }) {
  const branchList = Array.isArray(dynamicBranches) && dynamicBranches.length > 0
    ? dynamicBranches.filter(b => !b.department || b.department === department || department === 'nail')
    : NAIL_BRANCHES;
  const [selected, setSelected] = useState(branchList.slice(0, Math.min(4, branchList.length)).map(b => b.id));
  const [period, setPeriod] = useState('month');
  const [tasks, setTasks] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  function getRange() {
    const now = new Date();
    let start;
    if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
    else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
    else { start = new Date(now.getFullYear(), 0, 1); }
    return { start, end: now };
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { start, end } = getRange();
      const [tR, pR, mR] = await Promise.all([
        supabase.from('tasks')
          .select('id, status, deadline, completed_at, branch, created_at')
          .eq('department', department).is('parent_id', null)
          .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
        supabase.from('proposals')
          .select('id, status, estimated_cost, branch, created_at')
          .eq('department', department)
          .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
        supabase.from('profiles').select('id, name, department, branches'),
      ]);
      setTasks(tR.data || []); setProposals(pR.data || []); setMembers(mR.data || []);
      setLoading(false);
    })();
  }, [department, period]);

  const stats = useMemo(() => {
    const now = new Date();
    return selected.map(bid => {
      const brTasks = tasks.filter(t => t.branch === bid);
      const brProps = proposals.filter(p => p.branch === bid);
      const done = brTasks.filter(t => t.status === 'done').length;
      const overdue = brTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
      const approved = brProps.filter(p => p.status === 'approved').length;
      const pending = brProps.filter(p => p.status === 'pending' || p.status === 'partial').length;
      const cost = brProps.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);
      const staff = members.filter(m => m.department === department && Array.isArray(m.branches) && m.branches.includes(bid)).length;
      return {
        id: bid, label: branchLabel(bid, dynamicBranches),
        total: brTasks.length, done, overdue, rate: pct(done, brTasks.length),
        approved, pending, cost, staff,
      };
    });
  }, [selected, tasks, proposals, members, department, dynamicBranches]);

  // Rankings for color-coding (best=green, worst=red)
  const ranked = useMemo(() => {
    const sorted = [...stats].sort((a, b) => b.rate - a.rate);
    const rank = {};
    sorted.forEach((s, i) => { rank[s.id] = { rateRank: i, isBest: i === 0, isWorst: i === sorted.length - 1 && stats.length > 1 }; });
    return rank;
  }, [stats]);

  function toggleBranch(bid) {
    setSelected(prev => {
      if (prev.includes(bid)) return prev.filter(x => x !== bid);
      if (prev.length >= 4) return prev;
      return [...prev, bid];
    });
  }

  if (department === 'hotel') {
    return <div className="p-6 text-center text-xs text-gray-500">Hotel không chia chi nhánh.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">So sánh chi nhánh</h3>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="text-xs border rounded px-2 py-1">
          <option value="week">7 ngày</option>
          <option value="month">Tháng này</option>
          <option value="quarter">Quý này</option>
          <option value="year">Năm này</option>
        </select>
      </div>

      {/* Branch selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {branchList.map(b => {
          const on = selected.includes(b.id);
          const full = !on && selected.length >= 4;
          return (
            <button key={b.id} onClick={() => toggleBranch(b.id)} disabled={full}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                on ? 'bg-emerald-600 border-emerald-600 text-white' : full ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 hover:border-emerald-400'
              }`}>
              {on && '✓ '}{b.label}
            </button>
          );
        })}
        <span className="text-[10px] text-gray-400 self-center ml-1">Chọn 2–4 CN</span>
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 p-4">Đang tải...</div>
      ) : stats.length === 0 ? (
        <div className="text-xs text-gray-500 p-4">Chọn ít nhất 1 chi nhánh</div>
      ) : (
        <div className={`grid gap-3 ${stats.length === 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {stats.map(s => {
            const r = ranked[s.id] || {};
            const borderColor = r.isBest ? 'border-emerald-500' : r.isWorst && stats.length >= 2 ? 'border-rose-400' : 'border-gray-200';
            return (
              <div key={s.id} className={`bg-white border-2 ${borderColor} rounded-xl p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs">{s.label}</h4>
                  {r.isBest && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">🏆 Tốt nhất</span>}
                  {r.isWorst && stats.length >= 2 && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">⚠ Yếu</span>}
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <Row label="Task" value={`${s.done}/${s.total}`} sub={`${s.rate}%`} />
                  <ProgressBar pct={s.rate} />
                  <Row label="Trễ hạn" value={s.overdue} accent={s.overdue > 0 ? 'red' : ''} />
                  <Row label="Đề xuất duyệt" value={s.approved} sub={`${s.pending} chờ`} />
                  <Row label="Chi phí" value={fmtMoney(s.cost)} />
                  <Row label="Nhân sự" value={s.staff} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, sub, accent }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${accent === 'red' ? 'text-rose-600' : 'text-gray-900'}`}>
        {value} {sub && <span className="text-[9px] text-gray-400 font-normal ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function ProgressBar({ pct }) {
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: pct + '%' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Feature 22 — TREND CHART (completion rate + task count)
// ─────────────────────────────────────────────────────────
export function TrendChartSection({ department }) {
  const [grain, setGrain] = useState('week'); // week | month
  const [periods, setPeriods] = useState(8); // 8 or 12
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  function rangeStart() {
    const now = new Date();
    if (grain === 'week') {
      const d = new Date(now); d.setDate(now.getDate() - periods * 7); return d;
    }
    const d = new Date(now.getFullYear(), now.getMonth() - periods + 1, 1); return d;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = rangeStart();
      const { data } = await supabase.from('tasks')
        .select('id, status, created_at, completed_at, deadline')
        .eq('department', department).is('parent_id', null)
        .gte('created_at', start.toISOString());
      setTasks(data || []);
      setLoading(false);
    })();
  }, [department, grain, periods]);

  // Bucket tasks by period
  const buckets = useMemo(() => {
    const now = new Date();
    const bs = [];
    for (let i = periods - 1; i >= 0; i--) {
      let label, start, end;
      if (grain === 'week') {
        end = new Date(now); end.setDate(now.getDate() - i * 7); end.setHours(23, 59, 59, 999);
        start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
        label = `T${start.getDate()}/${start.getMonth() + 1}`;
      } else {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        start = m; end = new Date(m.getFullYear(), m.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
        label = `${m.getMonth() + 1}/${String(m.getFullYear()).slice(2)}`;
      }
      const inRange = tasks.filter(t => {
        const c = new Date(t.created_at);
        return c >= start && c <= end;
      });
      const done = inRange.filter(t => t.status === 'done').length;
      const overdue = inRange.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
      bs.push({ label, total: inRange.length, done, overdue, rate: pct(done, inRange.length) });
    }
    return bs;
  }, [tasks, grain, periods]);

  const maxCount = Math.max(1, ...buckets.map(b => b.total));

  // SVG paths
  const W = 720, H = 220, pad = 32;
  const barW = (W - pad * 2) / buckets.length;

  const ratePath = buckets.map((b, i) => {
    const x = pad + i * barW + barW / 2;
    const y = pad + (H - pad * 2) * (1 - b.rate / 100);
    return (i === 0 ? 'M' : 'L') + x + ' ' + y;
  }).join(' ');

  // Trend arrow for latest vs first
  const first = buckets[0]?.rate || 0;
  const last = buckets[buckets.length - 1]?.rate || 0;
  const overallTrend = last - first;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-sm">Xu hướng theo thời gian</h3>
        <div className="flex gap-2">
          <select value={grain} onChange={e => setGrain(e.target.value)} className="text-xs border rounded px-2 py-1">
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </select>
          <select value={periods} onChange={e => setPeriods(Number(e.target.value))} className="text-xs border rounded px-2 py-1">
            <option value={6}>6 kỳ</option>
            <option value={8}>8 kỳ</option>
            <option value={12}>12 kỳ</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-2 mb-3 text-xs">
        <div className="px-3 py-2 bg-emerald-50 rounded-lg flex-1">
          <div className="text-[10px] text-gray-500">Tỷ lệ hoàn thành (mới nhất)</div>
          <div className="text-lg font-bold text-emerald-700">{last}%</div>
        </div>
        <div className="px-3 py-2 bg-gray-50 rounded-lg flex-1">
          <div className="text-[10px] text-gray-500">So với kỳ đầu ({first}%)</div>
          <div className={`text-lg font-bold ${overallTrend > 0 ? 'text-emerald-700' : overallTrend < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
            {overallTrend > 0 ? '📈 +' : overallTrend < 0 ? '📉 ' : '→ '}{overallTrend}%
          </div>
        </div>
        <div className="px-3 py-2 bg-blue-50 rounded-lg flex-1">
          <div className="text-[10px] text-gray-500">Tổng task trong khung</div>
          <div className="text-lg font-bold text-blue-700">{buckets.reduce((s, b) => s + b.total, 0)}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 p-4">Đang tải...</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, width: '100%', height: H }}>
            {/* Y-axis gridlines */}
            {[0, 25, 50, 75, 100].map(y => {
              const py = pad + (H - pad * 2) * (1 - y / 100);
              return (
                <g key={y}>
                  <line x1={pad} y1={py} x2={W - pad} y2={py} stroke="#f3f4f6" strokeWidth={1} />
                  <text x={8} y={py + 3} fontSize={9} fill="#9ca3af">{y}%</text>
                </g>
              );
            })}

            {/* Bars = task count */}
            {buckets.map((b, i) => {
              const x = pad + i * barW + 6;
              const bw = barW - 12;
              const bh = (H - pad * 2) * (b.total / maxCount);
              const by = H - pad - bh;
              return (
                <g key={i}>
                  <rect x={x} y={by} width={bw} height={bh} fill="#dbeafe" rx={2} />
                  {b.total > 0 && <text x={x + bw / 2} y={by - 3} fontSize={9} fill="#1e40af" textAnchor="middle">{b.total}</text>}
                </g>
              );
            })}

            {/* Line = completion rate */}
            <path d={ratePath} stroke="#16a34a" strokeWidth={2} fill="none" />
            {buckets.map((b, i) => {
              const x = pad + i * barW + barW / 2;
              const y = pad + (H - pad * 2) * (1 - b.rate / 100);
              return (
                <g key={'pt' + i}>
                  <circle cx={x} cy={y} r={3} fill="#16a34a" />
                  <text x={x} y={y - 7} fontSize={9} fill="#15803d" textAnchor="middle" fontWeight={600}>{b.rate}%</text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {buckets.map((b, i) => {
              const x = pad + i * barW + barW / 2;
              return <text key={'x' + i} x={x} y={H - 8} fontSize={9} fill="#6b7280" textAnchor="middle">{b.label}</text>;
            })}
          </svg>

          <div className="flex gap-4 mt-2 text-[10px] text-gray-500 justify-end">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-600" /> Tỷ lệ hoàn thành</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-200" /> Số task tạo</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Feature 23 — WORK HEATMAP (7x24)
// ─────────────────────────────────────────────────────────
export function WorkHeatmapSection({ department }) {
  const [range, setRange] = useState(30); // 30 or 90 days
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = new Date(); start.setDate(start.getDate() - range);
      const { data } = await supabase.from('tasks')
        .select('id, status, completed_at')
        .eq('department', department).is('parent_id', null)
        .eq('status', 'done')
        .gte('completed_at', start.toISOString())
        .not('completed_at', 'is', null);
      setTasks(data || []);
      setLoading(false);
    })();
  }, [department, range]);

  // Build 7x24 matrix — day 0 = Monday
  const matrix = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    tasks.forEach(t => {
      const d = new Date(t.completed_at);
      const dow = (d.getDay() + 6) % 7; // Mon=0, Sun=6
      const hour = d.getHours();
      m[dow][hour]++;
    });
    return m;
  }, [tasks]);

  const max = Math.max(1, ...matrix.flat());

  // Aggregations
  const totalDone = tasks.length;
  const byDow = matrix.map(row => row.reduce((s, x) => s + x, 0));
  const byHour = Array(24).fill(0);
  matrix.forEach(row => row.forEach((c, h) => byHour[h] += c));
  const peakDowIdx = byDow.indexOf(Math.max(...byDow));
  const peakHourIdx = byHour.indexOf(Math.max(...byHour));
  const dowLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const dowFull = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  function cellColor(v) {
    if (v === 0) return '#f9fafb';
    const intensity = v / max;
    if (intensity >= 0.75) return '#065f46';
    if (intensity >= 0.5) return '#10b981';
    if (intensity >= 0.25) return '#6ee7b7';
    return '#d1fae5';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-sm">Heatmap giờ làm việc (task hoàn thành)</h3>
        <select value={range} onChange={e => setRange(Number(e.target.value))} className="text-xs border rounded px-2 py-1">
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
          <option value={90}>90 ngày qua</option>
        </select>
      </div>

      {/* Insights */}
      <div className="flex gap-2 mb-3 text-xs flex-wrap">
        <div className="px-3 py-2 bg-gray-50 rounded-lg flex-1 min-w-[140px]">
          <div className="text-[10px] text-gray-500">Tổng task hoàn thành</div>
          <div className="text-lg font-bold">{totalDone}</div>
        </div>
        <div className="px-3 py-2 bg-emerald-50 rounded-lg flex-1 min-w-[140px]">
          <div className="text-[10px] text-gray-500">Ngày năng suất nhất</div>
          <div className="text-sm font-bold text-emerald-700">{byDow[peakDowIdx] > 0 ? dowFull[peakDowIdx] : '—'}</div>
          <div className="text-[10px] text-gray-500">{byDow[peakDowIdx]} task</div>
        </div>
        <div className="px-3 py-2 bg-blue-50 rounded-lg flex-1 min-w-[140px]">
          <div className="text-[10px] text-gray-500">Giờ năng suất nhất</div>
          <div className="text-sm font-bold text-blue-700">{byHour[peakHourIdx] > 0 ? `${peakHourIdx}:00–${peakHourIdx + 1}:00` : '—'}</div>
          <div className="text-[10px] text-gray-500">{byHour[peakHourIdx]} task</div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 p-4">Đang tải...</div>
      ) : totalDone === 0 ? (
        <div className="text-xs text-gray-400 p-6 text-center bg-gray-50 rounded-lg">Chưa có task hoàn thành trong khoảng này.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">
          <table className="w-full text-center" style={{ fontSize: 9, minWidth: 640 }}>
            <thead>
              <tr>
                <th className="text-left w-8 text-gray-400 font-normal pr-1"></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="text-gray-400 font-normal" style={{ width: 22, fontSize: 8 }}>
                    {h % 3 === 0 ? h : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, d) => (
                <tr key={d}>
                  <td className="text-left pr-1 text-gray-500 font-medium">{dowLabels[d]}</td>
                  {row.map((v, h) => (
                    <td key={h} style={{ padding: 1 }}>
                      <div
                        title={`${dowFull[d]} ${h}:00 — ${v} task`}
                        style={{
                          width: 20, height: 20, borderRadius: 3,
                          background: cellColor(v), margin: '0 auto',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: v > max * 0.5 ? '#fff' : '#374151',
                          fontSize: 8, fontWeight: 600,
                          border: v === 0 ? '1px solid #f3f4f6' : 'none',
                        }}>
                        {v > 0 ? v : ''}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500 justify-end">
            <span>Ít</span>
            {['#f9fafb', '#d1fae5', '#6ee7b7', '#10b981', '#065f46'].map((c, i) => (
              <span key={i} style={{ width: 14, height: 14, background: c, borderRadius: 2, border: c === '#f9fafb' ? '1px solid #e5e7eb' : 'none' }} />
            ))}
            <span>Nhiều</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            💡 Gợi ý: giao task nặng vào các giờ và ngày có màu đậm để tối ưu tốc độ hoàn thành.
          </p>
        </div>
      )}
    </div>
  );
}
