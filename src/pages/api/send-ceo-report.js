// Feature 20 — Bao cao tu dong CEO
// GET /api/send-ceo-report?period=week — bao cao tuan (Mon 8am VN = 1am UTC)
// GET /api/send-ceo-report?period=month — bao cao thang (day 1 8am VN)
// Manual: POST tu admin panel (requesterId check)
//
// Tac vu: tong hop KPI toan cong ty (ca 2 department) → notify tat ca director
// + push web + (neu co RESEND_API_KEY thi send email)
// + (neu co TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_IDS thi send Telegram bot)

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
      JSON.stringify({ title, body, url: '/dashboard', tag: 'ceo-report-' + Date.now() })
    );
    return true;
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
    return false;
  }
}

function getPeriodRange(period) {
  const now = new Date();
  let start, prevStart, prevEnd;
  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
  } else {
    // week: last 7 days
    start = new Date(now); start.setDate(now.getDate() - 7);
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - 7);
  }
  return { start, end: now, prevStart, prevEnd };
}

function fmtMoney(v) { return new Intl.NumberFormat('vi-VN').format(v || 0) + 'đ'; }
function trendArrow(cur, prev) {
  if (prev === 0 && cur === 0) return '—';
  if (prev === 0) return '📈 +100%';
  const pct = Math.round((cur - prev) / prev * 100);
  if (pct === 0) return '→ không đổi';
  return (pct > 0 ? '📈 +' : '📉 ') + pct + '%';
}

async function computeKPI(department, start, end, prevStart, prevEnd) {
  const endISO = end.toISOString();
  const startISO = start.toISOString();
  const prevEndISO = prevEnd.toISOString();
  const prevStartISO = prevStart.toISOString();

  const [tR, pR, ptR, ppR] = await Promise.all([
    supabase.from('tasks').select('id, status, deadline, completed_at, created_at')
      .eq('department', department).is('parent_id', null)
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('proposals').select('id, status, estimated_cost, created_at')
      .eq('department', department)
      .gte('created_at', startISO).lte('created_at', endISO),
    supabase.from('tasks').select('id, status, deadline, completed_at')
      .eq('department', department).is('parent_id', null)
      .gte('created_at', prevStartISO).lte('created_at', prevEndISO),
    supabase.from('proposals').select('id, status, estimated_cost')
      .eq('department', department)
      .gte('created_at', prevStartISO).lte('created_at', prevEndISO),
  ]);

  const tasks = tR.data || [];
  const proposals = pR.data || [];
  const prevTasks = ptR.data || [];
  const prevProposals = ppR.data || [];
  const now = new Date();

  const totalTasks = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const rate = totalTasks > 0 ? Math.round(done / totalTasks * 100) : 0;
  const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;

  const prevRate = prevTasks.length > 0 ? Math.round(prevTasks.filter(t => t.status === 'done').length / prevTasks.length * 100) : 0;
  const prevOverdue = prevTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;

  const approved = proposals.filter(p => p.status === 'approved').length;
  const pending = proposals.filter(p => p.status === 'pending' || p.status === 'partial').length;
  const cost = proposals.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);
  const prevCost = prevProposals.filter(p => p.status === 'approved').reduce((s, p) => s + (Number(p.estimated_cost) || 0), 0);

  // Health score
  const onTime = tasks.filter(t => t.status === 'done' && (!t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline))).length;
  const onTimeRate = done > 0 ? Math.round(onTime / done * 100) : 0;
  const approvalRate = proposals.length > 0 ? Math.round(approved / proposals.length * 100) : 0;
  const health = Math.round(
    rate * 0.35 + onTimeRate * 0.25 +
    (totalTasks > 0 ? Math.max(0, 100 - (overdue / totalTasks) * 200) : 100) * 0.20 +
    approvalRate * 0.20
  );

  return {
    department, totalTasks, done, rate, overdue, approved, pending, cost,
    prevRate, prevOverdue, prevCost, health, onTimeRate,
  };
}

function formatReportMessage(periodLabel, nail, hotel) {
  const lines = [];
  lines.push('📊 BÁO CÁO ' + periodLabel.toUpperCase() + ' — CCE Group');
  lines.push('');
  lines.push('🎨 NAIL (Coco Nail):');
  lines.push(`  • Task: ${nail.done}/${nail.totalTasks} hoàn thành (${nail.rate}%) — ${trendArrow(nail.rate, nail.prevRate)} so với ${periodLabel} trước`);
  lines.push(`  • Trễ hạn: ${nail.overdue} task ${nail.overdue < nail.prevOverdue ? '(giảm so với trước)' : nail.overdue > nail.prevOverdue ? '(tăng)' : ''}`);
  lines.push(`  • Đề xuất: ${nail.approved} duyệt, ${nail.pending} chờ`);
  lines.push(`  • Chi phí duyệt: ${fmtMoney(nail.cost)} — ${trendArrow(nail.cost, nail.prevCost)}`);
  lines.push(`  • Health Score: ${nail.health}/100 ${nail.health >= 75 ? '✅' : nail.health >= 50 ? '⚠️' : '🚨'}`);
  lines.push('');
  lines.push('🏨 HOTEL (Coco Ex):');
  lines.push(`  • Task: ${hotel.done}/${hotel.totalTasks} hoàn thành (${hotel.rate}%) — ${trendArrow(hotel.rate, hotel.prevRate)}`);
  lines.push(`  • Trễ hạn: ${hotel.overdue} task`);
  lines.push(`  • Đề xuất: ${hotel.approved} duyệt, ${hotel.pending} chờ`);
  lines.push(`  • Chi phí duyệt: ${fmtMoney(hotel.cost)} — ${trendArrow(hotel.cost, hotel.prevCost)}`);
  lines.push(`  • Health Score: ${hotel.health}/100 ${hotel.health >= 75 ? '✅' : hotel.health >= 50 ? '⚠️' : '🚨'}`);
  lines.push('');
  const totalTasks = nail.totalTasks + hotel.totalTasks;
  const totalDone = nail.done + hotel.done;
  const totalCost = nail.cost + hotel.cost;
  const totalRate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
  lines.push('🏢 TỔNG:');
  lines.push(`  • ${totalDone}/${totalTasks} task (${totalRate}%) • ${fmtMoney(totalCost)} chi phí`);
  return lines.join('\n');
}

function formatReportHTML(periodLabel, nail, hotel) {
  const totalTasks = nail.totalTasks + hotel.totalTasks;
  const totalDone = nail.done + hotel.done;
  const totalCost = nail.cost + hotel.cost;
  const totalRate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
  const healthColor = h => h >= 75 ? '#16a34a' : h >= 50 ? '#d97706' : '#dc2626';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Báo cáo CEO</title></head>
<body style="font-family:-apple-system,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<h2 style="margin:0 0 4px 0;color:#2D5A3D">📊 Báo cáo ${periodLabel} — CCE Group</h2>
<p style="color:#6b7280;font-size:13px;margin:0 0 20px 0">Tổng hợp KPI tự động • ${new Date().toLocaleString('vi-VN')}</p>

<h3 style="margin:20px 0 10px 0;color:#be185d">🎨 NAIL (Coco Nail)</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<tr><td style="padding:6px 0;color:#6b7280">Task hoàn thành</td><td style="text-align:right"><b>${nail.done}/${nail.totalTasks}</b> (${nail.rate}%) ${trendArrow(nail.rate, nail.prevRate)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Trễ hạn</td><td style="text-align:right"><b>${nail.overdue}</b> task</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Đề xuất duyệt / chờ</td><td style="text-align:right"><b>${nail.approved}</b> / ${nail.pending}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Chi phí duyệt</td><td style="text-align:right"><b>${fmtMoney(nail.cost)}</b> ${trendArrow(nail.cost, nail.prevCost)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Health Score</td><td style="text-align:right"><b style="color:${healthColor(nail.health)}">${nail.health}/100</b></td></tr>
</table>

<h3 style="margin:24px 0 10px 0;color:#2563eb">🏨 HOTEL (Coco Ex)</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<tr><td style="padding:6px 0;color:#6b7280">Task hoàn thành</td><td style="text-align:right"><b>${hotel.done}/${hotel.totalTasks}</b> (${hotel.rate}%) ${trendArrow(hotel.rate, hotel.prevRate)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Trễ hạn</td><td style="text-align:right"><b>${hotel.overdue}</b> task</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Đề xuất duyệt / chờ</td><td style="text-align:right"><b>${hotel.approved}</b> / ${hotel.pending}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Chi phí duyệt</td><td style="text-align:right"><b>${fmtMoney(hotel.cost)}</b> ${trendArrow(hotel.cost, hotel.prevCost)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Health Score</td><td style="text-align:right"><b style="color:${healthColor(hotel.health)}">${hotel.health}/100</b></td></tr>
</table>

<div style="margin-top:24px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
<div style="font-size:12px;color:#14532d;margin-bottom:4px">🏢 TỔNG CÔNG TY</div>
<div style="font-size:15px;font-weight:600">${totalDone}/${totalTasks} task (${totalRate}%) • ${fmtMoney(totalCost)} chi phí</div>
</div>

<p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center">
<a href="https://cce-tasks.vercel.app/dashboard" style="color:#2D5A3D">Mở dashboard →</a>
</p>
</div>
</body></html>`;
}

async function sendEmailResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true, reason: 'no_resend_key' };
  const from = process.env.RESEND_FROM || 'CCE Tasks <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.message || 'resend_failed' };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ═══════════ TELEGRAM BOT ═══════════
// Env: TELEGRAM_BOT_TOKEN (from @BotFather) + TELEGRAM_CHAT_IDS (csv)
// Chat IDs: user/group/channel IDs. Get via https://api.telegram.org/bot<TOKEN>/getUpdates
// sau khi CEO da nhan tin hoac add bot vao group.
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { skipped: true, reason: 'no_bot_token' };
  if (!chatId) return { skipped: true, reason: 'no_chat_id' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await r.json();
    if (!data.ok) return { ok: false, error: data.description || 'telegram_failed' };
    return { ok: true, messageId: data.result?.message_id };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function formatReportTelegram(periodLabel, nail, hotel) {
  const totalTasks = nail.totalTasks + hotel.totalTasks;
  const totalDone = nail.done + hotel.done;
  const totalCost = nail.cost + hotel.cost;
  const totalRate = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0;
  const healthIcon = h => h >= 75 ? '✅' : h >= 50 ? '⚠️' : '🚨';
  const ts = new Date().toLocaleString('vi-VN');

  // Telegram HTML parse mode: <b>, <i>, <u>, <s>, <code>, <pre>, <a href>
  return `<b>📊 BÁO CÁO ${periodLabel.toUpperCase()} — CCE Group</b>
<i>${ts}</i>

<b>🎨 NAIL (Coco Nail)</b>
• Task: <b>${nail.done}/${nail.totalTasks}</b> (${nail.rate}%) ${trendArrow(nail.rate, nail.prevRate)}
• Trễ hạn: <b>${nail.overdue}</b> task
• Đề xuất: <b>${nail.approved}</b> duyệt / ${nail.pending} chờ
• Chi phí: <b>${fmtMoney(nail.cost)}</b> ${trendArrow(nail.cost, nail.prevCost)}
• Health: <b>${nail.health}/100</b> ${healthIcon(nail.health)}

<b>🏨 HOTEL (Coco Ex)</b>
• Task: <b>${hotel.done}/${hotel.totalTasks}</b> (${hotel.rate}%) ${trendArrow(hotel.rate, hotel.prevRate)}
• Trễ hạn: <b>${hotel.overdue}</b> task
• Đề xuất: <b>${hotel.approved}</b> duyệt / ${hotel.pending} chờ
• Chi phí: <b>${fmtMoney(hotel.cost)}</b> ${trendArrow(hotel.cost, hotel.prevCost)}
• Health: <b>${hotel.health}/100</b> ${healthIcon(hotel.health)}

<b>🏢 TỔNG CÔNG TY</b>
<b>${totalDone}/${totalTasks}</b> task (${totalRate}%) • <b>${fmtMoney(totalCost)}</b> chi phí

<a href="https://cce-tasks.vercel.app/dashboard">Mở dashboard →</a>`;
}

export default async function handler(req, res) {
  // Vercel Cron mac dinh gui header `Authorization: Bearer <CRON_SECRET>` khi env var nay duoc set.
  // Cung chap nhan `x-api-key` header hoac `?key=` query de test tu CLI.
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const apiKey = req.headers['x-api-key'] || req.query.key || bearer;
  const isCron = !!process.env.CRON_SECRET && apiKey === process.env.CRON_SECRET;
  const requesterId = req.query.requesterId || req.body?.requesterId;
  const period = (req.query.period || req.body?.period || 'week') === 'month' ? 'month' : 'week';

  // Auth: either CRON_SECRET or director requester
  let authorized = isCron;
  if (!authorized && requesterId) {
    const { data: p } = await supabase.from('profiles').select('role').eq('id', requesterId).single();
    if (p && p.role === 'director') authorized = true;
  }
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { start, end, prevStart, prevEnd } = getPeriodRange(period);
    const [nail, hotel] = await Promise.all([
      computeKPI('nail', start, end, prevStart, prevEnd),
      computeKPI('hotel', start, end, prevStart, prevEnd),
    ]);

    const periodLabel = period === 'month' ? 'Tháng' : 'Tuần';
    const message = formatReportMessage(periodLabel, nail, hotel);
    const html = formatReportHTML(periodLabel, nail, hotel);
    const telegramMsg = formatReportTelegram(periodLabel, nail, hotel);
    const title = `📊 Báo cáo ${periodLabel.toLowerCase()} — CCE Group`;

    // Find all directors
    const { data: directors } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'director');

    const notifyResults = [];
    for (const dir of (directors || [])) {
      // In-app notification (with full markdown-ish message)
      await supabase.from('notifications').insert({
        user_id: dir.id, type: 'info',
        title, message,
      });
      // Push
      const pushed = await sendPushToUser(dir.id, title, `${nail.done + hotel.done} task xong, ${fmtMoney(nail.cost + hotel.cost)} chi phí`);
      // Email (if Resend key)
      let email = { skipped: true };
      if (dir.email) {
        email = await sendEmailResend(dir.email, title, html);
      }
      notifyResults.push({ id: dir.id, name: dir.name, pushed, email });
    }

    // Telegram: gui cho tat ca chat_id trong TELEGRAM_CHAT_IDS (csv).
    // Co the la personal chat, group, hoac channel — tuy CEO dang ky.
    const chatIds = (process.env.TELEGRAM_CHAT_IDS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const telegramResults = [];
    for (const chatId of chatIds) {
      const result = await sendTelegram(chatId, telegramMsg);
      telegramResults.push({ chatId, ...result });
    }

    return res.status(200).json({
      success: true, period, periodLabel,
      nail, hotel,
      totalTasks: nail.totalTasks + hotel.totalTasks,
      totalDone: nail.done + hotel.done,
      totalCost: nail.cost + hotel.cost,
      notifyResults,
      telegramResults,
      sentAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
