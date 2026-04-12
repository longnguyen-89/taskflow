import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

const IC = { new_task: '📋', task_approved: '✅', task_rejected: '❌', reminder: '⏰', info: '💬', approval_request: '📝' };

export default function Notifications({ notifications, userId, onRefresh }) {
  async function markAll() { await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false); toast('Đã đọc', 'success'); onRefresh(); }
  async function markOne(id) { await supabase.from('notifications').update({ read: true }).eq('id', id); onRefresh(); }
  const fmtDT = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('vi-VN') + ' ' + dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  const unread = notifications.filter(n => !n.read);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg" style={{ color: '#2D5A3D' }}>Thông báo {unread.length > 0 && <span className="text-xs text-red-500">({unread.length} mới)</span>}</h2>
        {unread.length > 0 && <button onClick={markAll} className="text-xs font-medium hover:underline" style={{ color: '#2D5A3D' }}>Đánh dấu đã đọc</button>}
      </div>
      {notifications.length === 0 ? <div className="card p-10 text-center text-gray-400 text-sm">🔔 Chưa có thông báo</div> : (
        <div className="space-y-1.5">
          {notifications.map(n => (
            <div key={n.id} onClick={() => !n.read && markOne(n.id)}
              className={`card p-3.5 flex gap-2.5 cursor-pointer transition-all hover:shadow-sm ${!n.read ? 'border-emerald-200 bg-emerald-50/30' : 'opacity-50'}`}>
              {!n.read && <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: '#2D5A3D' }} />}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-gray-100">{IC[n.type] || '💬'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{n.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{fmtDT(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
