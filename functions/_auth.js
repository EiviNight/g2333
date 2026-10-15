// 会话与口令校验工具。
// 环境变量（在 Pages 项目 Settings -> Environment variables 里配，全部设为加密）：
//   ADMIN_USER       管理员用户名
//   ADMIN_PASSWORD   管理员口令
//   SESSION_SECRET   用于签名会话 cookie 的随机串，越长越好

const COOKIE_NAME = 'g2333_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

const encoder = new TextEncoder();

function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(payload, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return b64url(sig);
}

/** 定时安全比较，避免通过响应时间猜出口令 */
export function timingSafeEqual(a, b) {
  const ab = encoder.encode(String(a));
  const bb = encoder.encode(String(b));
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** 生成会话 token：base64url(payload).signature */
export async function createSession(user, secret) {
  const payload = JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL_MS });
  const body = b64url(encoder.encode(payload));
  const sig = await sign(body, secret);
  return `${body}.${sig}`;
}

/** 校验会话 token，返回用户名或 null */
export async function verifySession(token, secret) {
  if (typeof token !== 'string') return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;

  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = await sign(body, secret);
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return typeof payload.u === 'string' ? payload.u : null;
  } catch {
    return null;
  }
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookie(token, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  // httpOnly 防 XSS 读取；SameSite=Lax 够用且不影响正常跳转；生产环境强制 Secure
  const secure = 'Secure';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secure}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * 取当前登录用户。
 * 配置缺失时抛错，由调用方转成 500 —— 避免「没配环境变量就等于放行」。
 */
export async function requireUser(request, env) {
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET 未配置');
  }
  const token = readCookie(request);
  return verifySession(token, env.SESSION_SECRET);
}

/** 校验登录表单凭据 */
export function checkCredentials(env, username, password) {
  const expectUser = env.ADMIN_USER || 'admin';
  if (!env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD 未配置');
  }
  const okUser = timingSafeEqual(username || '', expectUser);
  const okPass = timingSafeEqual(password || '', env.ADMIN_PASSWORD);
  return okUser && okPass;
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

// ── 绑定名解析 ────────────────────────────────────────────────
// Cloudflare 的绑定名由创建时决定，大小写敏感。这里两种常见写法都认，
// 免得 dashboard 里填成 g2333_db 而代码找 DB，结果整个功能卡住。
// 优先用官方文档风格的大写名。

const BUCKET_NAMES = [
  'GALLERY_BUCKET',
  'g2333_gallery',
  'g2333-gallery',
  'GALLERY',
  'BUCKET',
];
const DB_NAMES = ['DB', 'g2333_db', 'g2333-db', 'DATABASE'];

/** 取 R2 桶绑定，没有则返回 null */
export function bucketOf(env) {
  for (const name of BUCKET_NAMES) {
    if (env[name]) return env[name];
  }
  return null;
}

/** 取 D1 绑定，没有则返回 null */
export function dbOf(env) {
  for (const name of DB_NAMES) {
    if (env[name]) return env[name];
  }
  return null;
}
