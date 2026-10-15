// POST /api/images      上传作品（需要登录）
// GET  /api/images      读取作品列表
//   - 未登录：只返回 approved
//   - 已登录：返回全部，便于在后台里审
//
// 绑定：R2 桶、D1 数据库。变量名见下面 BUCKET_NAMES / DB_NAMES，
// 两种常见命名都认，避免 dashboard 里填的名字大小写不同就整个卡住。
import { requireUser, json, bucketOf, dbOf } from '../_auth.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

/** 图片地址：优先用 R2 公开域（若配置），否则走本站 /api/file/ 由 Function 转发 */
function fileUrl(env, key) {
  const base = env.R2_PUBLIC_BASE;
  return base ? `${base.replace(/\/$/, '')}/${key}` : `/api/file/${key}`;
}

/** 把 D1 的行整理成前端要的形状 */
const toItem = (env) => (row) => ({
  id: row.id,
  title: row.title,
  author: row.author || '',
  createdAt: row.created_at,
  status: row.status,
  url: fileUrl(env, row.id),
});

export async function onRequestGet({ request, env }) {
  const db = dbOf(env);
  if (!db) {
    return json({ ok: false, error: 'D1 未绑定（变量名建议用 DB）' }, 500);
  }

  let user = null;
  try {
    user = await requireUser(request, env);
  } catch {
    // 会话密钥没配时，列表仍可按公开视图返回，不阻塞访客
    user = null;
  }

  const sql = user
    ? 'SELECT id, title, author, created_at, status FROM images ORDER BY created_at DESC LIMIT 500'
    : "SELECT id, title, author, created_at, status FROM images WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500";

  const { results } = await db.prepare(sql).all();
  return json({ ok: true, loggedIn: Boolean(user), items: results.map(toItem(env)) });
}

export async function onRequestPost({ request, env }) {
  let user = null;
  try {
    user = await requireUser(request, env);
  } catch (err) {
    return json({ ok: false, error: `服务端未配置好：${err.message}` }, 500);
  }
  if (!user) return json({ ok: false, error: '请先登录' }, 401);

  const bucket = bucketOf(env);
  const db = dbOf(env);
  if (!bucket) return json({ ok: false, error: 'R2 未绑定（变量名建议用 GALLERY_BUCKET）' }, 500);
  if (!db) return json({ ok: false, error: 'D1 未绑定（变量名建议用 DB）' }, 500);

  const form = await request.formData();
  const file = form.get('file');
  const title = (form.get('title') || '').toString().trim();
  const author = (form.get('author') || '').toString().trim();
  // 默认待审，管理员可在后台直接通过
  const status = form.get('status') === 'approved' ? 'approved' : 'pending';

  if (!(file instanceof File)) return json({ ok: false, error: '没有收到文件' }, 400);
  if (!title) return json({ ok: false, error: '标题必填' }, 400);
  if (title.length > 100) return json({ ok: false, error: '标题太长（最多 100 字）' }, 400);
  if (author.length > 50) return json({ ok: false, error: '作者名太长（最多 50 字）' }, 400);

  const ext = ALLOWED.get(file.type);
  if (!ext) return json({ ok: false, error: '只支持 jpg / png / webp / gif' }, 400);
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: `图片超过 ${MAX_BYTES / 1024 / 1024}MB，先压缩一下` }, 400);
  }
  if (file.size === 0) return json({ ok: false, error: '文件是空的' }, 400);

  // 文件名用时间戳 + 随机串，避免重名互相覆盖
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  await bucket.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  await db
    .prepare('INSERT INTO images (id, title, author, created_at, status) VALUES (?, ?, ?, ?, ?)')
    .bind(key, title, author, Date.now(), status)
    .run();

  return json({
    ok: true,
    item: { id: key, title, author, status, url: fileUrl(env, key) },
  });
}
