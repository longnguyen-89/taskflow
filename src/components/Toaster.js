import { useState, useEffect } from 'react';
let toastFn = () => {};
export function toast(msg, type = 'success') { toastFn(msg, type); }
export function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { toastFn = (msg, type) => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500); }; }, []);
  const c = { success: 'bg-emerald-700 text-white', error: 'bg-red-600 text-white', info: 'bg-blue-600 text-white' };
  return (<div className="fixed top-4 right-4 z-50 flex flex-col gap-2">{toasts.map(t => (<div key={t.id} className={`${c[t.type]} px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-up`}>{t.msg}</div>))}</div>);
}
