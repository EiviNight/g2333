/**
 * 数据初始化脚本（只在迁移时跑一次，或换库时重跑）
 *
 * 做两件事：
 *   1. 把 src/content/activities/ 里现有的 Markdown 活动迁进 D1
 *   2. 创建初始管理员账号
 *
 * 用法（凭据从环境变量读，不写死在文件里）：
 *   $env:CF_API_KEY  = "你的 Cloudflare Global API Key"
 *   $env:CF_EMAIL    = "你的账号邮箱"
 *   $env:SEED_PASSWORD = "初始管理员口令"
 *   node scripts/seed.mjs
 *
 * 幂等：已存在的记录不会重复插入。
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '4e686a896fee598af2f2228029d68764';
const DB_ID = process.env.CF_D1_ID || 'be27e3de-6338-4ff6-aeeb-a1d7cef55dea';
const API_KEY = process.env.CF_API_KEY;
const EMAIL = process.env.CF_EMAIL;
const SEED_PASSWORD = process.env.SEED_PASSWORD;
const SEED_USER = process.env.SEED_USER || 'eivi';

if (!API_KEY || !EMAIL) {
  console.error('缺少 CF_API_KEY / CF_EMAIL 环境变量');
  process.exit(1);
}

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;

async function sql(query, params = []) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'X-Auth-Key': API_KEY,
      'X-Auth-Email': EMAIL,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query, params }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`SQL 失败: ${JSON.stringify(data.errors)}`);
  }
  return data.result?.[0]?.results ?? [];
}

// ── 口令哈希（与 functions/_admins.js 保持同一套参数）────────────
// 注意：Workers 的 WebCrypto 不允许 PBKDF2 超过 100000 轮，
// 所以这里也用 100000，改高会导致线上登录报错。
const ITERATIONS = 100000;
const KEY_LEN = 32;

function toB64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function deriveHash(password, saltB64, iterations = ITERATIONS) {
  const salt = Buffer.from(saltB64, 'base64');
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
      'deriveBits',
    ]),
    KEY_LEN * 8,
  );
  return toB64(new Uint8Array(bits));
}

// ── 解析 Markdown 前置元数据 ─────────────────────────────────
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };

  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^['"]|['"]$/g, '');
    }
    data[kv[1]] = value;
  }
  return { data, body: m[2].trim() };
}

// ── 迁移活动 ────────────────────────────────────────────────
const ACTIVITY_DIR = join(root, 'src', 'content', 'activities');

async function migrateActivities() {
  let files = [];
  try {
    files = (await readdir(ACTIVITY_DIR)).filter((f) => f.endsWith('.md'));
  } catch {
    console.log('没有找到活动目录，跳过迁移');
    return;
  }

  if (files.length === 0) {
    console.log('活动目录为空，跳过迁移');
    return;
  }

  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  for (const file of files) {
    const id = basename(file, '.md');
    const raw = await readFile(join(ACTIVITY_DIR, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);

    const existing = await sql('SELECT id FROM activities WHERE id = ?', [id]);
    if (existing.length > 0) {
      console.log(`  跳过（已存在）: ${id}`);
      skipped++;
      continue;
    }

    const tags = Array.isArray(data.tags) ? data.tags.join(',') : data.tags || '';
    const eventDate = String(data.date || '').slice(0, 10) || '1970-01-01';

    await sql(
      `INSERT INTO activities (id, title, summary, body, location, event_date, tags, cover, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', 'published', ?, ?)`,
      [
        id,
        data.title || id,
        data.summary || '',
        body,
        data.location || '',
        eventDate,
        tags,
        now,
        now,
      ],
    );
    console.log(`  已迁移: ${id}  (${eventDate})`);
    inserted++;
  }

  console.log(`活动迁移完成：新增 ${inserted}，跳过 ${skipped}`);
}

// ── 创建初始管理员 ───────────────────────────────────────────
async function seedAdmin() {
  if (!SEED_PASSWORD) {
    console.log('\n未提供 SEED_PASSWORD，跳过管理员创建');
    return;
  }

  const rows = await sql('SELECT username FROM admin_users WHERE username = ?', [SEED_USER]);
  if (rows.length > 0) {
    console.log(`\n管理员 ${SEED_USER} 已存在，跳过`);
    return;
  }

  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await deriveHash(SEED_PASSWORD, salt, ITERATIONS);
  const now = Date.now();

  await sql(
    `INSERT INTO admin_users (username, password_hash, password_salt, iterations, created_at, updated_at, password_changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [SEED_USER, hash, salt, ITERATIONS, now, now, now],
  );
  console.log(`\n已创建管理员账号: ${SEED_USER}`);
}

// ── 主流程 ─────────────────────────────────────────────────
console.log('=== 迁移活动 ===');
await migrateActivities();
await seedAdmin();

console.log('\n=== 当前数据量 ===');
for (const t of ['activities', 'posts', 'images', 'admin_users']) {
  const rows = await sql(`SELECT COUNT(*) AS n FROM ${t}`);
  console.log(`  ${t}: ${rows[0]?.n ?? 0}`);
}
