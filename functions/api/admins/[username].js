// /api/admins/[username]
//   PATCH   改指定账号的口令     { password }
//   DELETE  删除指定账号
//
// 保护措施：
//   - 只有已登录管理员能调用
//   - 不允许删掉自己（避免误操作把自己锁在外面）
//   - 不允许删掉最后一个账号（否则谁也进不来了）
import { requireUser, json } from '../../_auth.js';
import { findAdmin, setAdminPassword, deleteAdmin, listAdmins } from '../../_admins.js';

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

export async function onRequestPatch({ request, env, params }) {
  const g = await guard(request, env);
  if (g.error) return g.error;

  const target = String(params.username || '').trim();
  const row = await findAdmin(env, target);
  if (!row) return json({ ok: false, error: '找不到这个账号' }, 404);

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (password.length < 8) return json({ ok: false, error: '口令至少 8 位' }, 400);
  if (password.length > 200) return json({ ok: false, error: '口令太长' }, 400);

  await setAdminPassword(env, target, password);

  // 改的是自己的口令，就让当前会话失效——这样别人拿着旧 cookie 也没用，
  // 而你自己需要重新登录一次，属于预期行为。
  const changed = target === g.user;
  return json({ ok: true, username: target, reLoginRequired: changed });
}

export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env);
  if (g.error) return g.error;

  const target = String(params.username || '').trim();

  if (target === g.user) {
    return json({ ok: false, error: '不能删除当前登录的账号' }, 400);
  }

  const row = await findAdmin(env, target);
  if (!row) return json({ ok: false, error: '找不到这个账号' }, 404);

  const admins = await listAdmins(env);
  if (admins.length <= 1) {
    return json({ ok: false, error: '这是最后一个管理员账号，删掉就没人能进后台了' }, 400);
  }

  await deleteAdmin(env, target);
  return json({ ok: true, username: target, total: admins.length - 1 });
}
