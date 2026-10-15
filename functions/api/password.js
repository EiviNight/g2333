// POST /api/password   管理员自助改自己的口令
//   body: { currentPassword, newPassword }
//
// 要求先验旧口令，防止会话被劫持后对方直接改掉口令把你锁出去。
import { requireUser, json } from '../_auth.js';
import { findAdmin, verifyPassword, setAdminPassword } from '../_admins.js';

export async function onRequestPost({ request, env }) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return json({ ok: false, error: `服务端未配置好：${err.message}` }, 500);
  }
  if (!user) return json({ ok: false, error: '请先登录' }, 401);

  const body = await request.json().catch(() => ({}));
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');

  if (!current || !next) {
    return json({ ok: false, error: '当前口令和新口令都要填' }, 400);
  }
  if (next.length < 8) return json({ ok: false, error: '新口令至少 8 位' }, 400);
  if (next.length > 200) return json({ ok: false, error: '新口令太长' }, 400);
  if (current === next) {
    return json({ ok: false, error: '新口令不能和当前口令相同' }, 400);
  }

  const row = await findAdmin(env, user);
  if (!row) {
    return json(
      { ok: false, error: '当前登录的账号不在数据库里（可能还在用环境变量兜底），请先创建一个账号' },
      400,
    );
  }

  const ok = await verifyPassword(current, row);
  if (!ok) return json({ ok: false, error: '当前口令不对' }, 401);

  await setAdminPassword(env, user, next);

  // 口令已换，旧会话签名仍然有效但语义上应该重登。
  // 这里显式清掉 cookie，逼迫重新登录。
  return new Response(JSON.stringify({ ok: true, reLoginRequired: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'g2333_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
