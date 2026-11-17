// Nạp trước phép thử (node --import ./tests/hooks.mjs): nạp handler THẬT trong src/,
// chỉ thay 2 gói ngoài bằng bản giả và chặn mạng.
//   @/x                    → <gốc>/src/x(.js)   (giống jsconfig paths)
//   @supabase/supabase-js  → tests/mock-supabase.mjs
//   web-push               → tests/mock-web-push.mjs
// Gốc = TASKFLOW_ROOT nếu có (bản sao để thử đột biến), không thì thư mục cha của tests/.
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { state } from './mock-supabase.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.TASKFLOW_ROOT || path.resolve(here, '..');

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@supabase/supabase-js') {
      return { url: pathToFileURL(path.join(here, 'mock-supabase.mjs')).href, shortCircuit: true };
    }
    if (specifier === 'web-push') {
      return { url: pathToFileURL(path.join(here, 'mock-web-push.mjs')).href, shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      let p = path.join(root, 'src', specifier.slice(2));
      if (!path.extname(p)) p += '.js';
      return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

// Chặn mọi fetch ra ngoài (Anthropic, Telegram, Resend...) — phép thử không được chạm mạng.
// __fetchTatCa: sổ cả lượt chạy (không bị reset giữa các phép thử).
globalThis.__fetchTatCa = [];
globalThis.fetch = async (url) => {
  state.fetches.push(String(url));
  globalThis.__fetchTatCa.push(String(url));
  throw new Error('mạng bị chặn trong phép thử: ' + url);
};
