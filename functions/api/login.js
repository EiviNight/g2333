// POST /api/login  登录
// 表单：username, password
//
// 口令校验顺序见 _auth.js 的 checkCredentials：
// 数据库管理员账号优先，库里没有账号时才回退到环境变量。
import { checkCredentials, createSession, sessionCookie, json } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '请求格式不对' }, 400);
  }

  const username = (form.get('username') || '').toString().trim();
  const password = (form.get('password') || '').toString();

  if (!username || !password) {
    return json({ ok: false, error: '用户名和口令都要填' }, 400);
  }

  let ok;
  try {
    ok = await checkCredentials(env, username, password);
  } catch (err) {
    return json({ ok: false, error: `服务端未配置好：${err.message}` }, 500);
  }

  if (!ok) {
    // 不区分「用户名错」和「口令错」，避免帮对方缩小猜测范围
    return json({ ok: false, error: '用户名或口令不对' }, 401);
  }

  const token = await createSession(username, env.SESSION_SECRET);
  return new Response(JSON.stringify({ ok: true, user: username }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie(token),
    },
  });
}
