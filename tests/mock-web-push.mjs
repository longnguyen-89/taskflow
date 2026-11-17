// web-push GIẢ: không gửi gì ra mạng, chỉ ghi lại vào state.pushes.
import { state } from './mock-supabase.mjs';

export default {
  setVapidDetails() {},
  async sendNotification(sub, body) { state.pushes.push({ endpoint: sub?.endpoint, body }); return {}; },
};
