import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

// Map notification type → icon SVG path + tone
const NOTIF_STYLE = {
  new_task:         { tone: 'accent', pathD: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  task_approved:    { tone: 'ok',     pathD: 'M5 13l4 4L19 7' },
  task_rejected:    { tone: 'danger', pathD: 'M6 18L18 6M6 6l12 12' },
  reminder:         { tone: 'warn',   pathD: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  info:             { tone: 'muted',  pathD: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  approval_request: { tone: 'violet', pathD: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  mention:          { tone: 'accent', pathD: 'M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207' },
  approved:         { tone: 'ok',     pathD: 'M5 13l4 4L19 7' },
  rejected:         { tone: 'danger', pathD: 'M6 18L18 6M6 6l12 12' },
  ceo_report:       { tone: 'accent', pathD: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  task_assigned:    { tone: 'accent', pathD: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
};

const toneToColors = (tone) => {
  switch (tone) {
    case 'accent': return { color: 'var(--accent)', bg: 'var(--accent-soft)' };
    case 'ok':     return { color: 'var(--accent)', bg: 'var(--accent-soft)' };
    case 'warn':   return { color: 'var(--warn)',   bg: 'var(--warn-soft)' };
    case 'danger': return { color: 'var(--danger)', bg: 'var(--danger-soft)' };
    case 'violet': return { color: 'var(--violet)', bg: 'var(--violet-soft)' };
    default:       return { color: 'var(--muted)',  bg: 'var(--bg-soft)' };
  }
};

const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v || 0) + 'đ';

// Health score color + icon
function healthBand(h) {
  if (h >= 75) return { color: 'var(--accent)', bg: 'var(--accent-soft)', icon: '✓', label: 'Tốt' };
  if (h >= 50) return { color: 'var(--warn)',   bg: 'var(--warn-soft)',   icon: '!', label: 'Cần chú ý' };
  return          { color: 'var(--danger)', bg: 'var(--danger-soft)', icon: '⚠', label: 'Báo động' };
}

function trendDelta(cur, prev) {
  if (prev === 0 && cur === 0) return { txt: '—', color: 'var(--muted)' };
  if (prev === 0) return { txt: '▲ mới', color: 'var(--accent)' };
  const pct = Math.round((cur - prev) / prev * 100);
  if (pct === 0) return { txt: '→ 0%', color: 'var(--muted)' };
  return pct > 0
    ? { txt: '▲ +' + pct + '%', color: 'var(--accent)' }
    : { txt: '▼ ' + pct + '%', color: 'var(--danger)' };
}

// ═══════ CEO Report Card ═══════
function CEOReportCard({ data, title, createdAt, unread }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || !data.nail || !data.hotel) return null;
  const { nail, hotel, totals, periodLabel } = data;
  const totalHealth = Math.round(((nail.health || 0) + (hotel.health || 0)) / 2);
  const band = healthBand(totalHealth);
  const dt = new Date(createdAt);
  const dtStr = dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="card p-0 overflow-hidden transition-all" style={{
      borderColor: unread ? 'var(--accent)' : 'var(--line)',
      boxShadow: unread ? '0 0 0 3px var(--accent-soft)' : undefined,
    }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3" style={{
        background: 'linear-gradient(135deg, var(--accent-soft) 0%, #fff 100%)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: '#fff', border: '1px solid var(--line)', color: 'var(--accent)',
        }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={NOTIF_STYLE.ceo_report.pathD} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate" style={{ letterSpacing: '-.005em' }}>
            Báo cáo {periodLabel?.toLowerCase() || 'tuần'} — CCE Group
          </p>
          <p className="text-[11px] font-mono text-muted-ink">{dtStr}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-ink">Điểm TB</div>
          <div className="text-base font-bold font-mono" style={{ color: band.color, letterSpacing: '-.02em' }}>
            {totalHealth}/100 <span className="text-sm">{band.icon}</span>
          </div>
        </div>
      </div>

      {/* Totals strip */}
      <div className="px-4 py-2.5 flex items-center gap-4" style={{ background: 'var(--bg-soft)', borderBottom: '1px solid var(--line)' }}>
        <div className="flex-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-ink">Tổng task</div>
          <div className="text-sm font-bold text-ink font-mono" style={{ letterSpacing: '-.01em' }}>
            {totals.done}/{totals.tasks} <span className="text-xs" style={{ color: 'var(--accent)' }}>({totals.rate}%)</span>
          </div>
        </div>
        <div className="w-px h-8" style={{ background: 'var(--line)' }} />
        <div className="flex-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-ink">Tổng chi phí</div>
          <div className="text-sm font-bold text-ink font-mono" style={{ letterSpacing: '-.01em' }}>{fmtMoney(totals.cost)}</div>
        </div>
      </div>

      {/* 2-column blocks */}
      <div className="grid grid-cols-2 gap-0">
        <DeptBlock name="NAIL" accent="var(--accent)" d={nail} />
        <div style={{ borderLeft: '1px solid var(--line)' }}>
          <DeptBlock name="HOTEL" accent="var(--violet)" d={hotel} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 space-y-2 text-[11px]" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-soft)', color: 'var(--ink-3)' }}>
          <div className="grid grid-cols-2 gap-2">
            <MiniRow label="Đúng hạn Nail"   value={`${nail.onTimeRate || 0}%`} />
            <MiniRow label="Đúng hạn Hotel"  value={`${hotel.onTimeRate || 0}%`} />
            <MiniRow label="Task Nail trước" value={`${nail.prevRate || 0}%`} />
            <MiniRow label="Task Hotel trước" value={`${hotel.prevRate || 0}%`} />
            <MiniRow label="Trễ Nail trước"  value={`${nail.prevOverdue || 0}`} />
            <MiniRow label="Trễ Hotel trước" value={`${hotel.prevOverdue || 0}`} />
            <MiniRow label="Chi phí Nail trước"  value={fmtMoney(nail.prevCost || 0)} />
            <MiniRow label="Chi phí Hotel trước" value={fmtMoney(hotel.prevCost || 0)} />
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
        className="w-full py-1.5 text-[11px] font-medium hover:bg-bone-soft transition-colors"
        style={{ color: 'var(--accent)', borderTop: '1px solid var(--line)' }}
      >
        {expanded ? '▲ Ẩn chi tiết' : '▼ Xem thêm chi tiết & so sánh kỳ trước'}
      </button>
    </div>
  );
}

function DeptBlock({ name, accent, d }) {
  const rate = d.rate || 0;
  const band = healthBand(d.health || 0);
  const rateTrend = trendDelta(d.rate, d.prevRate);
  const costTrend = trendDelta(d.cost, d.prevCost);
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-xs font-bold font-mono" style={{ color: accent, letterSpacing: '.05em' }}>{name}</span>
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: band.bg, color: band.color }}>{d.health || 0}</span>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-0.5">
          <span className="text-[10px] font-mono text-muted-ink">Hoàn thành</span>
          <span className="text-[10px] font-semibold font-mono" style={{ color: accent }}>{d.done || 0}/{d.totalTasks || 0}</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: rate + '%', background: accent }} />
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="text-[10px] font-mono" style={{ color: rateTrend.color }}>{rateTrend.txt}</span>
          <span className="text-[10px] font-bold font-mono" style={{ color: accent }}>{rate}%</span>
        </div>
      </div>
      <div className="space-y-1 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-muted-ink">Trễ hạn</span>
          <span className="font-semibold font-mono" style={{ color: (d.overdue || 0) > 0 ? 'var(--danger)' : 'var(--ink-2)' }}>{d.overdue || 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-muted-ink">Đề xuất duyệt/chờ</span>
          <span className="font-semibold font-mono text-ink-2">{d.approved || 0} / {d.pending || 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-muted-ink">Chi phí duyệt</span>
          <span className="font-semibold font-mono text-ink-2">{fmtMoney(d.cost || 0)}</span>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-[9px] font-mono" style={{ color: costTrend.color }}>{costTrend.txt}</span>
        </div>
      </div>
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-center justify-between bg-white rounded px-2 py-1" style={{ border: '1px solid var(--line)' }}>
      <span className="font-mono text-muted-ink">{label}</span>
      <span className="font-semibold font-mono text-ink-2">{value}</span>
    </div>
  );
}

// ═══════ Main Notifications component ═══════
function fmtDT(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function relTime(d) {
  if (!d) return '';
  const diff = (new Date() - new Date(d)) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày`;
  return new Date(d).toLocaleDateString('vi-VN');
}

function isToday(d) {
  const x = new Date(d);
  const t = new Date();
  return x.toDateString() === t.toDateString();
}

export default function Notifications({ notifications, userId, onRefresh, onOpen }) {
  async function markAll() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    toast('Đã đánh dấu tất cả là đã đọc', 'success');
    onRefresh();
  }
  async function markOne(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    onRefresh();
  }
  const unread = notifications.filter(n => !n.read);

  async function handleClick(n) {
    if (!n.read) await markOne(n.id);
    if (onOpen) onOpen(n);
  }

  // Group: today vs earlier
  const today = notifications.filter(n => isToday(n.created_at));
  const earlier = notifications.filter(n => !isToday(n.created_at));

  const renderNotif = (n) => {
    if (n.type === 'ceo_report' && n.data) {
      return (
        <div key={n.id} onClick={() => handleClick(n)} className="cursor-pointer">
          <CEOReportCard data={n.data} title={n.title} createdAt={n.created_at} unread={!n.read} />
        </div>
      );
    }
    const style = NOTIF_STYLE[n.type] || NOTIF_STYLE.info;
    const colors = toneToColors(style.tone);
    return (
      <div
        key={n.id}
        onClick={() => handleClick(n)}
        className="card p-3.5 flex items-start gap-3 cursor-pointer hover:shadow-card-hover transition-all"
        style={{
          borderLeft: !n.read ? '3px solid var(--accent)' : undefined,
          background: !n.read ? '#fff' : 'transparent',
          opacity: !n.read ? 1 : 0.75,
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: colors.bg, color: colors.color }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={style.pathD} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold text-ink truncate flex-1" style={{ letterSpacing: '-.005em' }}>{n.title}</p>
            <span className="text-[11px] font-mono text-muted-ink flex-shrink-0" title={fmtDT(n.created_at)}>{relTime(n.created_at)}</span>
          </div>
          <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: 'var(--ink-3)' }}>{n.message}</p>
        </div>
        {(n.task_id || n.proposal_id) && (
          <svg className="w-3.5 h-3.5 self-center flex-shrink-0" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Thông báo</h2>
          <p className="text-sm text-ink-3 mt-0.5">
            {unread.length > 0 ? (
              <><b style={{ color: 'var(--danger)' }}>{unread.length} chưa đọc</b> · {notifications.length} tổng</>
            ) : (
              <>Tất cả đã đọc · {notifications.length} thông báo</>
            )}
          </p>
        </div>
        {unread.length > 0 && (
          <button onClick={markAll} className="btn-secondary text-xs">
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-2">🔔</div>
          <div className="text-sm text-ink-3">Chưa có thông báo</div>
        </div>
      ) : (
        <div className="space-y-3">
          {today.length > 0 && (
            <>
              <div className="flex items-baseline gap-2 mt-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                <span className="text-sm font-semibold text-ink">Hôm nay</span>
                <span className="text-[11px] font-mono text-muted-ink">{today.length} thông báo</span>
              </div>
              <div className="space-y-2">{today.map(renderNotif)}</div>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <div className="flex items-baseline gap-2 mt-4 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted)' }} />
                <span className="text-sm font-semibold text-ink">Trước đó</span>
                <span className="text-[11px] font-mono text-muted-ink">{earlier.length} thông báo</span>
              </div>
              <div className="space-y-2">{earlier.map(renderNotif)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
