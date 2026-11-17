import { apiFetch } from '@/lib/apiFetch';

// Helper to send push notification via API (xác thực bằng access token của người đang đăng nhập)
export async function sendPush(userId, title, body, extra = {}) {
  try {
    await apiFetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
