export async function sendPush(userId, title, body) {
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_CRON_SECRET || 'internal',
      },
      body: JSON.stringify({ userId, title, body }),
    });
  } catch (e) {
    // Silent fail - push is nice-to-have
  }
}
