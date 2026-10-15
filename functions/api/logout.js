// POST /api/logout  退出登录
import { clearCookie, json } from '../_auth.js';

export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearCookie(),
    },
  });
}
