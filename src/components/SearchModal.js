import { useState, useEffect, useRef } from 'react';

export default function SearchModal({ tasks, onClose, onSelect }) {
  const [q, setQ] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const query = q.toLowerCase().trim();
  const results = query
    ? tasks.filter(t => t.title?.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)).slice(0, 12)
    : [];
  const ST = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Hoàn thành', waiting: 'Chờ phản hồi' };
  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '';

  useEffect(() => { setSelectedIdx(0); }, [q]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); const t = results[selectedIdx]; if (t) onSelect(t); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, results, selectedIdx, onSelect]);

  // Status dot color helper
  const statusColor = (s) => {
    if (s === 'done') return 'var(--accent)';
    if (s === 'doing') return 'var(--accent)';
    if (s === 'waiting') return 'var(--warn)';
    return 'var(--muted)';
  };

  // Due state color
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
            placeholder="Tìm task, đề xuất, người…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bone-soft text-muted-ink" style={{ border: '1px solid var(--line)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <div className="px-4 py-6 text-center">
              <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Gợi ý</div>
              <div className="text-sm text-ink-3 mb-3">Gõ để tìm theo tiêu đề hoặc mô tả task</div>
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

          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-ink-3">Không tìm thấy kết quả cho</div>
              <div className="font-mono text-xs mt-1 text-ink" style={{ letterSpacing: '-.005em' }}>&quot;{q}&quot;</div>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Task · {results.length} kết quả
              </div>
              {results.map((t, i) => {
                const isActive = i === selectedIdx;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelect(t)}
                    onMouseEnter={() => setSelectedIdx(i)}
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
                      </p>
                    </div>
                    {isActive && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 flex items-center justify-between text-[10px] font-mono" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-soft)', color: 'var(--muted)' }}>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-white" style={{ border: '1px solid var(--line)' }}>↵</kbd>
              <span>mở task</span>
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
