// MyTasks.js — "Task của tôi": tất cả task liên quan đến user, nhóm theo ngày deadline.
// Click 1 task -> gọi onOpenTask để dashboard focus & expand task đó trong tab Dashboard.
import { useState, useMemo } from 'react';

const ST = {
  todo:    { l: 'Chưa làm',    tone: 'muted',  color: 'var(--muted)' },
  doing:   { l: 'Đang làm',    tone: 'accent', color: 'var(--accent)' },
  done:    { l: 'Hoàn thành',  tone: 'ok',     color: 'var(--accent)' },
  waiting: { l: 'Chờ phản hồi', tone: 'warn',  color: 'var(--warn)' },
};
const PR = {
  high:   { l: 'Cao', color: 'var(--danger)',  bg: 'var(--danger-soft)' },
  medium: { l: 'TB',  color: 'var(--warn)',    bg: 'var(--warn-soft)' },
  low:    { l: 'Thấp', color: 'var(--accent)', bg: 'var(--accent-soft)' },
};

function ymdVN(d) {
  if (!d) return null;
  const x = new Date(d);
  const vn = new Date(x.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}
function todayVN() { return ymdVN(new Date()); }
function addDaysVN(n) { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return ymdVN(d); }

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
function fmtDateLong(d) {
  if (!d) return '';
  const dt = new Date(d);
  const w = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dt.getDay()];
  return `${w}, ${dt.toLocaleDateString('vi-VN')}`;
}
function fmtRange(startD, endD) {
  if (!startD || !endD) return '';
  return `${fmtDate(startD + 'T12:00:00Z')} → ${fmtDate(endD + 'T12:00:00Z')}`;
}

export default function MyTasks({ tasks, members, userId, onOpenTask, profileName }) {
  const [filter, setFilter] = useState('all');

  const mine = useMemo(() => {
    return (tasks || []).filter(t =>
      t.approval_status !== 'pending' &&
      !t.parent_id &&
      (
        t.assignees?.some(a => a.user_id === userId) ||
        t.watchers?.some(w => w.user_id === userId) ||
        t.created_by === userId
      )
    );
  }, [tasks, userId]);

  const stats = useMemo(() => ({
    total: mine.length,
    todo: mine.filter(t => t.status === 'todo').length,
    doing: mine.filter(t => t.status === 'doing').length,
    done: mine.filter(t => t.status === 'done').length,
    waiting: mine.filter(t => t.status === 'waiting').length,
    overdue: mine.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length,
  }), [mine]);

  const filtered = useMemo(() => {
    if (filter === 'active') return mine.filter(t => t.status !== 'done');
    if (filter === 'done') return mine.filter(t => t.status === 'done');
    return mine;
  }, [mine, filter]);

  const groups = useMemo(() => {
    const today = todayVN();
    const tomorrow = addDaysVN(1);
    const in7 = addDaysVN(7);
    const map = { overdue: [], today: [], tomorrow: [], week: [], later: [], noDl: [], done: [] };

    for (const t of filtered) {
      if (t.status === 'done') { map.done.push(t); continue; }
      if (!t.deadline) { map.noDl.push(t); continue; }
      const d = ymdVN(t.deadline);
      if (d < today) map.overdue.push(t);
      else if (d === today) map.today.push(t);
      else if (d === tomorrow) map.tomorrow.push(t);
      else if (d < in7) map.week.push(t);
      else map.later.push(t);
    }

    const byDl = (a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0);
    Object.keys(map).forEach(k => map[k].sort(byDl));

    return {
      overdue: map.overdue,
      today: map.today,
      tomorrow: map.tomorrow,
      week: map.week,
      later: map.later,
      noDl: map.noDl,
      done: map.done,
    };
  }, [filtered]);

  function relation(t) {
    const isAssignee = t.assignees?.some(a => a.user_id === userId);
    const isWatcher = t.watchers?.some(w => w.user_id === userId);
    const isCreator = t.created_by === userId;
    if (isAssignee) return { l: 'Được giao', cls: 'pill-accent' };
    if (isCreator) return { l: 'Tôi giao', cls: 'pill-violet' };
    if (isWatcher) return { l: 'Theo dõi', cls: 'pill-ghost' };
    return null;
  }

  function Row({ t }) {
    const st = ST[t.status] || ST.todo;
    const pr = PR[t.priority] || PR.medium;
    const rel = relation(t);
    const done = t.status === 'done';
    const od = !done && t.deadline && new Date(t.deadline) < new Date();
    const dueColor = od ? 'var(--danger)' : (ymdVN(t.deadline) === todayVN() ? 'var(--warn)' : 'var(--ink-3)');
    const dueBg    = od ? 'var(--danger-soft)' : (ymdVN(t.deadline) === todayVN() ? 'var(--warn-soft)' : 'var(--bg-soft)');

    const creatorName = members?.find(m => m.id === t.created_by)?.name || 'Ai đó';
    const branch = t.branch || null;

    return (
      <button
        onClick={() => onOpenTask && onOpenTask(t.id)}
        className="w-full text-left card flex items-center gap-3 px-3 py-2.5 mb-1.5 hover:shadow-card-hover transition-all group"
        style={od ? { borderLeft: '3px solid var(--danger)' } : {}}
      >
        {/* Check circle (read-only visual) */}
        <div
          className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            border: `1.5px solid ${done ? 'var(--accent)' : 'var(--line)'}`,
            background: done ? 'var(--accent)' : 'var(--card)',
          }}
        >
          {done && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Title + metadata */}
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate"
            style={{
              color: done ? 'var(--muted)' : 'var(--ink)',
              textDecoration: done ? 'line-through' : 'none',
              letterSpacing: '-.005em',
            }}
          >
            {t.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono truncate" style={{ color: 'var(--muted)' }}>
            <span>#{String(t.id).slice(0, 6)}</span>
            <span>·</span>
            <span className="truncate">Giao bởi {creatorName}</span>
            {branch && <><span>·</span><span className="hidden sm:inline">{branch}</span></>}
          </div>
        </div>

        {/* Right side: relation + priority + due */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rel && <span className={`pill ${rel.cls} hidden md:inline-flex`}>{rel.l}</span>}
          {t.priority === 'high' && (
            <span className="pill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd"/></svg>
              Cao
            </span>
          )}
          {t.deadline && (
            <span className="pill font-mono" style={{ background: dueBg, color: dueColor, fontSize: 11 }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fmtDate(t.deadline)}
            </span>
          )}
        </div>
      </button>
    );
  }

  function GroupHeader({ label, sub, tone, count }) {
    const toneColor = tone === 'danger' ? 'var(--danger)'
                    : tone === 'warn' ? 'var(--warn)'
                    : tone === 'accent' ? 'var(--accent)'
                    : tone === 'ok' ? 'var(--accent)'
                    : 'var(--muted)';
    return (
      <div className="flex items-baseline gap-2 mb-2 mt-3">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: toneColor }} />
        <span className="text-sm font-semibold text-ink" style={{ letterSpacing: '-.005em' }}>{label}</span>
        <span className="text-[11px] font-mono text-muted-ink">
          {sub && <>{sub} · </>}{count} task
        </span>
      </div>
    );
  }

  // Calculate sub-labels for week/later groupings
  const today = todayVN();
  const tomorrow = addDaysVN(1);
  const in7 = addDaysVN(7);
  const weekEnd = addDaysVN(7);
  const laterStart = addDaysVN(8);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold text-ink" style={{ letterSpacing: '-.015em' }}>Task của tôi</h2>
        <p className="text-sm text-ink-3 mt-1">
          Bạn có <b className="text-ink">{stats.total} task</b>
          {stats.today > 0 && <> — <span style={{ color: 'var(--warn)' }}>{stats.today} đến hạn hôm nay</span></>}
          {stats.overdue > 0 && <>, <span style={{ color: 'var(--danger)' }}>{stats.overdue} trễ cần giải thích</span></>}.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { k: stats.total,   l: 'Tổng',    color: 'var(--ink)' },
          { k: stats.today,   l: 'Hôm nay', color: 'var(--warn)' },
          { k: stats.overdue, l: 'Trễ',     color: 'var(--danger)' },
          { k: stats.doing + stats.todo, l: 'Sắp tới', color: 'var(--accent)' },
        ].map(s => (
          <div key={s.l} className="card p-3.5 flex items-center gap-3">
            <div className="text-2xl font-semibold font-mono leading-none" style={{ color: s.color, letterSpacing: '-.02em' }}>{s.k}</div>
            <div className="text-xs text-ink-3">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex p-0.5 rounded-lg w-fit mb-4" style={{ background: 'var(--bg-soft)', border: '1px solid var(--line)' }}>
        {[
          { id: 'all', l: 'Tất cả' },
          { id: 'active', l: 'Đang / Chưa làm' },
          { id: 'done', l: 'Đã xong' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
            style={{
              background: filter === f.id ? '#fff' : 'transparent',
              color: filter === f.id ? 'var(--ink)' : 'var(--muted)',
              boxShadow: filter === f.id ? '0 1px 2px rgba(18,53,36,.05)' : 'none',
            }}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Groups */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-sm text-ink-3">Không có task nào trong mục này</div>
        </div>
      ) : (
        <div>
          {groups.overdue.length > 0 && (
            <>
              <GroupHeader label="Trễ hạn — cần giải thích" sub="quá deadline" tone="danger" count={groups.overdue.length} />
              {groups.overdue.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.today.length > 0 && (
            <>
              <GroupHeader label="Hôm nay" sub={fmtDateLong(today + 'T12:00:00Z')} tone="warn" count={groups.today.length} />
              {groups.today.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.tomorrow.length > 0 && (
            <>
              <GroupHeader label="Ngày mai" sub={fmtDateLong(tomorrow + 'T12:00:00Z')} tone="accent" count={groups.tomorrow.length} />
              {groups.tomorrow.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.week.length > 0 && (
            <>
              <GroupHeader label="Tuần này" sub={fmtRange(addDaysVN(2), addDaysVN(6))} tone="accent" count={groups.week.length} />
              {groups.week.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.later.length > 0 && (
            <>
              <GroupHeader label="Sau" sub={`từ ${fmtDate(laterStart + 'T12:00:00Z')}`} tone="muted" count={groups.later.length} />
              {groups.later.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.noDl.length > 0 && (
            <>
              <GroupHeader label="Không có hạn" tone="muted" count={groups.noDl.length} />
              {groups.noDl.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
          {groups.done.length > 0 && (
            <>
              <GroupHeader label="Đã hoàn thành" tone="ok" count={groups.done.length} />
              {groups.done.map(t => <Row key={t.id} t={t} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
