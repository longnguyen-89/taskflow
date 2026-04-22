import { useState, useMemo } from 'react';

export default function Performance({ tasks, members, department, userId, profile, isAdmin, isDirector }) {
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      const score = cr * 0.4 + otr * 0.4 + Math.max(0, 100 - avg * 10) * 0.2;

      let grade, gradeColor, gradeBg;
      if (score >= 85) { grade = 'A+'; gradeColor = 'var(--accent)'; gradeBg = 'var(--accent-soft)'; }
      else if (score >= 70) { grade = 'B+'; gradeColor = 'var(--violet)'; gradeBg = 'var(--violet-soft)'; }
      else if (score >= 50) { grade = 'C';  gradeColor = 'var(--warn)';   gradeBg = 'var(--warn-soft)'; }
      else                 { grade = 'D';  gradeColor = 'var(--danger)'; gradeBg = 'var(--danger-soft)'; }

      let feedback = '';
      if (cr >= 90 && otr >= 90) feedback = 'Xuất sắc! Tỷ lệ hoàn thành và đúng hạn rất cao. Hãy duy trì phong độ này!';
      else if (cr >= 70) feedback = 'Khá tốt. Cố gắng hoàn thành thêm các task còn lại và chú ý deadline.';
      else if (cr >= 50) feedback = 'Cần cải thiện tốc độ hoàn thành. Hãy ưu tiên task có deadline gần nhất trước.';
      else if (mt.length > 0) feedback = 'Cần trao đổi trực tiếp. Nhiều task chưa hoàn thành, có thể cần hỗ trợ hoặc điều chỉnh khối lượng công việc.';
      else feedback = 'Chưa có task nào trong kỳ đánh giá này.';
      if (overdue.length > 0) feedback += ` ${overdue.length} task đang trễ hạn.`;

      return { member, total: mt.length, done: done.length, doing: doing.length, waiting: waiting.length, overdue: overdue.length, cr, otr, avg: avg.toFixed(1), score: Math.round(score), grade, gradeColor, gradeBg, feedback };
    }).sort((a, b) => b.score - a.score);
  }, [tasks, members, period, department, userId, profile, isAdmin, isDirector, dateFrom, dateTo]);

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const PERIODS = { week: 'Tuần', month: 'Tháng', quarter: 'Quý', year: 'Năm' };

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Hiệu suất</h2>
        <p className="text-sm text-ink-3 mt-1">Bảng xếp hạng nhân viên theo tỉ lệ hoàn thành + đúng hạn.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <div className="flex p-0.5 rounded-lg" style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
          {Object.entries(PERIODS).map(([p, l]) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: period === p && !dateFrom ? '#fff' : 'transparent',
                color: period === p && !dateFrom ? 'var(--ink)' : 'var(--muted)',
                boxShadow: period === p && !dateFrom ? '0 1px 2px rgba(18,53,36,.05)' : 'none',
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-muted-ink ml-1">hoặc</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-muted-ink">→</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      <div className="space-y-3">
        {evaluations.map((ev, i) => (
          <div key={ev.member.id} className="card p-4">
            <div className="flex items-center gap-3 mb-4">
              {isDirector && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-sm font-bold flex-shrink-0" style={{
                  background: i === 0 ? 'var(--gold-soft)' : i < 3 ? 'var(--bg-soft)' : 'transparent',
                  color: i === 0 ? 'var(--gold)' : 'var(--muted)',
                  border: '1px solid var(--line)',
                }}>
                  #{i + 1}
                </div>
              )}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: ev.member.avatar_color, color: '#333' }}>
                {ini(ev.member.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate" style={{ letterSpacing: '-.005em' }}>{ev.member.name}</p>
                <p className="text-[11px] font-mono text-muted-ink">
                  {ev.member.position || '—'} · {ev.member.department === 'hotel' ? 'Hotel' : 'Nail'} · điểm {ev.score}
                </p>
              </div>
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold font-mono" style={{
                background: ev.gradeBg,
                color: ev.gradeColor,
                letterSpacing: '-.02em',
              }}>
                {ev.grade}
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {[
                { v: ev.total,       l: 'Tổng',         color: 'var(--ink)' },
                { v: ev.done,        l: 'Hoàn thành',   color: 'var(--accent)' },
                { v: ev.doing,       l: 'Đang làm',     color: 'var(--violet)' },
                { v: ev.waiting,     l: 'Chờ',          color: 'var(--warn)' },
                { v: `${ev.cr}%`,    l: 'Tỉ lệ xong',   color: ev.cr >= 70 ? 'var(--accent)' : 'var(--danger)' },
                { v: `${ev.avg}d`,   l: 'TB xong',      color: 'var(--ink-3)' },
              ].map(m => (
                <div key={m.l} className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-soft)' }}>
                  <p className="text-sm font-bold font-mono" style={{ color: m.color, letterSpacing: '-.01em' }}>{m.v}</p>
                  <p className="text-[10px] font-mono mt-0.5 text-muted-ink">{m.l}</p>
                </div>
              ))}
            </div>

            {/* Progress bars */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-ink w-20">Hoàn thành</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${ev.cr}%`, background: 'var(--accent)' }} />
                </div>
                <span className="text-[11px] font-semibold font-mono w-10 text-right text-ink">{ev.cr}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-ink w-20">Đúng hạn</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-soft)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${ev.otr}%`, background: ev.otr >= 80 ? 'var(--violet)' : 'var(--warn)' }} />
                </div>
                <span className="text-[11px] font-semibold font-mono w-10 text-right text-ink">{ev.otr}%</span>
              </div>
            </div>

            {/* AI Feedback */}
            <div className="p-3 rounded-lg text-xs leading-relaxed" style={{
              background: ev.gradeBg,
              color: ev.gradeColor,
              borderLeft: `3px solid ${ev.gradeColor}`,
            }}>
              <span className="font-semibold">Nhận xét: </span>{ev.feedback}
            </div>
          </div>
        ))}
        {evaluations.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-sm text-ink-3">Chưa có dữ liệu trong kỳ này</div>
          </div>
        )}
      </div>
    </div>
  );
}
