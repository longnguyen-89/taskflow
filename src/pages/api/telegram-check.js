// Helper endpoint: kiem tra bot Telegram + list cac chat ID da nhan tin bot
// Goi: GET /api/telegram-check?requesterId=<director_id>
// Yeu cau: TELEGRAM_BOT_TOKEN phai set trong Vercel env
// Bao mat: chi director moi goi duoc (tranh lo token / chat ID ra ngoai)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Auth: chi director
  const requesterId = req.query.requesterId || req.body?.requesterId;
  if (!requesterId) return res.status(401).json({ error: 'Missing requesterId' });
  const { data: p } = await supabase.from('profiles').select('role, name').eq('id', requesterId).single();
  if (!p || p.role !== 'director') return res.status(403).json({ error: 'Chi TGD moi check duoc bot' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(200).json({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN chua duoc set. Vao BotFather (@BotFather) → /newbot → copy token → set trong Vercel env.',
      setupSteps: [
        '1. Mo Telegram, tim @BotFather → /newbot',
        '2. Dat ten bot (vd: CCE Tasks Bot) va username (vd: cce_tasks_bot)',
        '3. Copy token (dang 123456:ABC-DEF...) → set Vercel env TELEGRAM_BOT_TOKEN',
        '4. Moi CEO mo Telegram → tim bot → bam Start',
        '5. Goi lai endpoint nay de thay chat_id',
      ],
    });
  }

  // Call Telegram getUpdates API
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await r.json();
    if (!data.ok) return res.status(500).json({ error: data.description || 'getUpdates failed' });

    // Extract unique chat IDs
    const chats = new Map();
    for (const update of (data.result || [])) {
      const msg = update.message || update.edited_message || update.channel_post;
      if (!msg || !msg.chat) continue;
      const c = msg.chat;
      if (!chats.has(c.id)) {
        chats.set(c.id, {
          id: c.id,
          type: c.type, // 'private' | 'group' | 'supergroup' | 'channel'
          title: c.title || null,
          firstName: c.first_name || null,
          lastName: c.last_name || null,
          username: c.username || null,
          lastMessage: msg.text?.slice(0, 50) || null,
        });
      }
    }

    // Also fetch bot info
    const botR = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const botData = await botR.json();

    return res.status(200).json({
      configured: true,
      bot: botData.ok ? {
        username: botData.result.username,
        firstName: botData.result.first_name,
        link: `https://t.me/${botData.result.username}`,
      } : null,
      chats: Array.from(chats.values()),
      csv: Array.from(chats.keys()).join(','),
      updatesCount: (data.result || []).length,
      hint: chats.size === 0
        ? 'Chua co ai nhan tin bot. Hay nho CEO mo t.me/<bot_username> → bam Start, roi goi lai endpoint nay.'
        : `Paste chuoi "csv" o tren vao Vercel env TELEGRAM_CHAT_IDS de gui bao cao.`,
      currentEnv: {
        TELEGRAM_BOT_TOKEN: 'set',
        TELEGRAM_CHAT_IDS: process.env.TELEGRAM_CHAT_IDS || '(chua set)',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
