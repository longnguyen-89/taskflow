// Helper to send push notification via API
export async function sendPush(userId, title, body, extra = {}) {
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_CRON_SECRET || '',
      },
      body: JSON.stringify({ userId, title, body, ...extra }),
    });
  } catch (e) {
    // Silent fail - push is nice-to-have, not critical
    console.log('Push send failed:', e.message);
  }
}

// Send push to multiple users
export async function sendPushToMany(userIds, title, body, extra = {}) {
  const promises = userIds.map(uid => sendPush(uid, title, body, extra));
  await Promise.allSettled(promises);
}
