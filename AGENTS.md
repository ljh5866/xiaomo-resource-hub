# 小莫资源网 · 长期记忆（AGENTS.md）

> DSH 每个新会话会自动加载本文件。这里只放**长期有效的事实与约定**；逐轮流水与临时状态见
> [`docs/27-会话记忆与当前状态.md`](docs/27-会话记忆与当前状态.md)。
> 最近一轮复盘：2026-11-06，来源会话 `session-0785f68a`（178 轮，4 次上下文压缩）。

## 1. 项目是什么

**小莫资源网**（XiaoMo Resource Hub）— 资源下载索引站，Next.js 全栈单体，自建服务器部署。
仓库 `github.com/ljh5866/xiaomo-resource-hub`（**public**，所以仓库内不写任何密钥）。
四个分类：软件工具 `software`、热门游戏 `games`、游戏 MODS `mods`、GitHub 开源项目 `opensource`。

## 2. 线上环境

| 项 | 值 |
|---|---|
| 前台 | `https://ttals.com` |
| 后台 | `https://admin.ttals.com`（子域名，Caddy 自动 HTTPS） |
| 服务器 | 阿里云香港轻量 2C2G，Ubuntu 24.04，公网 `43.103.48.5`，登录用户 `admin` |
| 应用目录 | `/var/www/xiaomo`，systemd 服务 `xiaomo`（`www-data`，仅监听 127.0.0.1:3100） |
| 健康检查 | `GET /api/health` → `{ok,app,time,db:{published},smtp,uptimeSec,memoryMB}` |
| 密钥 | 全部在服务器 `/var/www/xiaomo/.env`（SMTP 授权码、GitHub OAuth secret、AUTH_SECRET） |

**我没有 SSH 权限**：所有服务器命令由用户在自己的终端执行，我只给出可复制的命令块与预期输出。
用户机器是 Windows 11 + PowerShell 5.1。

## 3. 技术栈与硬约束（别动这些）

- Next.js **16.4.4** App Router + React 19 + TS 5.9.3 + Tailwind **v4**（`@theme inline` 令牌）；图标 `lucide-react`，禁 emoji。
- 运行时数据库 = **`node:sqlite` 的 `DatabaseSync`**，不是 better-sqlite3（后者在 Node 24 上直接崩）。
  better-sqlite3 / drizzle-kit 只用于迁移与脚本。
- 迁移 = `src/db/sql/NNN_*.sql` + `scripts/migrate.mjs`（按 `;` 切分前先剥注释）。
  **禁止 `drizzle-kit push`**：它会 DROP 掉 FTS5 影子表。
- 搜索 = SQLite FTS5 + 纯 JS 中文 2-gram 分词，bm25 权重 8:1，无结果回退 LIKE。
- 鉴权 = NextAuth v5 beta.32 Credentials；密码 `scrypt$N$salt$hash`，兼容 Supabase 迁入的 bcrypt
  （`$2a/$2b/$2y`），登录成功自动升级为 scrypt；`users.token_version` 做会话吊销；`users.status` = active/pending/banned。
- 邮箱验证码 = 6 位，`sha256(code+AUTH_SECRET)` 落库，10 分钟过期，60s 冷却，单次消费；用途 `register`/`login`。
- 登录凭证双通道：密码 or 邮箱验证码（同一个 Credentials provider，参数 `{email,password,code}`）。
- 路由分组：`src/app/(front)/*` 带前台 Header/Footer；`src/app/admin/*` 是整屏控制台；根 layout 只有 html/body/AuthProvider。
- 后台子域路由由 `src/lib/admin/route-map.ts` 的纯函数 `decideAdminRoute()` 决定（有单测）；
  `src/middleware.ts` 只是薄封装，matcher **排除 `api/`**（否则会覆盖登出的清 cookie）。
- `revalidatePath` 只能在 Server Action / Route Handler 里调；静态页在构建时就把 DB 状态烤进去了。
  首页 ISR = 60s，分类页 `force-dynamic`。
- 分享/封面图用 **sharp + 手写 SVG**，不用 `next/og`（Satori 需要打包 CJK 字体）。
- 图片存 `data/uploads/{covers,avatars}/`，通过 `/files/[...path]` 提供（根目录就是 `data/uploads`，**不要再拼一层 `uploads`**）。

## 4. 部署纪律（用户最在意的一条）

- **不要擅自"部署"**：我改代码 + 本地自检 → 给出一条命令 → 用户执行 → 用户回报结果。
- 用户明确说过「以后减少部署次数，要各方面自检完美，我确认后才端到部署」。
- 部署命令固定一条：

```bash
cd /var/www/xiaomo && sudo bash deploy/deploy.sh 2>&1 | tee /tmp/deploy.log | tail -25
```

- `deploy/deploy.sh` 自己做 7 件事：停服务 → `git pull` → 依赖（锁文件未变则跳过）→ 迁移 → build
  （OOM 时降 1024MB 重试）→ 重启 → 安装 `xiaomo-stars.timer`（每日 03:20 同步 star 基线 + Trending 周榜）。
  失败会自动把服务拉起来，日志在 `/tmp/deploy.log`。
- 运维账号权限：`deploy/fix-permissions.sh` 把 `admin` 加进 `www-data` 组，之后可以直接读写 `data/`
  （否则 `node scripts/xxx.mjs` 会 Permission denied，只能用 `sudo`）。
- Windows 侧：必须用 `pnpm.cmd` / `npm.cmd`（`.ps1` 被策略拦），`npx` 不可用，用
  `node node_modules\tsx\dist\cli.mjs <file>`。

## 5. 数据与内容现状（2026-11-06 实测）

- 线上已发布 **821** 条：热门游戏 449（TouchGal galgame）+ 游戏 MODS 292（BBSMC + MC百科）+ GitHub 开源 80。
- 账号 34 个（33 个从 Supabase 迁入 + 1 个管理员 `adminljh@ttals.com`）。
- 分类筛选：`/c/mods?game=minecraft`、`/c/games?genre=galgame|horror|competitive|survival|story|management|misc`、
  `/c/opensource?gh=android-app|ios-app|desktop-app|tool-lib`（端标签**互斥**，合计等于总数）、
  `/c/opensource?hot=1`（独立视图，直接展示 GitHub 官方周榜，不叠加站内筛选）。
- 内容流水线（全部在 `scripts/`，都幂等）：
  `import-touchgal.mjs`（浏览器翻页）→ `sync-touchgal-pan.mjs`（网盘链接）→ `fetch-touchgal-detail.mjs`（详情页游戏信息，本地浏览器）→
  `export-touchgal.mjs`（打 zip）→ `import-rows-json.mjs`（服务器端纯 Node 导入，浏览器无关）→ `import-touchgal-meta.mjs`（详情补丁导入）；
  `import-bbsmc.mjs`（Modrinth 中文站 API）；`mcmod-list.mjs` + `import-mcmod.mjs`（MC百科）；
  `import-github.mjs` + `sync-github-stars.mjs` + `sync-github-trending.mjs`；`translate-resources.mjs`（介绍中文化）；
  `set-game.mjs`、`set-github-end.mjs`、`check-dup.mjs`、`randomize-names.mjs`。
- **`resources.meta_json`** 存来源站结构化信息（原名/会社/发售/平台/语言/形态/别名/VNDB/Bangumi/官网），
  由 `src/lib/resource-meta.ts` 的 `parseResourceMeta` + `metaRows` 归一渲染；抓取端只写 JSON，展示端缺字段自动跳过。
- 详情页下载区**不展示 `provider='self'` 的「本站直链」**（有其它链接时隐藏，只有一条时才兜底，避免 GitHub 项目变空）。
- 数据契约：对外编号 `XM-YYYY-NNNN` 与内部 id 分离；`url_hash` 唯一；链接状态 ok/invalid/unknown/checking，
  `fail_count ≥ 3` 判 invalid；≥3 条未处理举报自动降权；IP 只存哈希。
- **一个资源只能有一条 `is_primary=1` 的链接**（列表查询用单行子查询取主链接，导入新链接前要把旧 primary 清零）。

## 6. 关键文件

`src/content/site.ts`（全部文案/导航/SEO）· `src/app/globals.css`（唯一设计令牌源，前台亮色 + `.admin-scope` 后台灰阶）
· `src/lib/queries.ts`（列表/详情 SQL）· `src/lib/seo.ts` + `src/components/seo/json-ld.tsx`
· `src/db/schema.ts` + `src/db/sql/*` · `deploy/`（deploy.sh、Caddyfile、systemd unit/timer、fix-permissions）
· `scripts/verify-all.mjs`（typecheck → 单测 → build → 临时 3101 端口 e2e → smoke → perf → 视口 → 后台审计）
· `scripts/audit-prod.mjs`（线上 36 项体检）· `docs/00`…`docs/26`（设计与实现记录）

## 7. 已经踩过的坑（别再踩）

1. `better-sqlite3` 在 Node 24 崩 → 换 `node:sqlite`。
2. `drizzle-kit push` 删 FTS5 影子表 → 只用显式 SQL 迁移。
3. 登出"没反应" → middleware 在 `/api/*` 重写 cookie；`__Secure-` 前缀必须带 `Secure` 才删得掉。
4. 头像不显示 → URL 多拼一层 `uploads`；顶部还读 JWT 旧快照，要读库。
5. 部署后样式错乱/CSS 500 → 构建时服务还在跑，`.next` 混了；deploy 会先停服务再删 `server/static`。
6. 服务器缺 `unzip` → 用 `python3 -c "import zipfile;..."`；`scp` 必须在 Windows 本机跑（服务器上会把 `D:` 当主机名）。
7. 分类页与首页计数不一致 → ISR 缓存；后台顶栏有「刷新缓存」按钮，或等 60s。
8. 资源卡片翻倍 → 一个资源多条 `is_primary=1`，列表 JOIN 乘行；查询层 + 数据层都要治。
9. `pnpm.cmd` / 非 ASCII 路径 / `node -e @"..."@` 会破坏中文和反引号 → 用 write/edit 工具或
   `@'...'@ | Out-File -Encoding UTF8 x.mjs` 写脚本再跑。

## 8. 协作偏好

- 全程**简体中文**；代码标识符/命令/日志保持原文。
- 每轮结尾给**自检表**（检查项 / 结果），不要只报"已完成"。
- 长任务先给结论再给证据；涉及线上时用真实 curl 结果，不猜。
- 不要把密钥、密码、授权码贴进对话或写进仓库文件；需要时让用户自己改 `.env`。
