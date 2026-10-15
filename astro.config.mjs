// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 主站域名（Cloudflare Pages 项目 g2333）
  site: 'https://g2333.pages.dev',
  // 目录式路由统一带尾斜杠，避免每次内链跳转多一次 307
  trailingSlash: 'always',
});
