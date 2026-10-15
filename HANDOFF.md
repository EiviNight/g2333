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
  gallery/*.svg                 ← 常设作品占位图（12 张，脚本生成，待替换）
scripts/generate-gallery.mjs    ← 生成占位图的脚本
functions/                      ← Cloudflare Pages Functions（API 后端）
  _auth.js                      ← 会话签名、口令校验、绑定名解析
  api/login.js    POST /api/login       登录
  api/logout.js   POST /api/logout      退出
  api/session.js  GET  /api/session     查询登录态
  api/images.js   GET/POST /api/images  列表 / 上传
  api/images/[id].js  PATCH/DELETE      改状态 / 删除
  api/file/[key].js   GET /api/file/:key 从 R2 读图
schema.sql                      ← D1 的 images 表定义
edgeone.json                    ← EdgeOne Pages 部署配置（备用平台）
wrangler.jsonc                  ← Cloudflare Workers 部署配置（备用站）
```

## 后端架构（上传功能）

```
管理员浏览器 ( /admin/ )
   │  POST /api/images  + 会话 cookie
   ▼
Pages Function（服务端）——校验会话、校验类型大小
   ├─ 图片本体 → R2 桶 g2333-gallery
   └─ 元数据   → D1 数据库 g2333-db（images 表）

访客浏览器 ( /gallery/ )
   │  GET /api/images  → 只返回 status='approved'
   └─ 图片 → /api/file/:key → 从 R2 读
```

**关键设计**：图片不存数据库。R2 存文件，D1 只存"哪张图叫什么"。
不要把图片写进 D1，免费版只有 5GB，会立刻爆。

## 环境变量与绑定（在 Cloudflare Pages 项目里配）

| 名称 | 类型 | 说明 |
|---|---|---|
| `ADMIN_USER` | secret | 管理员用户名 |
| `ADMIN_PASSWORD` | secret | 登录口令 |
| `SESSION_SECRET` | secret | 会话签名密钥，换了会让所有人登出 |
| `GALLERY_BUCKET` | R2 绑定 | 指向 `g2333-gallery` |
| `DB` | D1 绑定 | 指向 `g2333-db` |

> 生成 `SESSION_SECRET`：
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

**绑定名注意**：`functions/_auth.js` 里的 `bucketOf()` / `dbOf()` 兼容多种写法
（`DB`、`g2333-db`、`g2333_db` 都认）。改绑定名不会立刻坏掉，但新增名字要同步加进那里。

## 管理员后台

网址：`https://g2333.pages.dev/admin/`

- **不在导航里**，公开页面没有任何指向它的链接
- 未登录只能看到登录框；上传、改状态、删除的 API 都会返回 401
- 真正的权限判断在 Function 里，前端隐藏只是减少干扰，不是安全边界
- 上传时可勾选「立刻在画廊显示」；不勾则为待审状态，在后台可随时切换

## 开发命令

```bash
npm install         # 安装依赖
npm run dev         # 前端本地开发，http://localhost:4321
npm run build       # 构建到 dist/
npm run preview     # 预览构建产物
npx wrangler pages dev dist   # 本地跑 Functions + R2 + D1 的完整环境
```

> **注意**：`npm run dev` 只跑 Astro，**不包含 Pages Functions**。
> 要测上传/登录这类接口，用 `npx wrangler pages dev dist`。

## 必须遵守的约定

1. **前端是纯静态**（`output: 'static'`），不要引入需要 SSR 的功能。需要动态能力就写 `functions/` 下的 Function。
2. **内链必须带尾斜杠**，如 `/activities/`、`/gallery/`。`astro.config.mjs` 里设了 `trailingSlash: 'always'`，不遵守会导致每次跳转多一次 307 重定向。
3. **界面文案用简体中文**。
4. 活动内容是 **Markdown 驱动**的（`src/content/activities/`），面向非技术成员，保持这个设计。
5. 样式用 `BaseLayout.astro` 里的 **CSS 变量**（`--bg` `--card` `--accent` 等）统一控制主题，别写死颜色。
6. 保持**移动端适配**和现有**深色主题**风格。
7. 主站域名是 `https://g2333.pages.dev`，`astro.config.mjs` 的 `site` 与它一致。
8. **报名表单目前只有前端、没有后端**，提交时会明确提示用户改用邮件/QQ。不要改成假装提交成功。

## 安全须知

- **绝不把凭据写进代码或提交进仓库**。`.env` 已在 `.gitignore` 里，但仓库是公开的，
  任何密钥一旦推上去就算泄露。Cloudflare 编辑脚本请从环境变量读凭据。
- 账号的 **Global API Key 权限等同于账号主密钥**，能改 DNS、账单、所有项目。
  能不用就不用；要用请用最小权限的 API Token，用完即删。
- 口令与会话密钥只在 Cloudflare 后台填写，不要经过第三方工具或聊天记录。

## 当前状态与待办

**已完成**：全局布局与样式、首页、活动列表 + 详情、画廊、报名页、自定义 404、
管理员登录上传（R2 + D1）、作品显示/隐藏/删除、自定义 404。

**占位内容，需要替换**：
- `src/config.ts` 里的联系方式是假的（`qq: '123456789'`、`email: 'hello@example.com'`、B 站链接是全 0）
- `public/gallery/` 里 12 张是脚本生成的占位 SVG，要换成真实作品
- `src/content/activities/` 里 3 篇是示例文章

**可以做的方向**：
- 首页视觉升级（当前比较朴素）
- 画廊加灯箱/大图预览
- 作品卡片加分类筛选
- 加成员介绍页 / 社刊展示页
- 报名表单接后端（写个 `functions/api/join.js` 存进 D1 即可）
- 给 R2 配公开域名，把 `R2_PUBLIC_BASE` 环境变量填上，图片就不再经过 Function（更快）

