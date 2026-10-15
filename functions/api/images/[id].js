// 单张图片的操作
// PATCH  /api/images/[id]   改标题/作者/审核状态（需要登录）
// DELETE /api/images/[id]   删除，同时清掉 R2 文件（需要登录）
import { requireUser, json } from '../../_auth.js';

const STATUSES = new Set(['pending', 'approved', 'hidden']);

export async function onRequestPatch({ request, env, params }) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return json({ ok: false, error: `服务端未配置好：${err.message}` }, 500);
  }
  if (!user) return json({ ok: false, error: '请先登录' }, 401);
  if (!env.DB) return json({ ok: false, error: 'D1 未绑定' }, 500);

  const id = params.id;
  const row = await env.DB.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, error: '找不到这张图' }, 404);

  const body = await request.json().catch(() => ({}));
  const sets = [];
  const values = [];

  if (typeof body.title === 'string') {
    const t = body.title.trim();
    if (!t) return json({ ok: false, error: '标题不能为空' }, 400);
    if (t.length > 100) return json({ ok: false, error: '标题太长' }, 400);
    sets.push('title = ?');
    values.push(t);
  }

  if (typeof body.author === 'string') {
    const a = body.author.trim();
    if (a.length > 50) return json({ ok: false, error: '作者名太长' }, 400);
    sets.push('author = ?');
    values.push(a);
  }

  if (typeof body.status === 'string') {
    if (!STATUSES.has(body.status)) return json({ ok: false, error: '状态值不合法' }, 400);
    sets.push('status = ?');
    values.push(body.status);
  }

  if (sets.length === 0) return json({ ok: false, error: '没有要改的字段' }, 400);

  values.push(id);
  await env.DB.prepare(`UPDATE images SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return json({ ok: false, error: `服务端未配置好：${err.message}` }, 500);
  }
  if (!user) return json({ ok: false, error: '请先登录' }, 401);
  if (!env.DB) return json({ ok: false, error: 'D1 未绑定' }, 500);

  const id = params.id;
  const row = await env.DB.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, error: '找不到这张图' }, 404);

  // 先删文件再删记录。反过来的话，文件删失败就成了孤儿文件，很难追。
  if (env.GALLERY_BUCKET) {
    await env.GALLERY_BUCKET.delete(id);
  }
  await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();

  return json({ ok: true });
}
