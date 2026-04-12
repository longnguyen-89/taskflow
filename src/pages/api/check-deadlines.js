import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  'mailto:admin@cce-tasksflow.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPushToUser(userId, title, body) {
  try {
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!sub) return false;

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, url: '/dashboard', tag: 'deadline-' + Date.now() })
    );
    return true;
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
    return false;
  }
}

export default async function handler(req, res) {
  // Auth check
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (apiKey !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const now = new Date();
  const results = { reminders20h: 0, reminders1h: 0, weeklyReports: 0 };

  // --- DEADLINE REMINDERS ---
  // Get all tasks with deadlines that are not done
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignees:task_assignees(user_id)')
    .neq('status', 'done')
    .not('deadline', 'is', null);

  for (const task of (tasks || [])) {
    const deadline = new Date(task.deadline);
    const hoursLeft = (deadline - now) / (1000 * 60 * 60);

    // 20 hours before deadline (between 19-21 hours window)
    if (hoursLeft > 19 && hoursLeft <= 21) {
      for (const assignee of (task.assignees || [])) {
        const sent = await sendPushToUser(
          assignee.user_id,
          '⏰ Sắp đến hạn!',
          `"${task.title}" còn ${Math.round(hoursLeft)} tiếng nữa là hết hạn`
        );
        if (sent) {
          await supabase.from('notifications').insert({
            user_id: assignee.user_id, type: 'reminder',
            title: 'Nhắc nhở deadline', message: `"${task.title}" còn ${Math.round(hoursLeft)} tiếng`,
            task_id: task.id
          });
          results.reminders20h++;
        }
      }
    }

    // 1 hour before deadline (between 0.5-1.5 hours window)
    if (hoursLeft > 0.5 && hoursLeft <= 1.5) {
      for (const assignee of (task.assignees || [])) {
        const sent = await sendPushToUser(
          assignee.user_id,
          '🚨 Gấp! Sắp trễ deadline!',
          `"${task.title}" chỉ còn ${Math.round(hoursLeft * 60)} phút!`
        );
        if (sent) {
          await supabase.from('notifications').insert({
            user_id: assignee.user_id, type: 'reminder',
            title: 'Deadline sắp trễ!', message: `"${task.title}" chỉ còn ${Math.round(hoursLeft * 60)} phút!`,
            task_id: task.id
          });
          results.reminders1h++;
        }
      }
    }
  }

  // --- WEEKLY PERFORMANCE REPORT (run on Monday) ---
  if (now.getDay() === 1 && now.getHours() >= 8 && now.getHours() <= 9) {
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);

    const { data: allMembers } = await supabase.from('profiles').select('*');
    const { data: allTasks } = await supabase.from('tasks')
      .select('*, assignees:task_assignees(user_id)')
      .gte('created_at', weekAgo.toISOString());

    const directors = (allMembers || []).filter(m => m.role === 'director');

    for (const member of (allMembers || []).filter(m => m.role === 'member' || m.role === 'admin')) {
      const myTasks = (allTasks || []).filter(t => t.assignees?.some(a => a.user_id === member.id));
      const done = myTasks.filter(t => t.status === 'done').length;
      const total = myTasks.length;
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;

      let feedback = '';
      if (rate >= 90) feedback = 'Xuất sắc! Tiếp tục phát huy.';
      else if (rate >= 70) feedback = 'Khá tốt. Cố gắng hoàn thành thêm.';
      else if (rate >= 50) feedback = 'Cần cải thiện tốc độ.';
      else if (total > 0) feedback = 'Cần trao đổi trực tiếp để hỗ trợ.';
      else feedback = 'Không có task trong tuần này.';

      const reportMsg = `Tuần qua: ${done}/${total} task hoàn thành (${rate}%). ${feedback}`;

      // Send to employee
      await sendPushToUser(member.id, '📊 Báo cáo tuần', reportMsg);
      await supabase.from('notifications').insert({
        user_id: member.id, type: 'info',
        title: 'Báo cáo hiệu quả tuần', message: reportMsg,
      });

      // Send summary to directors
      for (const dir of directors) {
        await supabase.from('notifications').insert({
          user_id: dir.id, type: 'info',
          title: `Báo cáo tuần: ${member.name}`, message: reportMsg,
        });
      }

      results.weeklyReports++;
    }

    // Push summary to directors
    for (const dir of directors) {
      await sendPushToUser(dir.id, '📊 Tổng kết tuần', `Đã gửi báo cáo ${results.weeklyReports} nhân viên`);
    }
  }

  return res.status(200).json({ success: true, ...results, checkedAt: now.toISOString() });
}
