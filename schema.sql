-- G2333 动漫社网站 · 作品表
--
-- 应用方式：
--   本地：wrangler d1 execute g2333-db --local  --file=./schema.sql
--   线上：wrangler d1 execute g2333-db --remote --file=./schema.sql
--
-- 图片文件本身存在 R2 桶（g2333-gallery）里，这张表只存「哪张图叫什么」。

CREATE TABLE IF NOT EXISTS images (
  -- R2 里的对象名，形如 1745000000-a1b2c3d4.jpg
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,

  -- pending = 待审（上传时没勾选「立刻显示」）
  -- approved = 在画廊显示
  -- hidden   = 暂时隐藏，文件保留
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'approved', 'hidden'))
);

-- 画廊列表按时间倒序取，且只取 approved，这个索引覆盖住主要查询
CREATE INDEX IF NOT EXISTS idx_images_status_created
  ON images (status, created_at DESC);
