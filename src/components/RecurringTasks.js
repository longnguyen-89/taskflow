import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/Toaster';

const FREQ = {
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
  quarterly: 'Mỗi 3 tháng (định kỳ quý)',
  semiannual: 'Mỗi 6 tháng (nửa năm)',
  yearly: 'Hằng năm (1 năm 1 lần)',
};
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const PR = { high: 'Cao', medium: 'TB', low: 'Thấp' };
// Các tần suất cần ngày trong tháng + tháng tham chiếu
const NEEDS_MONTHDAY = new Set(['monthly', 'quarterly', 'semiannual', 'yearly']);
const NEEDS_MONTH_OF_YEAR = new Set(['quarterly', 'semiannual', 'yearly']);

function getFileIcon(name) {
  const ext = (name || '').toLowerCase();
  if (ext.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) return '🖼';
  if (ext.match(/\.pdf$/)) return '📄';
  if (ext.match(/\.(doc|docx)$/)) return '📝';
  if (ext.match(/\.(xls|xlsx|csv)$/)) return '📊';
  if (ext.match(/\.(ppt|pptx)$/)) return '📽';
  return '📎';
}
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function RecurringTasks({ members, department, userId, taskGroups }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('medium');
  const [groupId, setGroupId] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [weekday, setWeekday] = useState(1);
  const [monthday, setMonthday] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [hour, setHour] = useState(18);
  const [minute, setMinute] = useState(0);
  const [daysOffset, setDaysOffset] = useState(0);
  const [assignees, setAssignees] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [chkLines, setChkLines] = useState('');
  // File mới chọn (chưa upload) + file đã có sẵn của template
  const [newFiles, setNewFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]); // [{file_name, file_url, file_type, file_size}]
  const [uploading, setUploading] = useState(false);

  const deptMembers = members.filter(m => m.department === department || m.role === 'director' || m.role === 'accountant');

  const fetchList = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('recurring_tasks').select('*').eq('department', department).order('created_at', { ascending: false });
    setList(data || []);
    setLoading(false);
  }, [department]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function resetForm() {
    setTitle(''); setDesc(''); setPriority('medium'); setGroupId('');
    setFrequency('daily'); setWeekday(1); setMonthday(1); setMonthOfYear(1);
    setHour(18); setMinute(0); setDaysOffset(0);
    setAssignees([]); setWatchers([]); setChkLines('');
    setNewFiles([]); setExistingFiles([]);
    setEditing(null);
  }

  function handleAddFile(e) {
    const list = Array.from(e.target.files || []);
    if (list.length > 0) setNewFiles(p => [...p, ...list]);
    e.target.value = '';
  }
  function removeNewFile(i) { setNewFiles(p => p.filter((_, idx) => idx !== i)); }
  function removeExistingFile(i) { setExistingFiles(p => p.filter((_, idx) => idx !== i)); }

  function openEdit(r) {
    setEditing(r);
    setTitle(r.title); setDesc(r.description || ''); setPriority(r.priority); setGroupId(r.group_id || '');
    setFrequency(r.frequency); setWeekday(r.weekday ?? 1); setMonthday(r.monthday ?? 1); setMonthOfYear(r.month_of_year ?? 1);
    setHour(r.deadline_hour); setMinute(r.deadline_minute); setDaysOffset(r.deadline_days_offset || 0);
    setAssignees(r.assignee_ids || []);
    setWatchers(r.watcher_ids || []);
    setChkLines((r.default_checklist || []).join('\n'));
    setExistingFiles(Array.isArray(r.default_files) ? r.default_files : []);
    setNewFiles([]);
    setShowForm(true);
  }

  async function save() {
    if (!title.trim()) return toast('Nhập tiêu đề', 'error');
    if (assignees.length === 0) return toast('Chọn ít nhất 1 người', 'error');
    const checklist = chkLines.split('\n').map(s => s.trim()).filter(Boolean);

    // Upload các file mới chọn lên storage, gộp với file đã có
    setUploading(true);
    const uploaded = [];
    for (const f of newFiles) {
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
      const path = `recurring/${userId}/${Date.now()}_${safeName}`;
      const { error: ue } = await supabase.storage.from('attachments').upload(path, f);
      if (ue) { setUploading(false); return toast('Lỗi upload file: ' + ue.message, 'error'); }
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path);
      uploaded.push({ file_name: f.name, file_url: publicUrl, file_type: f.type, file_size: f.size });
    }
    setUploading(false);
    const allFiles = [...existingFiles, ...uploaded];

    const payload = {
      title: title.trim(), description: desc.trim() || null, priority,
      department, group_id: groupId || null,
      frequency,
      weekday: frequency === 'weekly' ? weekday : null,
      monthday: NEEDS_MONTHDAY.has(frequency) ? monthday : null,
      month_of_year: NEEDS_MONTH_OF_YEAR.has(frequency) ? monthOfYear : null,
      deadline_hour: parseInt(hour), deadline_minute: parseInt(minute),
      deadline_days_offset: parseInt(daysOffset) || 0,
      assignee_ids: assignees,
      watcher_ids: watchers,
      default_checklist: checklist,
      default_files: allFiles,
      active: true,
    };
    if (editing) {
      const { error } = await supabase.from('recurring_tasks').update(payload).eq('id', editing.id);
      if (error) return toast('Lỗi: ' + error.message, 'error');
      toast('Đã cập nhật', 'success');
    } else {
      payload.created_by = userId;
      const { error } = await supabase.from('recurring_tasks').insert(payload);
      if (error) return toast('Lỗi: ' + error.message, 'error');
      toast('Đã tạo task lặp lại', 'success');
    }
    setShowForm(false); resetForm(); fetchList();
  }

  async function toggleActive(r) {
    await supabase.from('recurring_tasks').update({ active: !r.active }).eq('id', r.id);
    fetchList();
  }

  async function remove(r) {
    if (!confirm(`Xóa template "${r.title}"? Các task đã sinh trước đó vẫn giữ nguyên.`)) return;
    await supabase.from('recurring_tasks').delete().eq('id', r.id);
    toast('Đã xóa template', 'success');
    fetchList();
  }

  function describeSchedule(r) {
    const t = `${String(r.deadline_hour).padStart(2, '0')}:${String(r.deadline_minute).padStart(2, '0')}`;
    const off = r.deadline_days_offset || 0;
    const dtText = off === 0 ? `deadline ${t} cùng ngày` : `deadline ${t} sau ${off} ngày`;
    if (r.frequency === 'daily') return `Mỗi ngày, ${dtText}`;
    if (r.frequency === 'weekly') return `Mỗi ${WEEKDAYS[r.weekday]} hàng tuần, ${dtText}`;
    if (r.frequency === 'monthly') return `Ngày ${r.monthday} hàng tháng, ${dtText}`;
    if (r.frequency === 'quarterly') {
      const m = r.month_of_year || 1;
      const months = [m, ((m - 1 + 3) % 12) + 1, ((m - 1 + 6) % 12) + 1, ((m - 1 + 9) % 12) + 1].sort((a, b) => a - b);
      return `Ngày ${r.monthday}, mỗi 3 tháng (T${months.join(', T')}), ${dtText}`;
    }
    if (r.frequency === 'semiannual') {
      const m = r.month_of_year || 1;
      const m2 = ((m - 1 + 6) % 12) + 1;
      const months = [m, m2].sort((a, b) => a - b);
      return `Ngày ${r.monthday}, mỗi 6 tháng (T${months.join(' & T')}), ${dtText}`;
    }
    if (r.frequency === 'yearly') return `Ngày ${r.monthday} ${MONTHS[(r.month_of_year || 1) - 1]} hằng năm, ${dtText}`;
    return '';
  }

  const ini = n => n?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Task lặp lại định kỳ</h2>
          <p className="text-[11px] text-gray-500">Hệ thống sẽ tự sinh task vào sáng theo lịch — nhân viên không cần đợi anh giao thủ công.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#123524' }}>+ Tạo template</button>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold">{editing ? 'Sửa template' : 'Template mới'}</h3>
          <input className="input-field !text-xs" placeholder="Tiêu đề task * (vd: Mở cửa chi nhánh Bến Cát)" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="input-field !text-xs" rows={2} placeholder="Mô tả (tùy chọn)" value={desc} onChange={e => setDesc(e.target.value)} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Tần suất</label>
              <select className="input-field !text-xs" value={frequency} onChange={e => setFrequency(e.target.value)}>
                {Object.entries(FREQ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Độ ưu tiên</label>
              <select className="input-field !text-xs" value={priority} onChange={e => setPriority(e.target.value)}>
                {Object.entries(PR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Vào thứ</label>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAYS.map((d, i) => (
                  <button key={i} onClick={() => setWeekday(i)} className={`px-2.5 py-1 rounded text-[11px] font-semibold ${weekday === i ? 'text-white' : 'text-gray-600 bg-gray-100'}`} style={weekday === i ? { background: '#123524' } : {}}>{d}</button>
                ))}
              </div>
            </div>
          )}

          {NEEDS_MONTHDAY.has(frequency) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Ngày trong tháng (1-31)</label>
                <input type="number" min={1} max={31} className="input-field !text-xs" value={monthday} onChange={e => setMonthday(parseInt(e.target.value) || 1)} />
              </div>
              {NEEDS_MONTH_OF_YEAR.has(frequency) && (
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">
                    {frequency === 'yearly' ? 'Tháng trong năm' : 'Tháng tham chiếu (mốc bắt đầu)'}
                  </label>
                  <select className="input-field !text-xs" value={monthOfYear} onChange={e => setMonthOfYear(parseInt(e.target.value) || 1)}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {frequency === 'quarterly' && (
            <p className="text-[10px] text-gray-500 -mt-1">
              → Sẽ sinh ngày {monthday} của: T{monthOfYear}, T{((monthOfYear - 1 + 3) % 12) + 1}, T{((monthOfYear - 1 + 6) % 12) + 1}, T{((monthOfYear - 1 + 9) % 12) + 1}.
            </p>
          )}
          {frequency === 'semiannual' && (
            <p className="text-[10px] text-gray-500 -mt-1">
              → Sẽ sinh ngày {monthday} của: T{monthOfYear} và T{((monthOfYear - 1 + 6) % 12) + 1}.
            </p>
          )}
          {frequency === 'yearly' && (
            <p className="text-[10px] text-gray-500 -mt-1">
              → Sẽ sinh đúng ngày {monthday}/{monthOfYear} mỗi năm.
            </p>
          )}

          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
            <label className="block text-[10px] font-semibold text-gray-600 mb-1.5">Deadline của task</label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-500">Sau khi sinh</span>
              <input type="number" min={0} max={60} className="input-field !text-xs w-16" value={daysOffset} onChange={e => setDaysOffset(parseInt(e.target.value) || 0)} />
              <span className="text-[11px] text-gray-500">ngày, lúc</span>
              <input type="number" min={0} max={23} className="input-field !text-xs w-16" value={hour} onChange={e => setHour(parseInt(e.target.value) || 0)} />
              <span>:</span>
              <input type="number" min={0} max={59} className="input-field !text-xs w-16" value={minute} onChange={e => setMinute(parseInt(e.target.value) || 0)} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {daysOffset === 0
                ? '→ Deadline ngay trong ngày task được sinh'
                : `→ Deadline ${daysOffset} ngày sau khi sinh (nhân viên có ${daysOffset + 1} ngày để hoàn thành)`}
            </p>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Giao cho * ({assignees.length} người)</label>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {deptMembers.map(m => {
                const checked = assignees.includes(m.id);
                return (
                  <label key={m.id} className={`flex items-center gap-2 p-2 cursor-pointer text-xs border-b border-gray-100 last:border-b-0 ${checked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setAssignees(p => checked ? p.filter(x => x !== m.id) : [...p, m.id])} className="accent-emerald-600" />
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: m.avatar_color || '#f3f4f6' }}>{ini(m.name)}</div>
                    <span className="flex-1">{m.name}</span>
                    <span className="text-[9px] text-gray-400">{m.position}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Người theo dõi ({watchers.length} người, tùy chọn)</label>
            <p className="text-[10px] text-gray-400 mb-1.5">Chỉ nhận thông báo khi task được sinh, không bị tính là người làm.</p>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {deptMembers.map(m => {
                const checked = watchers.includes(m.id);
                const isAssignee = assignees.includes(m.id);
                return (
                  <label key={m.id} className={`flex items-center gap-2 p-2 text-xs border-b border-gray-100 last:border-b-0 ${isAssignee ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${checked && !isAssignee ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" disabled={isAssignee} checked={checked} onChange={() => setWatchers(p => checked ? p.filter(x => x !== m.id) : [...p, m.id])} className="accent-blue-600" />
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ background: m.avatar_color || '#f3f4f6' }}>{ini(m.name)}</div>
                    <span className="flex-1">{m.name}</span>
                    <span className="text-[9px] text-gray-400">{isAssignee ? 'Đã là người làm' : (m.role === 'director' ? 'Tổng GĐ' : m.role === 'accountant' ? 'Kế toán' : m.position)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Checklist mặc định (mỗi dòng 1 bước, tùy chọn)</label>
            <textarea className="input-field !text-xs font-mono" rows={5} placeholder="Bật đèn + máy lạnh&#10;Lau quầy lễ tân&#10;Kiểm máy POS&#10;Đếm tiền quỹ đầu ngày" value={chkLines} onChange={e => setChkLines(e.target.value)} />
            <p className="text-[10px] text-gray-400 mt-1">Mỗi lần task được sinh, các bước này sẽ tự động xuất hiện trong checklist.</p>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Đính kèm mặc định (file/hình — tùy chọn)</label>
            <div className="space-y-1.5">
              {existingFiles.map((f, i) => (
                <div key={'e' + i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                  <span className="text-sm flex-shrink-0">{getFileIcon(f.file_name)}</span>
                  <a href={f.file_url} target="_blank" rel="noreferrer" className="text-xs text-gray-700 truncate flex-1 hover:text-emerald-700 hover:underline">{f.file_name}</a>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.file_size)}</span>
                  <button type="button" onClick={() => removeExistingFile(i)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Bỏ file này khỏi template">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div key={'n' + i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50">
                  <span className="text-sm flex-shrink-0">{getFileIcon(f.name)}</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{f.name}</span>
                  <span className="text-[9px] text-emerald-700 flex-shrink-0 font-semibold">MỚI</span>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                  <button type="button" onClick={() => removeNewFile(i)} className="text-red-400 hover:text-red-600 flex-shrink-0" title="Xóa file">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                <span className="text-xs text-gray-500">Chọn file (có thể chọn nhiều)</span>
                <input type="file" multiple className="hidden" onChange={handleAddFile} />
              </label>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Mỗi lần task được sinh, các file này sẽ tự đính kèm vào task. Phù hợp cho mẫu form, hình hướng dẫn, checklist PDF.</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Hủy</button>
            <button onClick={save} disabled={uploading} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#123524' }}>{uploading ? 'Đang upload...' : (editing ? 'Cập nhật' : 'Tạo')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-6 text-center text-sm text-gray-400">Đang tải...</div>
      ) : list.length === 0 ? (
        <div className="card p-6 text-center text-sm text-gray-400">Chưa có template nào. Bấm "+ Tạo template" để bắt đầu.</div>
      ) : (
        <div className="space-y-2">
          {list.map(r => (
            <div key={r.id} className={`card p-3 ${!r.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold">{r.title}</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold text-white" style={{ background: '#123524' }}>{FREQ[r.frequency]}</span>
                    {!r.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold">TẠM DỪNG</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{describeSchedule(r)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{(r.assignee_ids || []).length} người làm · {(r.watcher_ids || []).length} theo dõi · {(r.default_checklist || []).length} bước · {(Array.isArray(r.default_files) ? r.default_files.length : 0)} file · sinh lần cuối: {r.last_generated_date || 'chưa'}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => openEdit(r)} className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100">Sửa</button>
                  <button onClick={() => toggleActive(r)} className="text-[10px] px-2 py-1 rounded bg-yellow-50 text-yellow-700 font-semibold hover:bg-yellow-100">{r.active ? 'Tạm dừng' : 'Bật lại'}</button>
                  <button onClick={() => remove(r)} className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 font-semibold hover:bg-red-100">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
