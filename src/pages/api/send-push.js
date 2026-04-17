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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // API key auth — accept both CRON_SECRET (server-side cron) and NEXT_PUBLIC_CRON_SECRET (client-side calls)
  const apiKey = req.headers['x-api-key'];
  const validKeys = [process.env.CRON_SECRET, process.env.NEXT_PUBLIC_CRON_SECRET].filter(Boolean);
  if (!apiKey || !validKeys.includes(apiKey)) return res.status(401).json({ error: 'Unauthorized' });

  const { userId, title, body, url, tag } = req.body;

  try {
    // Get user's push subscription
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!sub) return res.status(200).json({ sent: false, reason: 'No subscription' });

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify({
      title: title || 'CCE - TasksFlow',
      body: body || 'Thông báo mới',
      url: url || '/dashboard',
      tag: tag || 'default',
    }));

    return res.status(200).json({ sent: true });
  } catch (error) {
    // If subscription expired, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
    return res.status(200).json({ sent: false, error: error.message });
  }
}
