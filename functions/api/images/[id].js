// 单张图片的操作
// PATCH  /api/images/[id]   改标题/作者/审核状态（需要登录）
// DELETE /api/images/[id]   删除，同时清掉 R2 文件（需要登录）
import { requireUser, json, bucketOf, dbOf } from '../../_auth.js';

const STATUSES = new Set(['pending', 'approved', 'hidden']);

/** 会话与数据库都要就绪才允许操作；返回错误 Response 或 null */
async function guard(request, env) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return { error: json({ ok: false, error: `服务端未配置好：${err.message}` }, 500) };
  }
  if (!user) return { error: json({ ok: false, error: '请先登录' }, 401) };

  const db = dbOf(env);
  if (!db) return { error: json({ ok: false, error: 'D1 未绑定（变量名建议用 DB）' }, 500) };

  return { user, db };
}

export async function onRequestPatch({ request, env, params }) {
  const g = await guard(request, env);
  if (g.error) return g.error;
  const { db } = g;

  const id = params.id;
  const row = await db.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
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

  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isFinite(n)) return json({ ok: false, error: '排序权重必须是数字' }, 400);
    sets.push('sort_order = ?');
    values.push(Math.trunc(n));
  }

  if (sets.length === 0) return json({ ok: false, error: '没有要改的字段' }, 400);

  values.push(id);
  await db.prepare(`UPDATE images SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const g = await guard(request, env);
  if (g.error) return g.error;
  const { db } = g;

  const id = params.id;
  const row = await db.prepare('SELECT id FROM images WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, error: '找不到这张图' }, 404);

  // 先删文件再删记录。反过来的话，文件删失败就成了孤儿文件，很难追。
  const bucket = bucketOf(env);
  if (bucket) {
    await bucket.delete(id);
  }
  await db.prepare('DELETE FROM images WHERE id = ?').bind(id).run();

  return json({ ok: true });
}
