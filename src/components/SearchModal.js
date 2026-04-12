import { useState, useEffect, useRef } from 'react';

export default function SearchModal({ tasks, onClose, onSelect }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);

  const query = q.toLowerCase().trim();
  const results = query ? tasks.filter(t => t.title?.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)).slice(0, 12) : [];
  const ST = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Xong', waiting: 'Chờ' };
  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input ref={ref} className="flex-1 text-sm outline-none" placeholder="Tìm task, mô tả..." value={q} onChange={e => setQ(e.target.value)} />
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-400 border">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {query && results.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Không tìm thấy</p>}
          {results.map(t => (
            <div key={t.id} onClick={() => onSelect(t)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'done' ? 'bg-green-500' : t.status === 'doing' ? 'bg-blue-500' : t.status === 'waiting' ? 'bg-amber-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.title}</p><p className="text-[10px] text-gray-400">{ST[t.status]} · {fmtDate(t.deadline)}</p></div>
            </div>
          ))}
          {!query && <p className="p-4 text-xs text-gray-400 text-center">Gõ để tìm kiếm...</p>}
        </div>
      </div>
    </div>
  );
}
