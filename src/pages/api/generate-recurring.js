// Cron endpoint: generate today's tasks from active recurring_tasks templates.
// Runs once daily early morning (Vercel cron). Idempotent: skips templates already
// generated for today (tracked via recurring_tasks.last_generated_date).

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vietnam timezone helpers (UTC+7)
function vnNow() {
  const now = new Date();
  // shift to UTC+7
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  // Allow Vercel cron OR manual call with secret
  const auth = req.headers['x-api-key'] || req.query.key;
  const isCron = req.headers['user-agent']?.includes('vercel-cron');
  if (!isCron && auth !== process.env.NEXT_PUBLIC_CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const vn = vnNow();
  const today = ymd(vn);
  const weekday = vn.getUTCDay();   // 0=CN..6=T7 (sau khi shift +7h, dùng UTC* methods)
  const monthday = vn.getUTCDate();

  const { data: templates, error } = await supabase
    .from('recurring_tasks')
    .select('*')
    .eq('active', true);
  if (error) return res.status(500).json({ error: error.message });

  const generated = [];
  const skipped = [];

  for (const r of templates || []) {
    // Skip if already generated today
    if (r.last_generated_date === today) { skipped.push({ id: r.id, reason: 'already_today' }); continue; }

    // Check if today matches the schedule
    let matches = false;
    if (r.frequency === 'daily') matches = true;
    else if (r.frequency === 'weekly') matches = r.weekday === weekday;
    else if (r.frequency === 'monthly') matches = r.monthday === monthday;
    if (!matches) { skipped.push({ id: r.id, reason: 'no_match_today' }); continue; }

    // Build deadline = (today + days_offset) at HH:MM Vietnam time → ISO UTC
    // VN = UTC+7, so VN HH:MM corresponds to UTC (HH-7):MM on a VN-date basis.
    const offset = r.deadline_days_offset || 0;
    // Compute the VN date N days after `today`
    const vnDeadlineDate = new Date(`${today}T00:00:00.000Z`);
    vnDeadlineDate.setUTCDate(vnDeadlineDate.getUTCDate() + offset);
    const deadlineVnYmd = vnDeadlineDate.toISOString().slice(0, 10);
    const utcHour = (r.deadline_hour - 7 + 24) % 24;
    // If r.deadline_hour < 7 (e.g. 2am VN), it maps to previous UTC day — shift date back 1
    const needsDayBack = r.deadline_hour < 7;
    const deadlineDateForISO = new Date(`${deadlineVnYmd}T00:00:00.000Z`);
    if (needsDayBack) deadlineDateForISO.setUTCDate(deadlineDateForISO.getUTCDate() - 1);
    const ymdForISO = deadlineDateForISO.toISOString().slice(0, 10);
    const deadlineISO = new Date(`${ymdForISO}T${String(utcHour).padStart(2, '0')}:${String(r.deadline_minute).padStart(2, '0')}:00.000Z`).toISOString();

    // Insert task
    const { data: task, error: te } = await supabase.from('tasks').insert({
      title: r.title,
      description: r.description,
      priority: r.priority,
      department: r.department,
      group_id: r.group_id,
      deadline: deadlineISO,
      created_by: r.created_by,
      status: 'todo',
      approval_status: 'approved',  // task lặp lại bỏ qua duyệt
      recurring_id: r.id,
    }).select().single();
    if (te) { skipped.push({ id: r.id, reason: 'insert_failed', error: te.message }); continue; }

    // Insert assignees
    if (r.assignee_ids && r.assignee_ids.length > 0) {
      const rows = r.assignee_ids.map(uid => ({ task_id: task.id, user_id: uid }));
      await supabase.from('task_assignees').insert(rows);

      // Notify each assignee
      for (const uid of r.assignee_ids) {
        await supabase.from('notifications').insert({
          user_id: uid, type: 'new_task',
          title: 'Task định kỳ hôm nay', message: `"${r.title}" — deadline ${String(r.deadline_hour).padStart(2,'0')}:${String(r.deadline_minute).padStart(2,'0')}`,
          task_id: task.id,
        });
      }
    }

    // Insert default checklist
    if (r.default_checklist && r.default_checklist.length > 0) {
      const chkRows = r.default_checklist.map((text, i) => ({
        task_id: task.id, text, position: i, done: false,
      }));
      await supabase.from('task_checklist').insert(chkRows);
    }

    // Mark generated
    await supabase.from('recurring_tasks').update({ last_generated_date: today }).eq('id', r.id);
    generated.push({ id: r.id, task_id: task.id, title: r.title });
  }

  return res.status(200).json({
    ok: true, today, weekday, monthday,
    generated_count: generated.length,
    skipped_count: skipped.length,
    generated, skipped,
  });
}
