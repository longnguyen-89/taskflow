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

    // Phân trang KPI theo chi nhánh.
    // - TGĐ: toàn bộ nhân viên (theo dept, trừ chính TGĐ).
    // - Admin: chỉ nhân viên thuộc chi nhánh mình phụ trách + chính mình.
    // - Member: chỉ bản thân.
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

      let grade, gc;
      if (score >= 85) { grade = 'A+'; gc = '#16a34a'; }
      else if (score >= 70) { grade = 'B+'; gc = '#2563eb'; }
      else if (score >= 50) { grade = 'C'; gc = '#d97706'; }
      else { grade = 'D'; gc = '#dc2626'; }

      // AI motivational feedback
      let feedback = '';
      if (cr >= 90 && otr >= 90) feedback = 'Xuất sắc! Tỷ lệ hoàn thành và đúng hạn rất cao. Hãy duy trì phong độ này!';
      else if (cr >= 70) feedback = 'Khá tốt. Cố gắng hoàn thành thêm các task còn lại và chú ý deadline.';
      else if (cr >= 50) feedback = 'Cần cải thiện tốc độ hoàn thành. Hãy ưu tiên task có deadline gần nhất trước.';
      else if (mt.length > 0) feedback = 'Cần trao đổi trực tiếp. Nhiều task chưa hoàn thành, có thể cần hỗ trợ hoặc điều chỉnh khối lượng công việc.';
      else feedback = 'Chưa có task nào trong kỳ đánh giá này.';

      if (overdue.length > 0) feedback += ` ⚠ ${overdue.length} task đang trễ hạn.`;

      return { member, total: mt.length, done: done.length, doing: doing.length, waiting: waiting.length, overdue: overdue.length, cr, otr, avg: avg.toFixed(1), score: Math.round(score), grade, gc, feedback };
    }).sort((a, b) => b.score - a.score);
  }, [tasks, members, period, department, userId, profile, isAdmin, isDirector, dateFrom, dateTo]);

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg" style={{ color: '#2D5A3D' }}>Đánh giá hiệu quả</h2>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        {['week', 'month', 'quarter', 'year'].map(p => (
          <button key={p} onClick={() => { setPeriod(p); setDateFrom(''); setDateTo(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p && !dateFrom ? 'text-white' : 'bg-white border border-gray-200 text-gray-500'}`}
            style={period === p && !dateFrom ? { background: '#2D5A3D' } : {}}>
            {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Năm'}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-2">hoặc</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" className="input-field !py-1.5 !text-xs !w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
      </div>

      <div className="space-y-4">
        {evaluations.map((ev, i) => (
          <div key={ev.member.id} className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              {isDirector && <span className="text-base font-bold text-gray-300 w-6">#{i + 1}</span>}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: ev.member.avatar_color, color: '#333' }}>{ini(ev.member.name)}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{ev.member.name}</p>
                <p className="text-[10px] text-gray-400">{ev.member.position} · {ev.member.department === 'hotel' ? 'Hotel' : 'Nail'}</p>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: ev.gc + '15', color: ev.gc }}>{ev.grade}</div>
            </div>

            {/* Detailed stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {[
                { v: ev.total, l: 'Tổng task' },
                { v: ev.done, l: 'Hoàn thành', c: '#16a34a' },
                { v: ev.doing, l: 'Đang làm', c: '#2563eb' },
                { v: ev.waiting, l: 'Chờ phản hồi', c: '#d97706' },
                { v: `${ev.cr}%`, l: 'Tỷ lệ xong', c: ev.cr >= 70 ? '#16a34a' : '#dc2626' },
                { v: `${ev.avg}d`, l: 'TB xong' },
              ].map(m => (
                <div key={m.l} className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold" style={{ color: m.c }}>{m.v}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{m.l}</p>
                </div>
              ))}
            </div>

            {/* Progress bars */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 w-16">Hoàn thành</span><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-green-500" style={{ width: `${ev.cr}%` }} /></div><span className="text-[10px] font-semibold w-9 text-right">{ev.cr}%</span></div>
              <div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 w-16">Đúng hạn</span><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${ev.otr}%`, background: ev.otr >= 80 ? '#2563eb' : '#d97706' }} /></div><span className="text-[10px] font-semibold w-9 text-right">{ev.otr}%</span></div>
            </div>

            {/* AI Feedback */}
            <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: ev.gc + '08', color: ev.gc, borderLeft: `3px solid ${ev.gc}` }}>
              <span className="font-semibold">Nhận xét: </span>{ev.feedback}
            </div>
          </div>
        ))}
        {evaluations.length === 0 && <div className="card p-10 text-center text-gray-400 text-sm">Chưa có dữ liệu</div>}
      </div>
    </div>
  );
}
