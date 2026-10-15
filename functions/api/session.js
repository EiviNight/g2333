// GET /api/session  查询当前是否已登录
// 前端用它判断该显示登录框还是管理面板
import { requireUser, json } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return json({ ok: false, loggedIn: false, error: `服务端未配置好：${err.message}` }, 500);
  }
  return json({ ok: true, loggedIn: Boolean(user), user: user || null });
}
