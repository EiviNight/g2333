-- G2333 动漫社网站 · 数据库结构
--
-- 应用方式：
--   线上：npx wrangler d1 execute g2333-db --remote --file=./schema.sql
--   本地：npx wrangler d1 execute g2333-db --local  --file=./schema.sql
--
-- 本文件可重复执行（全部 IF NOT EXISTS）。

-- ── 管理员账号 ──────────────────────────────────────────────
-- 口令以 PBKDF2-SHA256 加盐哈希存储，不存明文。
-- 后台可以自助改口令，所以账号必须落在数据库里（环境变量运行时改不了）。
-- iterations 用 100000：Workers 的 WebCrypto 拒绝更高的轮数，
-- 填 210000 会让登录直接报 "iteration counts above 100000 are not supported"。
CREATE TABLE IF NOT EXISTS admin_users (
  username            TEXT PRIMARY KEY,
  password_hash       TEXT NOT NULL,   -- base64
  password_salt       TEXT NOT NULL,   -- base64
  iterations          INTEGER NOT NULL DEFAULT 100000,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  password_changed_at INTEGER
);

-- ── 作品（图片文件存 R2，这里只存元数据）────────────────────────
CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,           -- R2 对象名，形如 1745000000-a1b2c3d4.jpg
  title      TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'hidden')),
  sort_order INTEGER NOT NULL DEFAULT 0  -- 越大越靠前，同值时按时间倒序
);

CREATE INDEX IF NOT EXISTS idx_images_status
  ON images (status, sort_order DESC, created_at DESC);

-- ── 社团活动 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id         TEXT PRIMARY KEY,           -- 网址片段，如 2026-spring-camp
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',   -- Markdown 正文
  location   TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,              -- YYYY-MM-DD
  tags       TEXT NOT NULL DEFAULT '',   -- 逗号分隔
  cover      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'published'
             CHECK (status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_status_date
  ON activities (status, event_date DESC);

-- ── 文章 / 随笔 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY,           -- 网址片段，如 2026-autumn-notes
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',   -- Markdown 正文
  author     TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '',
  cover      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'published'
             CHECK (status IN ('draft', 'published')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status_created
  ON posts (status, created_at DESC);
