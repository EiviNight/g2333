# 管理后台速查

给接手维护的 AI 或同学看的快速参考。架构与约定见 [HANDOFF.md](./HANDOFF.md)。

## 线上地址

| 用途 | 地址 |
|---|---|
| 主站 | https://g2333.pages.dev |
| **管理后台** | **https://g2333.pages.dev/admin/** |
| 社团活动 | https://g2333.pages.dev/activities/ |
| 文章 | https://g2333.pages.dev/blog/ |
| 作品展示 | https://g2333.pages.dev/gallery/ |

**后台不在导航里**，公开页面没有任何指向它的链接。直接访问上面那个 `/admin/` 网址即可。

## 管理员账号

```
用户名：eivi
口令：0d000721ciallo
```

**口令可以改**：登录后台 → 「账号与口令」标签页 → 填当前口令和新口令。
改了之后旧口令立即失效，且当前会话会被强制登出，需要用新口令重新登录。

**这个口令也同时存在于以下两处**（都是本地文件，不会进仓库）：
- 仓库根目录的 `.env`
- Cloudflare Pages 的环境变量 `ADMIN_PASSWORD`（仅作首次兜底，正常登录走数据库里的哈希）

## Cloudflare 资源标识

| 资源 | 值 |
|---|---|
| Pages 项目名 | `g2333` |
| Account ID | `4e686a896fee598af2f2228029d68764` |
| D1 数据库 | `g2333-db` / `be27e3de-6338-4ff6-aeeb-a1d7cef55dea` |
| R2 桶 | `g2333-gallery` |

## 数据库里有 4 张表

| 表 | 存什么 | 谁在用 |
|---|---|---|
| `activities` | 社团活动（含 Markdown 正文） | 后台「活动」标签页 |
| `posts` | 文章 | 后台「文章」标签页 |
| `images` | 作品图片的元数据（文件本体在 R2） | 后台「作品」标签页 |
| `admin_users` | 管理员账号（PBKDF2 哈希，不存明文） | 后台「账号与口令」标签页 |

## 后台四个标签页能做什么

| 标签页 | 功能 |
|---|---|
| 作品 | 上传图片、切换显示/隐藏、删除 |
| 活动 | 发布/编辑/删除活动（标题、日期、地点、标签、Markdown 正文） |
| 文章 | 写/编辑/删除文章（标题、作者、Markdown 正文） |
| 账号与口令 | 改自己的口令、创建/删除管理员 |

**内容发布后立刻可见**，不需要重新部署——刷新页面就有。

## 改代码后怎么上线

```bash
git add -A
git commit -m "说明"
git push          # 推上去后 Cloudflare 自动构建，等 1-2 分钟
```

**如果 push 报 `Could not connect to server`**：说明用了代理配置但 Clash 没开。两个办法：

- 重启 Clash（推荐）
- 或者临时绕过代理：`git -c http.https://github.com.proxy= -c https.https://github.com.proxy= push`

**改了环境变量或绑定后，必须触发一次全新构建**——在 Cloudflare 后台点「Retry deployment」**不生效**，要重新 push 或新建部署。

## 本地开发

```bash
npm install
npm run dev                     # 只跑前端，不含后端接口
npx wrangler pages dev dist     # 完整环境（含 Functions + D1 + R2），测上传/登录要用这个
```

## 几个容易踩的坑

1. **站点是纯静态构建**。别给页面加 `prerender = false`，那需要装适配器把整站变 SSR，当前架构没走那条路。
2. **详情页是 `?id=` 查询参数**，不是 `/activities/<slug>/`。原因见 `src/components/ContentDetail.astro` 顶部注释。
3. **PBKDF2 迭代最高 100000**。Workers 的 WebCrypto 拒绝更高，改高会让登录直接报错。
4. **不要提交密钥**。仓库是公开的，GitHub 的密钥扫描会拦，但别指望它兜底。`.env` 已被 `.gitignore` 忽略。
