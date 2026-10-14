// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 主站域名。EdgeOne Pages 上线后改成 EdgeOne 分配的地址。
  // Cloudflare 那份保留作备份，两者内容完全一致。
  site: 'https://g2333.eivi.workers.dev',
  // 目录式路由统一带尾斜杠，避免每次内链跳转多一次 307
  trailingSlash: 'always',
});
