// activities 和 posts 两张表结构高度相似，共用这里的校验与归一化逻辑，
// 避免两边各写一份、改一处漏一处。

import { requireUser, json, dbOf } from './_auth.js';
import { marked } from 'marked';

export const STATUSES = new Set(['draft', 'published']);

marked.setOptions({ gfm: true, breaks: true });

/** 详情页需要直接可插入的 HTML，所以在服务端把 Markdown 转好 */
function renderMarkdown(md) {
  if (!md) return '';
  try {
    return marked.parse(String(md), { async: false });
  } catch {
    // 渲染失败也不能让详情页空白，退化成纯文本由前端展示
    return '';
  }
}

/** 把标题转成网址片段；中文等非 ASCII 字符会被保留为可读形式 */
export function slugify(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return s;
}

/** 未提供 id 时按日期 + 标题生成 */
export function makeId(title, dateStr) {
  const base = slugify(title);
  if (base) return base;
  return `item-${Date.now()}`;
}

export function splitTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return String(raw || '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function joinTags(raw) {
  return splitTags(raw).join(',');
}

export const tagsToArray = (s) =>
  String(s || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * 校验并归一化一次写入/更新请求。返回 { error } 或 { values }
 *
 * 两种内容共用同一套函数，但字段不全相同：
 *   activities 有 event_date / location
 *   posts      有 author
 * 校验和入库都必须只碰本类型真实存在的列，否则会写进不存在的字段。
 */
export function normalizeInput(body, { requireAll, kind }) {
  const out = {};

  const str = (v) => (v == null ? '' : String(v).trim());

  if (requireAll || body.title !== undefined) {
    const title = str(body.title);
    if (!title) return { error: '标题必填' };
    if (title.length > 200) return { error: '标题太长（最多 200 字）' };
    out.title = title;
  }

  if (requireAll || body.summary !== undefined) {
    const summary = str(body.summary);
    if (summary.length > 500) return { error: '摘要太长（最多 500 字）' };
    out.summary = summary;
  }

  if (requireAll || body.body !== undefined) {
    const text = body.body == null ? '' : String(body.body);
    if (text.length > 200000) return { error: '正文太长' };
    out.body = text;
  }

  if (requireAll || body.cover !== undefined) out.cover = str(body.cover).slice(0, 500);
  if (requireAll || body.tags !== undefined) out.tags = joinTags(body.tags).slice(0, 300);

  if (kind === 'activities') {
    if (requireAll || body.location !== undefined) {
      out.location = str(body.location).slice(0, 200);
    }
    if (requireAll || body.event_date !== undefined) {
      const d = str(body.event_date);
      if (requireAll && !d) return { error: '活动日期必填' };
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: '活动日期格式应为 YYYY-MM-DD' };
      if (d) out.event_date = d;
    }
  }

  if (kind === 'posts') {
    if (requireAll || body.author !== undefined) {
      out.author = str(body.author).slice(0, 100);
    }
  }

  if (requireAll || body.status !== undefined) {
    const s = str(body.status) || 'published';
    if (!STATUSES.has(s)) return { error: '状态只能是 draft 或 published' };
    out.status = s;
  }

  return { values: out };
}

/** 表名只允许这两个白名单值，避免拼接进 SQL 时出现注入面 */
const TABLES = { activities: 'activities', posts: 'posts' };

/**
 * 取出条目 id。
 *
 * 优先用路由参数，取不到时从 URL 路径末段解析。
 * 为什么要兜底：Pages Functions 的 `params` 在部分情况下拿不到动态段的值
 * （曾出现过 params.id 为空、导致详情/编辑/删除全部查不到记录的情况）。
 * 路径解析与参数解析得到的是同一个值，所以两条路都留着更稳。
 */
function resolveId(request, params) {
  const fromParams = params && typeof params.id === 'string' ? params.id : '';
  if (fromParams) return decodeURIComponent(fromParams);

  try {
    const segments = new URL(request.url).pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    return decodeURIComponent(last);
  } catch {
    return '';
  }
}


/**
 * 生成列表 / 新建 / 单项操作的通用 handlers。
 * kind 为 'activities' 或 'posts'。
 */
export function makeContentHandlers(kind) {
  const table = TABLES[kind];
  if (!table) throw new Error(`未知的内容类型: ${kind}`);

  // activities 按活动日期排，posts 按创建时间排
  const orderBy =
    kind === 'activities' ? 'event_date DESC, created_at DESC' : 'created_at DESC';

  const dateColumn = kind === 'activities' ? 'event_date' : 'created_at';

  /** 鉴权 + 绑定检查。返回 { error } 或 { db, isAdmin } */
  async function guard(request, env, { needAdmin }) {
    const db = dbOf(env);
    if (!db) return { error: json({ ok: false, error: 'D1 未绑定（变量名建议用 DB）' }, 500) };

    let user = null;
    try {
      user = await requireUser(request, env);
    } catch (err) {
      if (needAdmin) {
        return { error: json({ ok: false, error: `服务端未配置好：${err.message}` }, 500) };
      }
      return { db, isAdmin: false, user: null };
    }

    if (needAdmin && !user) {
      return { error: json({ ok: false, error: '请先登录' }, 401) };
    }

    return { db, isAdmin: Boolean(user), user };
  }

  const listHandler = async ({ request, env }) => {
    const g = await guard(request, env, { needAdmin: false });
    if (g.error) return g.error;

    const sql = g.isAdmin
      ? `SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT 500`
      : `SELECT * FROM ${table} WHERE status = 'published' ORDER BY ${orderBy} LIMIT 500`;

    const { results } = await g.db.prepare(sql).all();
    return json({ ok: true, loggedIn: g.isAdmin, items: results });
  };

  const createHandler = async ({ request, env }) => {
    const g = await guard(request, env, { needAdmin: true });
    if (g.error) return g.error;

    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是合法 JSON' }, 400);

    const { values, error } = normalizeInput(body, { requireAll: true, kind });
    if (error) return json({ ok: false, error }, 400);

    let id = slugify(body.id);
    if (!id) id = makeId(values.title, values[dateColumn]);

    const exists = await g.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first();
    if (exists) return json({ ok: false, error: `网址片段「${id}」已被占用，换一个` }, 409);

    const now = Date.now();
    const cols = ['id', ...Object.keys(values), 'created_at', 'updated_at'];
    const placeholders = cols.map(() => '?').join(', ');
    const binds = [id, ...Object.values(values), now, now];

    await g.db
      .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
      .bind(...binds)
      .run();

    return json({ ok: true, id });
  };

  const updateHandler = async ({ request, env, params }) => {
    const g = await guard(request, env, { needAdmin: true });
    if (g.error) return g.error;

    const id = resolveId(request, params);
    if (!id) return json({ ok: false, error: '缺少条目 id' }, 400);
    const row = await g.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first();
    if (!row) return json({ ok: false, error: '找不到这条内容' }, 404);

    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: '请求体不是合法 JSON' }, 400);

    const { values, error } = normalizeInput(body, { requireAll: false, kind });
    if (error) return json({ ok: false, error }, 400);

    const keys = Object.keys(values);
    if (keys.length === 0) return json({ ok: false, error: '没有要改的字段' }, 400);

    const sets = keys.map((k) => `${k} = ?`).join(', ');
    await g.db
      .prepare(`UPDATE ${table} SET ${sets}, updated_at = ? WHERE id = ?`)
      .bind(...Object.values(values), Date.now(), id)
      .run();

    return json({ ok: true, id });
  };

  const deleteHandler = async ({ request, env, params }) => {
    const g = await guard(request, env, { needAdmin: true });
    if (g.error) return g.error;

    const id = resolveId(request, params);
    if (!id) return json({ ok: false, error: '缺少条目 id' }, 400);
    const row = await g.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first();
    if (!row) return json({ ok: false, error: '找不到这条内容' }, 404);

    await g.db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  };

  /** 单条详情：草稿仅管理员可见 */
  const getOneHandler = async ({ request, env, params }) => {
    const g = await guard(request, env, { needAdmin: false });
    if (g.error) return g.error;

    const id = resolveId(request, params);
    if (!id) return json({ ok: false, error: '缺少条目 id' }, 400);

    const row = await g.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();

    if (!row) return json({ ok: false, error: '找不到这条内容' }, 404);
    if (row.status !== 'published' && !g.isAdmin) {
      return json({ ok: false, error: '找不到这条内容' }, 404);
    }

    return json({ ok: true, item: { ...row, body_html: renderMarkdown(row.body) } });
  };

  return {
    listHandler,
    createHandler,
    updateHandler,
    deleteHandler,
    getOneHandler,
    tagsToArray,
  };
}
