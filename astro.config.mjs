// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://g2333.eivi.workers.dev',
  // 目录式路由统一带尾斜杠，避免 Cloudflare 对每个内链多发一次 307
  trailingSlash: 'always',
});
