# G2333 动漫社网站 · 项目交接说明

## 项目定位

社团官网，纯展示型静态站。受众是社团成员和要招新的同学，主要在**中国大陆**访问。

## 仓库与线上地址

| 项 | 值 |
|---|---|
| GitHub 仓库 | https://github.com/EiviNight/g2333 |
| 生产分支 | `main` |
| 主站（线上） | **https://g2333.pages.dev** ← 国内直连可用，不要动 |
| 备用站 | https://g2333.eivi.workers.dev （需代理，仅作容灾） |

**推送到 `main` 会自动构建部署**，覆盖 Cloudflare Pages 和 Workers 两份。改完 push 等 1–2 分钟即上线。

## 技术栈

- **Astro 7.3.8**（`astro ^7.3.8`），`output: 'static'` 纯静态，**没有任何 SSR / 后端**
- Node ≥ 22.12.0
- 依赖只有 Astro 一个，没有 UI 框架（没有 React/Vue/Tailwind），样式全是**原生 CSS + CSS 变量**
- 包管理 npm，锁文件 `package-lock.json` 已提交

## 目录结构

```
src/
  config.ts                     ← 站点全局配置（站名/介绍/联系方式/导航），改这里就能改全站
  content.config.ts             ← 活动内容集合的 schema 定义
  content/activities/*.md       ← 活动回顾文章，一篇文章一个 .md
  layouts/BaseLayout.astro      ← 全局布局：<head>、导航、页脚、全站样式
  pages/
    index.astro                 ← 首页
    activities/index.astro      ← 活动列表
    activities/[slug].astro     ← 活动详情（动态路由，由 md 生成）
    gallery.astro               ← 画廊
    join.astro                  ← 报名页（含表单）
    404.astro                   ← 自定义 404
public/
  favicon.svg, favicon.ico
  gallery/*.svg                 ← 画廊占位图（12 张，脚本生成，待替换为真作品）
scripts/generate-gallery.mjs    ← 生成占位图的脚本
edgeone.json                    ← EdgeOne Pages 部署配置（备用平台）
wrangler.jsonc                  ← Cloudflare Workers 部署配置（备用站）
```

## 开发命令

```bash
npm install         # 安装依赖
npm run dev         # 本地开发，http://localhost:4321
npm run build       # 构建到 dist/，部署前验证用
npm run preview     # 预览构建产物
```

## 必须遵守的约定

1. **纯静态站**。不要引入需要服务端运行时（SSR）的功能。报名表单目前是**只有前端、没有后端**的，提交时会明确提示用户改用邮件/QQ，**不要让它假装提交成功**。
2. **内链必须带尾斜杠**，如 `/activities/`、`/gallery/`。`astro.config.mjs` 里设了 `trailingSlash: 'always'`，不遵守会导致每次跳转多一次 307 重定向。
3. **界面文案用简体中文**。
4. 活动内容是 **Markdown 驱动**的（`src/content/activities/`），面向非技术成员，保持这个设计。
5. 样式用 `BaseLayout.astro` 里的 **CSS 变量**（`--bg` `--card` `--accent` 等）统一控制主题，别写死颜色。
6. 保持**移动端适配**和现有**深色主题**风格。
7. 改 `site` 相关配置前先确认，主站域名是 `https://g2333.pages.dev`。

## 当前状态与待办

**已完成**：全局布局与样式、首页、活动列表 + 详情、画廊（12 张占位图）、报名页、自定义 404。

**占位内容，需要替换**：
- `src/config.ts` 里的联系方式是假的（`qq: '123456789'`、`email: 'hello@example.com'`、B 站链接是全 0）
- `public/gallery/` 里 12 张是脚本生成的占位 SVG，要换成真实作品
- `src/content/activities/` 里 3 篇是示例文章

**可以做的方向**：
- 首页视觉升级（当前比较朴素）
- 画廊加灯箱/大图预览
- 报名表单接后端（Cloudflare D1 或第三方表单服务）
- 作品卡片加作者署名、分类筛选
- 加成员介绍页 / 社刊展示页
