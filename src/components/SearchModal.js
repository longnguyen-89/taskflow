import { useState, useEffect, useRef } from 'react';

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu ("truc" khớp "Trúc", "lien" khớp "Liên").
const normalize = (s) => (s || '')
  .toString()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase()
  .trim();

const getInitials = (n) => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function SearchModal({ tasks, members, currentUserId, onClose, onSelect }) {
  const [q, setQ] = useState('');
  const [personFilter, setPersonFilter] = useState(null); // user_id đang lọc — xem mọi việc của 1 nhân viên
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const nq = normalize(q);
  const ST = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Hoàn thành', waiting: 'Chờ phản hồi' };
  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '';

  // ── Gom nhân viên (người được giao việc) từ pool task, kèm danh sách việc của họ ──
  const peopleMap = new Map();
  for (const t of (tasks || [])) {
    for (const a of (t.assignees || [])) {
      const u = a.user || {};
      const id = a.user_id || u.id;
      if (!id) continue;
      if (!peopleMap.has(id)) {
        peopleMap.set(id, { id, name: u.name, avatar_color: u.avatar_color, position: u.position, tasks: [] });
      }
      peopleMap.get(id).tasks.push(t);
    }
  }
  const selectedPerson = personFilter ? peopleMap.get(personFilter) : null;

  // Người khớp tên (chỉ hiện khi đang gõ và chưa chốt 1 người)
  const matchedPeople = (nq && !personFilter)
    ? [...peopleMap.values()]
        .filter(p => normalize(p.name).includes(nq))
        .map(p => ({
          ...p,
          open: p.tasks.filter(t => t.status !== 'done').length,
          total: p.tasks.length,
        }))
        .sort((a, b) => b.open - a.open || b.total - a.total)
        .slice(0, 6)
    : [];

  // ── Task kết quả ──
  const rank = t => (t.status === 'done' ? 1 : 0); // việc chưa xong lên trước (để tránh giao trùng)
  const farFuture = 32503680000000; // ~ năm 3000
  const byUrgency = (a, b) =>
    rank(a) - rank(b) ||
    (new Date(a.deadline).getTime() || farFuture) - (new Date(b.deadline).getTime() || farFuture);

  let base = [];
  if (personFilter) {
    base = (tasks || []).filter(t => (t.assignees || []).some(a => (a.user_id || a.user?.id) === personFilter));
  } else if (nq) {
    base = (tasks || []).filter(t =>
      normalize(t.title).includes(nq) ||
      normalize(t.description).includes(nq) ||
      (t.assignees || []).some(a => normalize(a.user?.name).includes(nq)) ||
      normalize(t.creator?.name).includes(nq)
    );
  }
  const taskResults = [...base].sort(byUrgency).slice(0, 25);

  // Hàng điều hướng bàn phím: người trước, task sau
  const rows = [
    ...matchedPeople.map(p => ({ type: 'person', key: 'p_' + p.id, p })),
    ...taskResults.map(t => ({ type: 'task', key: 't_' + t.id, t })),
  ];

  useEffect(() => { setSelectedIdx(0); }, [q, personFilter]);

  const choosePerson = (id) => { setPersonFilter(id); setSelectedIdx(0); };

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (personFilter) { setPersonFilter(null); return; }
        onClose(); return;
      }
      if (rows.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, rows.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const row = rows[selectedIdx];
        if (row?.type === 'person') choosePerson(row.p.id);
        else if (row?.type === 'task') onSelect(row.t);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, rows, selectedIdx, onSelect, personFilter]);

  const statusColor = (s) => {
    if (s === 'done') return 'var(--accent)';
    if (s === 'doing') return 'var(--accent)';
    if (s === 'waiting') return 'var(--warn)';
    return 'var(--muted)';
  };

  const dueColor = (t) => {
    if (t.status === 'done') return 'var(--accent)';
    if (!t.deadline) return 'var(--muted)';
    const d = new Date(t.deadline);
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return 'var(--danger)';
    if (diff < 1) return 'var(--warn)';
    return 'var(--ink-3)';
  };

  const PersonRow = ({ p, isActive }) => (
    <div
      onClick={() => choosePerson(p.id)}
      onMouseEnter={() => setSelectedIdx(rows.findIndex(r => r.key === 'p_' + p.id))}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
      style={{
        background: isActive ? 'var(--bg-soft)' : 'transparent',
        borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
        paddingLeft: isActive ? 14 : 16,
      }}
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
        style={{ background: p.avatar_color || '#E8F1EC', color: '#333' }}>
        {getInitials(p.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-ink" style={{ letterSpacing: '-.005em' }}>
          {p.name}{p.id === currentUserId && <span className="text-muted-ink font-normal"> (bạn)</span>}
        </p>
        <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
          {p.position || 'Nhân viên'} · <b style={{ color: p.open > 0 ? 'var(--ink-2)' : 'var(--muted)' }}>{p.open} việc đang mở</b> / {p.total} tổng
        </p>
      </div>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg-soft)', color: 'var(--muted)', border: '1px solid var(--line)' }}>
        Xem việc →
      </span>
    </div>
  );

  const TaskRow = ({ t, isActive }) => {
    const assignees = (t.assignees || []).map(a => a.user).filter(Boolean);
    return (
      <div
        onClick={() => onSelect(t)}
        onMouseEnter={() => setSelectedIdx(rows.findIndex(r => r.key === 't_' + t.id))}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
        style={{
          background: isActive ? 'var(--bg-soft)' : 'transparent',
          borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
          paddingLeft: isActive ? 14 : 16,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor(t.status) }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-ink" style={{ letterSpacing: '-.005em' }}>{t.title}</p>
          <p className="text-[11px] font-mono truncate" style={{ color: 'var(--muted)' }}>
            #{String(t.id).slice(0, 6)} · {ST[t.status] || t.status}
            {t.deadline && <> · <span style={{ color: dueColor(t) }}>{fmtDate(t.deadline)}</span></>}
            {assignees.length > 0 && <> · {assignees.map(u => u.name).join(', ')}</>}
          </p>
        </div>
        {assignees.length > 0 && (
          <div className="flex -space-x-1.5 flex-shrink-0">
            {assignees.slice(0, 3).map((u, k) => (
              <div key={u.id || k} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold"
                style={{ background: u.avatar_color || '#E8F1EC', color: '#333', border: '2px solid #fff' }} title={u.name}>
                {getInitials(u.name)}
              </div>
            ))}
            {assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold"
                style={{ background: 'var(--bg-soft)', color: 'var(--muted)', border: '2px solid #fff' }}>
                +{assignees.length - 3}
              </div>
            )}
          </div>
        )}
        {isActive && (
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 animate-fade-in" style={{ background: 'rgba(18,53,36,.35)' }} onClick={onClose}>
      <div
        className="w-full max-w-[560px] bg-white rounded-xl2 overflow-hidden animate-slide-up"
        style={{ boxShadow: '0 20px 40px -10px rgba(18,53,36,.3), 0 1px 2px rgba(18,53,36,.06)', border: '1px solid var(--line)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={ref}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400 text-ink"
            placeholder="Tìm task, hoặc tên nhân viên…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bone-soft text-muted-ink" style={{ border: '1px solid var(--line)' }}>ESC</kbd>
        </div>

        {/* Chip: đang xem việc của 1 nhân viên */}
        {selectedPerson && (
          <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
            <span className="text-[11px] text-muted-ink">Việc đã giao cho</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink px-2 py-1 rounded-full" style={{ background: '#fff', border: '1px solid var(--line)' }}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: selectedPerson.avatar_color || '#E8F1EC', color: '#333' }}>
                {getInitials(selectedPerson.name)}
              </span>
              {selectedPerson.name}
              <button onClick={() => setPersonFilter(null)} className="ml-0.5 text-muted-ink hover:text-danger" title="Bỏ lọc">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!nq && !personFilter && (
            <div className="px-4 py-6 text-center">
              <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Gợi ý</div>
              <div className="text-sm text-ink-3 mb-3">Gõ <b className="text-ink">tên nhân viên</b> để xem các việc đã giao cho người đó,<br />hoặc gõ tiêu đề / nội dung task.</div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-ink">
                <kbd className="font-mono px-1.5 py-0.5 rounded bg-bone-soft" style={{ border: '1px solid var(--line)' }}>↑</kbd>
                <kbd className="font-mono px-1.5 py-0.5 rounded bg-bone-soft" style={{ border: '1px solid var(--line)' }}>↓</kbd>
                <span>di chuyển</span>
                <span className="mx-1">·</span>
                <kbd className="font-mono px-1.5 py-0.5 rounded bg-bone-soft" style={{ border: '1px solid var(--line)' }}>↵</kbd>
                <span>chọn</span>
              </div>
            </div>
          )}

          {(nq || personFilter) && rows.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-ink-3">
                {personFilter ? 'Nhân viên này chưa có việc nào được giao' : 'Không tìm thấy kết quả cho'}
              </div>
              {!personFilter && <div className="font-mono text-xs mt-1 text-ink" style={{ letterSpacing: '-.005em' }}>&quot;{q}&quot;</div>}
            </div>
          )}

          {/* Người */}
          {matchedPeople.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Nhân viên · {matchedPeople.length}
              </div>
              {matchedPeople.map(p => (
                <PersonRow key={p.id} p={p} isActive={rows[selectedIdx]?.key === 'p_' + p.id} />
              ))}
            </div>
          )}

          {/* Task */}
          {taskResults.length > 0 && (
            <div className="py-1" style={{ borderTop: matchedPeople.length > 0 ? '1px solid var(--line)' : 'none' }}>
              <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                {personFilter ? `Việc đã giao · ${taskResults.length}` : `Task · ${taskResults.length} kết quả`}
              </div>
              {taskResults.map(t => (
                <TaskRow key={t.id} t={t} isActive={rows[selectedIdx]?.key === 't_' + t.id} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-4 py-2 flex items-center justify-between text-[10px] font-mono" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-soft)', color: 'var(--muted)' }}>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-white" style={{ border: '1px solid var(--line)' }}>↵</kbd>
              <span>{rows[selectedIdx]?.type === 'person' ? 'xem việc của nhân viên' : 'mở task'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⌘K để mở lại</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
