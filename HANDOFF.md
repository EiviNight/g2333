# G2333 动漫社网站 · 项目交接说明

## 项目定位

社团官网。对外三块内容：**首页、社团活动、作品展示**（另有文章与招新页）。
内容由管理员在后台维护，发布后立刻在线上可见，不需要重新部署。

受众主要是**中国大陆**的社团成员，所以主站选在 Cloudflare Pages（`pages.dev` 国内直连可用）。

## 仓库与线上地址

| 项 | 值 |
|---|---|
| GitHub 仓库 | https://github.com/EiviNight/g2333 |
| 生产分支 | `main` |
| 主站 | **https://g2333.pages.dev** ← 国内直连可用 |
| 管理后台 | https://g2333.pages.dev/admin/ （不在导航中，公开页面无链接） |

**推送到 `main` 会自动构建部署**，等 1–2 分钟即上线。
站点是静态的，但**内容改动不需要重新部署**（见下方数据流）。

## 架构总览

```
访客浏览器
   │  GET /api/activities, /api/posts, /api/images   ← 列表
   │  GET /api/<kind>/<id>                            ← 详情（含渲染好的 body_html）
   ▼
Cloudflare Pages Functions（functions/ 目录，服务端）
   ├─ D1 数据库：activities / posts / images / admin_users
   └─ R2 桶：作品图片文件

管理员浏览器 ( /admin/ )
   │  登录拿会话 cookie → 增删改各类内容
   ▼
同一套 Functions（校验会话后才允许写）
```

**关键点：静态构建 + 运行时取数据。**
页面本身是构建时产出的静态 HTML，内容在浏览器里通过 API 异步加载。
这样管理员发一条活动，访客刷新就能看到，不必等下一次部署。

## 目录结构

```
functions/                        ← Pages Functions（后端）
  _auth.js                        会话签名、cookie、绑定名解析
  _admins.js                      口令哈希（PBKDF2）与管理员账号读写
  _content.js                     activities / posts 共用的校验与 CRUD
  api/login.js        POST  登录
  api/logout.js       POST  退出
  api/session.js      GET   当前登录态
  api/password.js     POST  改自己的口令（需验旧口令）
  api/admins.js       GET/POST   管理员列表 / 新建
  api/admins/[username].js  DELETE 删除管理员
  api/activities.js   GET/POST   活动列表 / 新建
  api/activities/[id].js  GET/PATCH/DELETE  活动详情 / 编辑 / 删除
  api/posts.js        GET/POST   文章列表 / 新建
  api/posts/[id].js   GET/PATCH/DELETE  文章详情 / 编辑 / 删除
  api/images.js       GET/POST   作品列表 / 上传
  api/images/[id].js  PATCH/DELETE  改状态 / 删除
  api/file/[key].js   GET   从 R2 读出图片
src/
  config.ts                       站点配置（站名/介绍/联系方式/导航）
  lib/client.ts                   浏览器端共享工具（请求、渲染列表与网格）
  components/ContentDetail.astro  活动/文章共用的详情页组件
  layouts/BaseLayout.astro        全局布局 + 全站样式（CSS 变量）
  pages/index.astro               首页
  pages/activities/               社团活动（列表 index + 详情 detail）
  pages/blog/                     文章（列表 index + 详情 detail）
  pages/gallery.astro             作品展示
  pages/join.astro                招新页
  pages/admin.astro               管理后台（四个标签页）
  pages/404.astro                 自定义 404
public/gallery/*.svg              画廊常设占位图
schema.sql                        数据库结构（可重复执行）
scripts/seed.mjs                  数据初始化（迁移旧 Markdown + 建管理员）
wrangler.jsonc                    Wrangler 本地开发配置
edgeone.json                      EdgeOne 部署配置（备用平台）
```

## 数据库表

| 表 | 用途 | 关键字段 |
|---|---|---|
| `activities` | 社团活动 | `id`(网址片段) `title` `summary` `body`(Markdown) `location` `event_date` `tags` `status` |
| `posts` | 文章 | `id` `title` `summary` `body`(Markdown) `author` `tags` `status` |
| `images` | 作品图片元数据 | `id`(=R2 对象名) `title` `author` `status` `sort_order` |
| `admin_users` | 管理员账号 | `username` `password_hash` `password_salt` `iterations` |

`status` 的取值：`activities`/`posts` 是 `draft` / `published`；`images` 是 `pending` / `approved` / `hidden`。

## 环境变量与绑定（Cloudflare Pages 项目 Settings 里配）

| 名称 | 类型 | 说明 |
|---|---|---|
| `SESSION_SECRET` | secret | 会话 cookie 签名密钥。换了所有人会被登出 |
| `ADMIN_USER` / `ADMIN_PASSWORD` | secret | **仅作首次兜底**：`admin_users` 表为空时才能用来登录。正常登录走库里的哈希 |
| `GALLERY_BUCKET` | R2 绑定 | 指向 `g2333-gallery` |
| `DB` | D1 绑定 | 指向 `g2333-db` |

生成 `SESSION_SECRET`：
```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**绑定名容错**：`functions/_auth.js` 里的 `bucketOf()` / `dbOf()` 兼容多种写法
（`DB`、`g2333-db`、`g2333_db` 都认）。新增绑定名要同步加进那两个数组。

**改环境变量后必须触发一次全新构建**，点「Retry deployment」不生效（它复用原构建配置）。

## 开发与部署

```bash
npm install
npm run dev                     # 只跑 Astro 前端，不含 Functions
npm run build                   # 构建到 dist/
npx wrangler pages dev dist     # 本地跑完整环境（Functions + D1 + R2）
```

改完 push 即自动部署。

应用数据库结构：
```bash
npx wrangler d1 execute g2333-db --remote --file=./schema.sql
```

## 必须遵守的约定

1. **前端是纯静态构建**（`output: 'static'`）。需要动态能力就写 `functions/` 下的 Function。
   **不要**给页面加 `prerender = false`——它要求装适配器把整站变 SSR，当前架构没走那条路。
2. **不用 `/activities/<slug>/` 这种干净路径**。Astro 无法为数据库内容生成静态路由，
   所以详情页是 `/activities/detail/?id=<id>`。原因见 `components/ContentDetail.astro` 顶部注释。
3. **单条内容的 id 从 URL 末段兜底解析**（`_content.js` 的 `resolveId`）。
   Pages Functions 的 `params.id` 在某些情况下为空，只信它会查不到记录。
4. **PBKDF2 迭代次数最高 100000**。Workers 的 WebCrypto 拒绝更高，
   填 210000 会让登录直接报 "iteration counts above 100000 are not supported"。
5. **内链必须带尾斜杠**（`/activities/`、`/gallery/`）。`astro.config.mjs` 设了 `trailingSlash: 'always'`。
6. **界面文案用简体中文**。样式走 `BaseLayout.astro` 里的 CSS 变量，别写死颜色。
7. 保持移动端适配与现有深色主题。

## 安全须知

- **绝不把凭据写进代码或提交进仓库。** `.env` 已在 `.gitignore` 里，仓库是公开的，
  任何密钥推上去就算泄露。编辑类脚本一律从环境变量读凭据。
- **GitHub 的 Push Protection 会拦截含密钥的推送。** 如果被拦，说明确实写进去了，
  应撤回提交并从历史中移除后再推送。
- 账号的 **Global API Key 权限等同于账号主密钥**（能改 DNS、账单、所有项目）。
  能不用就不用；要用请建最小权限的 API Token，用完即删。
- 口令与会话密钥只在 Cloudflare 后台填写，不要经过第三方工具或聊天记录。

## 当前状态与待办

**已完成**：首页、社团活动（列表+详情）、文章（列表+详情）、作品展示、
招新页、自定义 404、管理员登录、活动/文章/作品的后台增删改、管理员自助改口令。

**占位内容，需要替换**：
- `src/config.ts` 里的联系方式是假的（`qq: '123456789'`、`email: 'hello@example.com'`、B 站链接全 0）
- `public/gallery/` 里 12 张是脚本生成的占位 SVG
- 活动正文是迁移进来的真实内容，可保留或改写

**可以做的方向**：
- 首页视觉升级（当前偏朴素）
- 画廊加灯箱 / 大图预览
- 作品分类筛选
- 给 R2 配公开域名，填 `R2_PUBLIC_BASE` 环境变量，图片就不再经过 Function
- 招新表单接后端（照 `api/posts.js` 写一个 `api/join.js` 存进 D1 即可）
- 内容改动目前靠 push 部署；如果要更快的预览，可以配 Preview 环境
