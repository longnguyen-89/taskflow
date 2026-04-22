// MyTasks.js — "Công việc tôi": tất cả task liên quan đến user, nhóm theo ngày deadline.
// Click 1 task -> gọi onOpenTask để dashboard focus & expand task đó trong tab Dashboard.
import { useState, useMemo } from 'react';

const ST = {
  todo: { l: 'Chưa làm', c: '#6b7280' },
  doing: { l: 'Đang làm', c: '#2563eb' },
  done: { l: 'Xong', c: '#16a34a' },
  waiting: { l: 'Chờ', c: '#d97706' },
};
const PR = { high: { l: 'Cao', c: '#dc2626' }, medium: { l: 'TB', c: '#d97706' }, low: { l: 'Thấp', c: '#2563eb' } };

// YYYY-MM-DD theo giờ Việt Nam
function ymdVN(d) {
  if (!d) return null;
  const x = new Date(d);
  // Shift sang UTC+7 rồi lấy UTC date
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

export default function MyTasks({ tasks, members, userId, onOpenTask, profileName }) {
  const [filter, setFilter] = useState('all'); // all | active | done

  // Lọc task liên quan đến user: assignee / watcher / creator.
  // Bỏ task đang chờ duyệt để giống Dashboard.
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

  // Nhóm theo ngày deadline (YYYY-MM-DD VN)
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

    // Sort từng nhóm theo deadline tăng dần
    const byDl = (a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0);
    Object.keys(map).forEach(k => map[k].sort(byDl));

    // Trong nhóm week/later, chia nhỏ theo ngày để header hiển thị ngày rõ ràng
    function groupByDay(list) {
      const acc = {};
      for (const t of list) {
        const k = ymdVN(t.deadline) || 'noDl';
        if (!acc[k]) acc[k] = [];
        acc[k].push(t);
      }
      return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
    }
    return {
      overdue: map.overdue,
      today: map.today,
      tomorrow: map.tomorrow,
      weekByDay: groupByDay(map.week),
      laterByDay: groupByDay(map.later),
      noDl: map.noDl,
      done: map.done,
    };
  }, [filtered]);

  function relation(t) {
    const isAssignee = t.assignees?.some(a => a.user_id === userId);
    const isWatcher = t.watchers?.some(w => w.user_id === userId);
    const isCreator = t.created_by === userId;
    if (isAssignee) return { l: 'Được giao', c: '#123524', bg: '#e8f5ee' };
    if (isCreator) return { l: 'Tôi giao', c: '#7c3aed', bg: '#f3e8ff' };
    if (isWatcher) return { l: 'Theo dõi', c: '#2563eb', bg: '#dbeafe' };
    return { l: '', c: '', bg: '' };
  }

  function Row({ t }) {
    const st = ST[t.status] || ST.todo;
    const pr = PR[t.priority] || PR.medium;
    const rel = relation(t);
    const od = t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date();
    return (
      <button
        onClick={() => onOpenTask && onOpenTask(t.id)}
        className={`w-full text-left border rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all hover:shadow-sm hover:bg-gray-50/50 ${od ? 'border-l-[3px] border-l-red-500 border-red-200' : 'border-gray-100 bg-white'}`}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: st.c }} />
        <p className={`text-sm font-medium flex-1 truncate ${t.status === 'done' ? 'line-through text-gray-400' : ''}`}>{t.title}</p>
        {rel.l && <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style={{ background: rel.bg, color: rel.c }}>{rel.l}</span>}
        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style={{ background: st.c + '15', color: st.c }}>{st.l}</span>
        <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style={{ background: pr.c + '15', color: pr.c }}>{pr.l}</span>
        {t.deadline && <span className={`text-[10px] flex-shrink-0 ${od ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{fmtDate(t.deadline)}{od && ' !'}</span>}
        <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    );
  }

  function Section({ title, count, color, list }) {
    if (!list || list.length === 0) return null;
    return (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color }}>{title} <span className="text-gray-400 font-semibold">({count ?? list.length})</span></p>
        <div className="space-y-1.5">{list.map(t => <Row key={t.id} t={t} />)}</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: '#123524' }}>Công việc tôi</h2>
        <p className="text-[11px] text-gray-500">Tất cả task liên quan đến {profileName || 'bạn'} — nhóm theo hạn hoàn thành.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { l: 'Tổng', v: stats.total, c: '#1a1a1a' },
          { l: 'Đang làm', v: stats.doing, c: '#2563eb' },
          { l: 'Chưa làm', v: stats.todo, c: '#6b7280' },
          { l: 'Xong', v: stats.done, c: '#16a34a' },
          { l: 'Trễ hạn', v: stats.overdue, c: '#dc2626' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-2.5 sm:p-3 border border-gray-100">
            <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wide">{s.l}</p>
            <p className="text-base sm:text-xl font-bold mt-0.5" style={{ color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex p-0.5 rounded-lg w-fit" style={{ background: '#F3EFE4' }}>
        {[
          { id: 'all', l: 'Tất cả' },
          { id: 'active', l: 'Đang / Chưa làm' },
          { id: 'done', l: 'Đã xong' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === f.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">🎉 Không có task nào trong mục này</div>
      ) : (
        <div className="space-y-4">
          <Section title="⚠ Trễ hạn" color="#dc2626" list={groups.overdue} />
          <Section title="🔥 Hôm nay" color="#d97706" list={groups.today} />
          <Section title="⏭ Ngày mai" color="#2563eb" list={groups.tomorrow} />
          {groups.weekByDay.map(([day, list]) => (
            <Section key={'w' + day} title={`📅 ${fmtDateLong(day + 'T12:00:00Z')}`} color="#123524" list={list} />
          ))}
          {groups.laterByDay.map(([day, list]) => (
            <Section key={'l' + day} title={`📆 ${fmtDateLong(day + 'T12:00:00Z')}`} color="#6b7280" list={list} />
          ))}
          <Section title="❓ Không có hạn" color="#6b7280" list={groups.noDl} />
          <Section title="✅ Đã hoàn thành" color="#16a34a" list={groups.done} />
        </div>
      )}
    </div>
  );
}
