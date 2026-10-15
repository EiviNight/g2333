// 口令哈希与管理员账号读写。
//
// 为什么用 PBKDF2 而不是直接存口令：数据库一旦泄漏，明文口令等于全丢。
// PBKDF2-SHA256 是 WebCrypto 原生支持的，不需要额外依赖。
//
// 迭代次数为什么是 100000 而不是常见的 210000：
// Cloudflare Workers 的 WebCrypto 实现拒绝超过 100000 轮的 PBKDF2
// （报 "iteration counts above 100000 are not supported"）。
// 100000 是运行时允许的上限，在 Workers 上约几十毫秒，够用。
//
// 为什么账号存数据库而不是环境变量：后台要支持自助改口令，
// 而运行时的 Function 只能读环境变量、不能写。

import { dbOf, timingSafeEqual } from './_auth.js';

const ITERATIONS = 100000;

const HASH = 'SHA-256';
const KEY_LEN = 32;

const enc = new TextEncoder();

function toB64(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** 生成新盐 */
export function makeSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

/** 用给定盐和迭代次数派生口令哈希 */
export async function deriveHash(password, saltB64, iterations = ITERATIONS) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: HASH },
    baseKey,
    KEY_LEN * 8,
  );
  return toB64(bits);
}

/** 生成可直接入库的一整套字段 */
export async function makePasswordRecord(password) {
  const salt = makeSalt();
  const hash = await deriveHash(password, salt, ITERATIONS);
  return { password_hash: hash, password_salt: salt, iterations: ITERATIONS };
}

/** 校验口令，返回是否匹配 */
export async function verifyPassword(password, row) {
  if (!row || !row.password_hash || !row.password_salt) return false;
  const iterations = Number(row.iterations) || ITERATIONS;
  const hash = await deriveHash(password, row.password_salt, iterations);
  return timingSafeEqual(hash, row.password_hash);
}

/** 读一个管理员账号 */
export async function findAdmin(env, username) {
  const db = dbOf(env);
  if (!db) return null;
  return db
    .prepare('SELECT * FROM admin_users WHERE username = ?')
    .bind(String(username || '').trim())
    .first();
}

/** 列出所有管理员（不含哈希） */
export async function listAdmins(env) {
  const db = dbOf(env);
  if (!db) return [];
  const { results } = await db
    .prepare(
      'SELECT username, created_at, updated_at, password_changed_at FROM admin_users ORDER BY created_at ASC',
    )
    .all();
  return results;
}

/** 管理员账号总数，用于判断是否还没有任何账号 */
export async function adminCount(env) {
  const db = dbOf(env);
  if (!db) return 0;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
  return row ? Number(row.n) : 0;
}

/** 新建管理员 */
export async function createAdmin(env, username, password) {
  const db = dbOf(env);
  const rec = await makePasswordRecord(password);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO admin_users (username, password_hash, password_salt, iterations, created_at, updated_at, password_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(username, rec.password_hash, rec.password_salt, rec.iterations, now, now, now)
    .run();
}

/** 改口令 */
export async function setAdminPassword(env, username, password) {
  const db = dbOf(env);
  const rec = await makePasswordRecord(password);
  const now = Date.now();
  const r = await db
    .prepare(
      `UPDATE admin_users
         SET password_hash = ?, password_salt = ?, iterations = ?, updated_at = ?, password_changed_at = ?
       WHERE username = ?`,
    )
    .bind(rec.password_hash, rec.password_salt, rec.iterations, now, now, username)
    .run();
  return r.success !== false;
}

/** 删除管理员 */
export async function deleteAdmin(env, username) {
  const db = dbOf(env);
  await db.prepare('DELETE FROM admin_users WHERE username = ?').bind(username).run();
}
