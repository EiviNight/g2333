// GET /api/file/[key]   把 R2 里的图片发出去
//
// 为什么需要它：R2 桶默认不公开，不配自定义域的话外部访问不到。
// 走这里读，好处是「不用配任何 R2 公开域名就能直接用」。
// 如果你以后在 R2 配了公开域名，把它填进环境变量 R2_PUBLIC_BASE，
// 前端就会直接指向那个域名，图片不再经过本 Function（更快、不耗请求额度）。
import { json } from '../../_auth.js';

const TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function onRequestGet({ env, params }) {
  if (!env.GALLERY_BUCKET) return json({ ok: false, error: 'R2 未绑定' }, 500);

  const key = params.key;
  // 只允许「时间戳-随机串.扩展名」这种形式，挡住 ../ 之类的路径穿越
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(key)) {
    return new Response('Bad request', { status: 400 });
  }

  const object = await env.GALLERY_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop().toLowerCase();
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || TYPES[ext] || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);
  if (object.size != null) headers.set('Content-Length', String(object.size));

  // 图片内容不会变（文件名单调递增且带随机串），可以用强缓存 + 条件请求
  return new Response(object.body, { headers });
}
