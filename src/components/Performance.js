import { useState, useMemo } from 'react';

export default function Performance({ tasks, members, department, userId, profile, isAdmin, isDirector }) {
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const evaluations = useMemo(() => {
    const now = new Date();
    let start, end = now;
    if (dateFrom && dateTo) { start = new Date(dateFrom); end = new Date(dateTo + 'T23:59:59'); }
    else if (period === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); }
    else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); }
    else { start = new Date(now.getFullYear(), 0, 1); }

    const selfBranches = Array.isArray(profile?.branches) ? profile.branches : [];
    const targetMembers = isDirector
      ? members.filter(m => m.role !== 'director' && m.department === department)
      : isAdmin
        ? members.filter(m =>
            m.id === userId ||
            (m.department === department && m.role === 'member' &&
             (department !== 'nail' || (Array.isArray(m.branches) && m.branches.some(b => selfBranches.includes(b)))))
          )
        : members.filter(m => m.id === userId);

    return targetMembers.map(member => {
      const mt = tasks.filter(t => {
        const assignees = t.assignees || [];
        return assignees.some(a => a.user_id === member.id) && t.approval_status !== 'pending' && new Date(t.created_at) >= start && new Date(t.created_at) <= end;
      });
      const done = mt.filter(t => t.status === 'done');
      const onTime = done.filter(t => !t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline));
      const overdue = mt.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now);
      const doing = mt.filter(t => t.status === 'doing');
      const waiting = mt.filter(t => t.status === 'waiting');

      const cr = mt.length > 0 ? Math.round((done.length / mt.length) * 100) : 0;
      const otr = done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 0;
      const avg = done.length > 0 ? done.reduce((s, t) => s + (new Date(t.completed_at || t.updated_at) - new Date(t.created_at)) / 86400000, 0) / done.length : 0;
      const score = Math.round(cr * 0.4 + otr * 0.4 + Math.max(0, 100 - avg * 10) * 0.2);

      // Sparkline: tỉ lệ hoàn thành trong 8 buckets thời gian đều
      const periodMs = end - start;
      const bucketCount = 8;
      const bucketMs = periodMs / bucketCount;
      const trend = Array.from({ length: bucketCount }, (_, i) => {
        const bStart = new Date(start.getTime() + i * bucketMs);
        const bEnd = new Date(start.getTime() + (i + 1) * bucketMs);
        const bTasks = mt.filter(t => new Date(t.created_at) >= bStart && new Date(t.created_at) < bEnd);
        const bDone = bTasks.filter(t => t.status === 'done');
        return bTasks.length > 0 ? Math.round((bDone.length / bTasks.length) * 100) : 0;
      });

      let grade, gradeColor, gradeBg;
      if (score >= 85) { grade = 'A+'; gradeColor = 'var(--accent)'; gradeBg = 'var(--accent-soft)'; }
      else if (score >= 70) { grade = 'A';  gradeColor = 'var(--accent)'; gradeBg = 'var(--accent-soft)'; }
      else if (score >= 60) { grade = 'B';  gradeColor = 'var(--violet)'; gradeBg = 'var(--violet-soft)'; }
      else if (score >= 50) { grade = 'C';  gradeColor = 'var(--warn)';   gradeBg = 'var(--warn-soft)'; }
      else                  { grade = 'D';  gradeColor = 'var(--danger)'; gradeBg = 'var(--danger-soft)'; }

      let feedback = '';
      if (cr >= 90 && otr >= 90) feedback = 'Xuất sắc! Tỷ lệ hoàn thành và đúng hạn rất cao. Hãy duy trì phong độ này!';
      else if (cr >= 70) feedback = 'Khá tốt. Cố gắng hoàn thành thêm các task còn lại và chú ý deadline.';
      else if (cr >= 50) feedback = 'Cần cải thiện tốc độ hoàn thành. Hãy ưu tiên task có deadline gần nhất trước.';
      else if (mt.length > 0) feedback = 'Cần trao đổi trực tiếp. Nhiều task chưa hoàn thành, có thể cần hỗ trợ hoặc điều chỉnh khối lượng công việc.';
      else feedback = 'Chưa có task nào trong kỳ đánh giá này.';
      if (overdue.length > 0) feedback += ` ${overdue.length} task đang trễ hạn.`;

      return { member, total: mt.length, done: done.length, doing: doing.length, waiting: waiting.length, overdue: overdue.length, cr, otr, avg: avg.toFixed(1), score, grade, gradeColor, gradeBg, feedback, trend };
    }).sort((a, b) => b.score - a.score);
  }, [tasks, members, period, department, userId, profile, isAdmin, isDirector, dateFrom, dateTo]);

  const withData = evaluations.filter(e => e.total > 0);
  const summary = useMemo(() => {
    if (withData.length === 0) return null;
    const avgScore = Math.round(withData.reduce((s, e) => s + e.score, 0) / withData.length);
    const avgCr = Math.round(withData.reduce((s, e) => s + e.cr, 0) / withData.length);
    const totalDone = withData.reduce((s, e) => s + e.done, 0);
    const totalOverdue = withData.reduce((s, e) => s + e.overdue, 0);
    const top = withData[0];
    return { avgScore, avgCr, totalDone, totalOverdue, top, count: withData.length };
  }, [withData]);

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const PERIODS = { week: 'Tuần', month: 'Tháng', quarter: 'Quý', year: 'Năm' };

  const rankBadge = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Hiệu suất nhân sự</h2>
          <p className="text-[13px] text-ink-3 mt-1">Xếp hạng theo tỉ lệ hoàn thành đúng hạn · {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : PERIODS[period].toLowerCase() + ' hiện tại'}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(PERIODS).map(([p, l]) => {
            const active = period === p && !dateFrom;
            return (
              <button
                key={p}
                onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: active ? 'var(--accent-soft)' : '#fff',
                  color: active ? 'var(--accent)' : 'var(--ink-2)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                  fontWeight: active ? 600 : 500,
                }}
              >{l}</button>
            );
          })}
        </div>
      </div>

      {/* Custom date range */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-xs font-mono text-muted-ink">Hoặc khoảng tùy chọn:</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-muted-ink">→</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[11px] text-muted-ink hover:text-ink underline">Bỏ chọn</button>
        )}
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="card p-3.5">
            <div className="eyebrow">Nhân sự đánh giá</div>
            <div className="text-[22px] font-semibold font-mono text-ink mt-1" style={{ letterSpacing: '-.02em' }}>{summary.count}</div>
            <div className="text-[11px] text-muted-ink mt-0.5">có task trong kỳ</div>
          </div>
          <div className="card p-3.5">
            <div className="eyebrow">Điểm trung bình</div>
            <div className="text-[22px] font-semibold font-mono mt-1" style={{ color: summary.avgScore >= 70 ? 'var(--accent)' : summary.avgScore >= 50 ? 'var(--warn)' : 'var(--danger)', letterSpacing: '-.02em' }}>{summary.avgScore}</div>
            <div className="text-[11px] text-muted-ink mt-0.5">TB hoàn thành {summary.avgCr}%</div>
          </div>
          <div className="card p-3.5">
            <div className="eyebrow">Đã hoàn thành</div>
            <div className="text-[22px] font-semibold font-mono text-ink mt-1" style={{ letterSpacing: '-.02em' }}>{summary.totalDone}</div>
            <div className="text-[11px] text-muted-ink mt-0.5">{summary.totalOverdue > 0 ? <span style={{ color: 'var(--danger)' }}>{summary.totalOverdue} trễ hạn</span> : 'Không trễ hạn'}</div>
          </div>
          <div className="card p-3.5">
            <div className="eyebrow">Top performer</div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: summary.top.member.avatar_color, color: '#333' }}>
                {ini(summary.top.member.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink truncate">{summary.top.member.name}</div>
                <div className="text-[10px] font-mono text-muted-ink mt-0.5">{summary.top.grade} · {summary.top.score} điểm</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking table */}
      {evaluations.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-sm text-ink-3">Chưa có nhân sự nào để đánh giá trong kỳ này</div>
        </div>
      ) : (
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          {/* Table header — desktop only */}
          <div className="hidden md:grid px-4 py-2.5" style={{
            gridTemplateColumns: '44px 1fr 60px 56px 1fr 72px 108px 60px 28px',
            gap: 12,
            background: 'var(--bg-soft)',
            borderBottom: '1px solid var(--line)',
            fontSize: 10,
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}>
            <div>#</div>
            <div>Nhân sự</div>
            <div>Điểm</div>
            <div>Hạng</div>
            <div>Hoàn thành</div>
            <div>Đúng hạn</div>
            <div>Xu hướng</div>
            <div style={{ textAlign: 'right' }}>Trễ</div>
            <div></div>
          </div>

          {evaluations.map((ev, i) => {
            const isExpanded = expandedId === ev.member.id;
            const isLast = i === evaluations.length - 1;
            return (
              <div key={ev.member.id} style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--line-2, var(--line))' }}>
                {/* Row — desktop */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ev.member.id)}
                  className="hidden md:grid w-full items-center hover:bg-bone-soft transition-colors text-left px-4 py-3"
                  style={{
                    gridTemplateColumns: '44px 1fr 60px 56px 1fr 72px 108px 60px 28px',
                    gap: 12,
                  }}
                >
                  <div className="text-sm font-semibold font-mono" style={{ color: i < 3 ? 'var(--ink)' : 'var(--muted)' }}>
                    {rankBadge(i)}
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0" style={{ background: ev.member.avatar_color, color: '#333' }}>
                      {ini(ev.member.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink truncate">{ev.member.name}</div>
                      <div className="text-[10px] font-mono text-muted-ink truncate">{ev.member.position || '—'}</div>
                    </div>
                  </div>
                  <div className="text-[18px] font-semibold font-mono text-ink" style={{ letterSpacing: '-.02em' }}>{ev.score}</div>
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono" style={{ background: ev.gradeBg, color: ev.gradeColor }}>
                      {ev.grade}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)', minWidth: 40 }}>
                      <div className="h-full rounded-full" style={{ width: `${ev.cr}%`, background: ev.gradeColor }} />
                    </div>
                    <span className="text-[11px] font-mono text-ink-3 flex-shrink-0" style={{ minWidth: 42, textAlign: 'right' }}>
                      {ev.done}/{ev.total}
                    </span>
                  </div>
                  <div className="text-[12px] font-mono" style={{ color: ev.otr >= 80 ? 'var(--accent)' : ev.otr >= 60 ? 'var(--warn)' : 'var(--danger)' }}>
                    {ev.otr}%
                  </div>
                  <Sparkline trend={ev.trend} color={ev.gradeColor} />
                  <div style={{ textAlign: 'right' }}>
                    {ev.overdue > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: 'rgba(181,68,58,.1)', color: 'var(--danger)' }}>
                        {ev.overdue}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-ink">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-muted-ink transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Row — mobile */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ev.member.id)}
                  className="md:hidden w-full text-left px-4 py-3 hover:bg-bone-soft transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 text-[12px] font-semibold font-mono flex-shrink-0" style={{ color: i < 3 ? 'var(--ink)' : 'var(--muted)' }}>
                      {rankBadge(i)}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ background: ev.member.avatar_color, color: '#333' }}>
                      {ini(ev.member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink truncate">{ev.member.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-muted-ink">{ev.done}/{ev.total}</span>
                        <span className="text-[10px] text-muted-ink">·</span>
                        <span className="text-[10px] font-mono" style={{ color: ev.otr >= 80 ? 'var(--accent)' : 'var(--warn)' }}>{ev.otr}% đúng hạn</span>
                        {ev.overdue > 0 && (
                          <>
                            <span className="text-[10px] text-muted-ink">·</span>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--danger)' }}>{ev.overdue} trễ</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[18px] font-semibold font-mono text-ink leading-none">{ev.score}</div>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono mt-1" style={{ background: ev.gradeBg, color: ev.gradeColor }}>
                        {ev.grade}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded row */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 animate-fade-in" style={{ background: 'var(--bg-soft)', borderTop: '1px solid var(--line-2, var(--line))' }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {[
                        { l: 'Đang làm', v: ev.doing, color: 'var(--violet)' },
                        { l: 'Chờ phản hồi', v: ev.waiting, color: 'var(--warn)' },
                        { l: 'Tỉ lệ xong', v: `${ev.cr}%`, color: ev.cr >= 70 ? 'var(--accent)' : 'var(--danger)' },
                        { l: 'TB xong', v: `${ev.avg}d`, color: 'var(--ink-3)' },
                      ].map(m => (
                        <div key={m.l} className="rounded-lg bg-white p-2.5 text-center" style={{ border: '1px solid var(--line)' }}>
                          <div className="text-base font-semibold font-mono" style={{ color: m.color, letterSpacing: '-.01em' }}>{m.v}</div>
                          <div className="text-[10px] font-mono text-muted-ink mt-0.5">{m.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-3 rounded-lg text-[12px] leading-relaxed" style={{
                      background: '#fff',
                      color: ev.gradeColor,
                      borderLeft: `3px solid ${ev.gradeColor}`,
                      border: '1px solid var(--line)',
                    }}>
                      <span className="font-semibold">Nhận xét: </span>
                      <span style={{ color: 'var(--ink-2)' }}>{ev.feedback}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sparkline polyline (mini trend chart) ──
function Sparkline({ trend, color }) {
  const W = 104, H = 24;
  const max = Math.max(...trend, 1);
  const pts = trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * (W - 2) + 1;
    const y = H - ((v / max) * (H - 4)) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {trend.map((v, i) => {
        const x = (i / (trend.length - 1)) * (W - 2) + 1;
        const y = H - ((v / max) * (H - 4)) - 2;
        return i === trend.length - 1 ? <circle key={i} cx={x} cy={y} r="2" fill={color} /> : null;
      })}
    </svg>
  );
}
