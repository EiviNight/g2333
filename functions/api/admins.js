// /api/admins
//   GET   列出所有管理员账号
//   POST  新建管理员            { username, password }
//
// 只有已登录的管理员能调用。
import { requireUser, json } from '../_auth.js';
import { listAdmins, createAdmin, findAdmin, adminCount } from '../_admins.js';

async function guard(request, env) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return { error: json({ ok: false, error: `服务端未配置好：${err.message}` }, 500) };
  }
  if (!user) return { error: json({ ok: false, error: '请先登录' }, 401) };
  return { user };
}

export async function onRequestGet({ request, env }) {
  const g = await guard(request, env);
  if (g.error) return g.error;

  const admins = await listAdmins(env);
  return json({
    ok: true,
    currentUser: g.user,
    admins,
    // 前端据此判断是否还能删除账号（不允许把最后一个删掉）
    count: admins.length,
  });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env);
  if (g.error) return g.error;

  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    return json(
      { ok: false, error: '用户名只能含字母、数字、下划线、点和短横线，长度 3-32' },
      400,
    );
  }
  if (password.length < 8) {
    return json({ ok: false, error: '口令至少 8 位' }, 400);
  }
  if (password.length > 200) {
    return json({ ok: false, error: '口令太长' }, 400);
  }

  const existing = await findAdmin(env, username);
  if (existing) return json({ ok: false, error: '这个用户名已存在' }, 409);

  await createAdmin(env, username, password);
  return json({ ok: true, username, total: await adminCount(env) });
}
