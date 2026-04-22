import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

const IC = { new_task: 'ðŸ“‹', task_approved: 'âœ…', task_rejected: 'âŒ', reminder: 'â°', info: 'ðŸ’¬', approval_request: 'ðŸ“', mention: 'ðŸ’¬', approved: 'âœ…', rejected: 'âŒ', ceo_report: 'ðŸ“Š' };

const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v || 0) + 'Ä‘';

// Health score color + icon
function healthBand(h) {
  if (h >= 75) return { color: '#16a34a', bg: '#dcfce7', icon: 'âœ…', label: 'Tá»‘t' };
  if (h >= 50) return { color: '#d97706', bg: '#fef3c7', icon: 'âš ï¸', label: 'Cáº§n chÃº Ã½' };
  return { color: '#dc2626', bg: '#fee2e2', icon: 'ðŸš¨', label: 'BÃ¡o Ä‘á»™ng' };
}

function trendDelta(cur, prev) {
  if (prev === 0 && cur === 0) return { txt: 'â€”', color: '#9ca3af' };
  if (prev === 0) return { txt: 'â–² má»›i', color: '#16a34a' };
  const pct = Math.round((cur - prev) / prev * 100);
  if (pct === 0) return { txt: 'â†’ 0%', color: '#9ca3af' };
  return pct > 0
    ? { txt: 'â–² +' + pct + '%', color: '#16a34a' }
    : { txt: 'â–¼ ' + pct + '%', color: '#dc2626' };
}

// â•â•â•â•â•â•â• CEO Report Card â€” render rich card khi type='ceo_report' â•â•â•â•â•â•â•
function CEOReportCard({ data, title, createdAt, unread }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || !data.nail || !data.hotel) return null; // fallback if corrupted
  const { nail, hotel, totals, periodLabel } = data;
  const totalHealth = Math.round(((nail.health || 0) + (hotel.health || 0)) / 2);
  const band = healthBand(totalHealth);
  const dt = new Date(createdAt);
  const dtStr = dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`card p-0 overflow-hidden transition-all ${unread ? 'border-emerald-300 shadow-sm' : 'opacity-80'}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${band.bg}, #fff)` }}>
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">ðŸ“Š</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">BÃ¡o cÃ¡o {periodLabel?.toLowerCase() || 'tuáº§n'} â€” CCE Group</p>
          <p className="text-[10px] text-gray-500">{dtStr}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 leading-none">Trung bÃ¬nh</div>
          <div className="text-base font-bold leading-tight" style={{ color: band.color }}>{totalHealth}/100 {band.icon}</div>
        </div>
      </div>

      {/* Totals strip */}
      <div className="px-4 py-2 bg-emerald-50/60 border-y border-emerald-100 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-[10px] text-gray-500">Tá»•ng task</div>
          <div className="text-sm font-bold text-gray-900">{totals.done}/{totals.tasks} <span className="text-emerald-700 text-xs">({totals.rate}%)</span></div>
        </div>
        <div className="w-px h-8 bg-emerald-200" />
        <div className="flex-1">
          <div className="text-[10px] text-gray-500">Tá»•ng chi phÃ­</div>
          <div className="text-sm font-bold text-gray-900">{fmtMoney(totals.cost)}</div>
        </div>
      </div>

      {/* 2-column dept blocks */}
      <div className="grid grid-cols-2 gap-0">
        <DeptBlock icon="ðŸŽ¨" name="NAIL" accent="#be185d" d={nail} />
        <div className="border-l border-gray-100">
          <DeptBlock icon="ðŸ¨" name="HOTEL" accent="#2563eb" d={hotel} />
        </div>
      </div>

      {/* Expand footer */}
      {expanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-2 text-[11px] text-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <MiniRow label="Tá»‰ lá»‡ Ä‘Ãºng háº¡n Nail" value={`${nail.onTimeRate || 0}%`} />
            <MiniRow label="Tá»‰ lá»‡ Ä‘Ãºng háº¡n Hotel" value={`${hotel.onTimeRate || 0}%`} />
            <MiniRow label="Task Nail ká»³ trÆ°á»›c" value={`${nail.prevRate || 0}%`} />
            <MiniRow label="Task Hotel ká»³ trÆ°á»›c" value={`${hotel.prevRate || 0}%`} />
            <MiniRow label="Trá»… háº¡n Nail trÆ°á»›c" value={`${nail.prevOverdue || 0}`} />
            <MiniRow label="Trá»… háº¡n Hotel trÆ°á»›c" value={`${hotel.prevOverdue || 0}`} />
            <MiniRow label="Chi phÃ­ Nail trÆ°á»›c" value={fmtMoney(nail.prevCost || 0)} />
            <MiniRow label="Chi phÃ­ Hotel trÆ°á»›c" value={fmtMoney(hotel.prevCost || 0)} />
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
        className="w-full py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 border-t border-gray-100">
        {expanded ? 'â–² áº¨n chi tiáº¿t' : 'â–¼ Xem thÃªm chi tiáº¿t & so sÃ¡nh ká»³ trÆ°á»›c'}
      </button>
    </div>
  );
}

function DeptBlock({ icon, name, accent, d }) {
  const rate = d.rate || 0;
  const band = healthBand(d.health || 0);
  const rateTrend = trendDelta(d.rate, d.prevRate);
  const costTrend = trendDelta(d.cost, d.prevCost);
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold" style={{ color: accent }}>{name}</span>
        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: band.bg, color: band.color }}>{d.health || 0}</span>
      </div>
      {/* Progress */}
      <div>
        <div className="flex items-baseline justify-between mb-0.5">
          <span className="text-[10px] text-gray-500">HoÃ n thÃ nh</span>
          <span className="text-[10px] font-semibold" style={{ color: accent }}>{d.done || 0}/{d.totalTasks || 0}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: rate + '%', background: accent }} />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-[10px]" style={{ color: rateTrend.color }}>{rateTrend.txt}</span>
          <span className="text-[10px] font-bold" style={{ color: accent }}>{rate}%</span>
        </div>
      </div>
      {/* Stats rows */}
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Trá»… háº¡n</span>
          <span className={`font-semibold ${(d.overdue || 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>{d.overdue || 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Äá» xuáº¥t duyá»‡t/chá»</span>
          <span className="font-semibold text-gray-700">{d.approved || 0} / {d.pending || 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Chi phÃ­ duyá»‡t</span>
          <span className="font-semibold text-gray-700">{fmtMoney(d.cost || 0)}</span>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-[9px]" style={{ color: costTrend.color }}>{costTrend.txt}</span>
        </div>
      </div>
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-center justify-between bg-white rounded px-2 py-1 border border-gray-100">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export default function Notifications({ notifications, userId, onRefresh, onOpen }) {
  async function markAll() { await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false); toast('ÄÃ£ Ä‘á»c', 'success'); onRefresh(); }
  async function markOne(id) { await supabase.from('notifications').update({ read: true }).eq('id', id); onRefresh(); }
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const unread = notifications.filter(n => !n.read);

  async function handleClick(n) {
    if (!n.read) await markOne(n.id);
    if (onOpen) onOpen(n);
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg" style={{ color: '#123524' }}>ThÃ´ng bÃ¡o {unread.length > 0 && <span className="text-xs text-red-500">({unread.length} má»›i)</span>}</h2>
        {unread.length > 0 && <button onClick={markAll} className="text-xs font-medium hover:underline" style={{ color: '#123524' }}>ÄÃ¡nh dáº¥u Ä‘Ã£ Ä‘á»c</button>}
      </div>
      {notifications.length === 0 ? <div className="card p-10 text-center text-gray-400 text-sm">ðŸ”” ChÆ°a cÃ³ thÃ´ng bÃ¡o</div> : (
        <div className="space-y-2">
          {notifications.map(n => {
            // CEO Report: rich card
            if (n.type === 'ceo_report' && n.data) {
              return (
                <div key={n.id} onClick={() => handleClick(n)} className="cursor-pointer">
                  <CEOReportCard data={n.data} title={n.title} createdAt={n.created_at} unread={!n.read} />
                </div>
              );
            }
            // Default notification render
            return (
              <div key={n.id} onClick={() => handleClick(n)}
                className={`card p-3.5 flex gap-2.5 cursor-pointer transition-all hover:shadow-sm ${!n.read ? 'border-emerald-200 bg-emerald-50/30' : 'opacity-60'}`}>
                {!n.read && <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: '#123524' }} />}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-gray-100">{IC[n.type] || 'ðŸ’¬'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-line">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtDT(n.created_at)}</p>
                </div>
                {(n.task_id || n.proposal_id) && (
                  <svg className="w-3.5 h-3.5 text-gray-300 self-center flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
