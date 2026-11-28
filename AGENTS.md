# 小莫资源网 · 长期记忆（AGENTS.md）

> DSH 每个新会话会自动加载本文件。这里只放**长期有效的事实与约定**；逐轮流水与临时状态见
> [`docs/27-会话记忆与当前状态.md`](docs/27-会话记忆与当前状态.md)。
> 最近一轮复盘：2026-11-28，来源会话 `session-f5abf09d`（129 轮 / 91 条用户消息，3 次上下文压缩）；
> 上一轮 `session-0785f68a`（178 轮）的完整复盘见 `docs/27`。

## 1. 项目是什么

**小莫资源网**（XiaoMo Resource Hub）— 资源下载索引站，Next.js 全栈单体，自建服务器部署。
仓库 `github.com/ljh5866/xiaomo-resource-hub`（**public**，所以仓库内不写任何密钥）。
四个分类：软件工具 `software`、热门游戏 `games`、游戏 MODS `mods`、GitHub 开源项目 `opensource`。

**同一个仓库里还有一个产品**：`desktop/` = **碧翠丝资源**（Windows 桌面端网盘解析/下载器）。
**账号与收藏与网站互通**（网站新增 `/api/desktop/*`，Bearer token，复用 `users`/`favorites` 表），
其余自理：不读网站数据库、不调其它网站 API。改桌面端不影响网站部署，改网站要重新部署才会让新接口上线。
详见 `desktop/README.md`。

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

## 5. 数据与内容现状（2026-11-28 实测）

- 线上 `GET /api/health` → `published:1025`；本地库 1043 已发布 / 1 草稿（**差 18 条未部署**）。
- 本地分类分布：games 450 · mods 313 · **software 200** · opensource 80。
- 账号：线上 34 个（33 个从 Supabase 迁入 + 1 个管理员 `adminljh@ttals.com`）；本地库只有 8 条测试账号。
- 分类筛选：`/c/mods?game=minecraft`、`/c/games?genre=galgame|horror|competitive|survival|story|management|misc`、
  `/c/opensource?gh=android-app|ios-app|desktop-app|tool-lib`（端标签**互斥**，合计等于总数）、
  `/c/opensource?hot=1`（独立视图，直接展示 GitHub 官方周榜，不叠加站内筛选）、
  `/c/software?soft=<slug>`（9 个软件分类标签）。
- `software` 那 200 条来自 **3DM 软件站**（`fetch-3dmsoft.mjs` → `import-3dmsoft.mjs`），主链接是
  `provider='direct'`（标签「直接下载」，走 `/api/soft/download` 服务端代拉，绕开 3DM 的 Referer ACL 403）。
- 内容流水线（全部在 `scripts/`，都幂等）：
  `import-touchgal.mjs`（浏览器翻页）→ `sync-touchgal-pan.mjs`（网盘链接）→ `fetch-touchgal-detail.mjs`（详情页游戏信息，本地浏览器）→
  `export-touchgal.mjs`（打 zip）→ `import-rows-json.mjs`（服务器端纯 Node 导入，浏览器无关）→ `import-touchgal-meta.mjs`（详情补丁导入）；
  `import-bbsmc.mjs`（Modrinth 中文站 API）；`mcmod-list.mjs` + `import-mcmod.mjs`（MC百科）；
  `import-github.mjs` + `sync-github-stars.mjs` + `sync-github-trending.mjs`；`translate-resources.mjs`（介绍中文化）；
  `check-pan-links.mjs` + `import-pan-check.mjs`（网盘链接存活巡检，匿名接口，不转存）；
  `set-game.mjs`、`set-github-end.mjs`、`check-dup.mjs`、`randomize-names.mjs`、`fix-tag-scope.mjs`。
- **`resources.meta_json`** 存来源站结构化信息（原名/会社/发售/平台/语言/形态/别名/VNDB/Bangumi/官网），
  由 `src/lib/resource-meta.ts` 的 `parseResourceMeta` + `metaRows` 归一渲染；抓取端只写 JSON，展示端缺字段自动跳过。
- 详情页下载区**不展示 `provider='self'` 的「本站直链」**（有其它链接时隐藏，只有一条时才兜底，避免 GitHub 项目变空）。
- 数据契约：对外编号 `XM-YYYY-NNNN` 与内部 id 分离；`url_hash` 唯一；链接状态 ok/invalid/unknown/checking，
  `fail_count ≥ 3` 判 invalid；≥3 条未处理举报自动降权；IP 只存哈希。
- **一个资源只能有一条 `is_primary=1` 的链接**（列表查询用单行子查询取主链接，导入新链接前要把旧 primary 清零）。

## 5.1 站内网盘解析（网站自有能力，别和桌面端搞混）

- 入口：详情页每条夸克/百度/UC/迅雷链接的「站内解析」→ `/parse/{linkId}`（必须登录；只认 `published`；`noindex`）。
- 只放行 **夸克**（`providerReady()`）；百度/UC/迅雷只有 URL 解析和「开发中」占位。
- 登录态：`user_pan_credentials` 存 AES-256-GCM（HKDF 自 `AUTH_SECRET`）加密的 cookie；
  唯一可行的获取方式是 **`extension/` 里的 MV3 扩展**一键读取 httpOnly 的 `__pus`（`POST /api/pan/bind`）。
- 下载必须经服务器中转（`/api/pan/download`），因为夸克直链签名绑定请求头，直出浏览器必 412。
- 11-27 那版 Tauri 桌面端已整体移除（`ab11da1`）；11-28 晚按新需求重做为**独立产品「碧翠丝资源」**
  （Electron，`desktop/`），账号/收藏与网站互通。

## 5.2 桌面端与网站的接口（`/api/desktop/*`）

- 令牌：`src/lib/desktop/token.ts`（HMAC-SHA256 自 `AUTH_SECRET`，30 天，payload `{uid,tv,exp}`）；
  每次请求回表比对 `users.token_version` → 改密码/后台 revoke 立刻失效。
- 注册校验抽到 `src/lib/auth/register-core.ts`，网页 server action（`register.ts`）与桌面 API 共用。
- 路由：`login` / `code` / `login-code` / `register` / `me` / `password`（改密返回新 token）/
  `logout` / `favorites`（GET 列表、POST 切换）。
- **不返回任何 CORS 头**：只有非浏览器客户端带 Bearer 能用，网页 JS 拿不到（CSRF 面为 0）。
- 桌面端默认站点 `https://ttals.com`，可在「设置 → 站点地址」改；本地联调用 `BEATRICE_SITE=http://127.0.0.1:3100`。

## 6. 关键文件

`src/content/site.ts`（全部文案/导航/SEO）· `src/app/globals.css`（唯一设计令牌源，前台亮色 + `.admin-scope` 后台灰阶）
· `src/lib/queries.ts`（列表/详情 SQL）· `src/lib/seo.ts` + `src/components/seo/json-ld.tsx`
· `src/db/schema.ts` + `src/db/sql/*` · `deploy/`（deploy.sh、Caddyfile、systemd unit/timer、fix-permissions）
· `src/lib/pan/*`（网盘解析：quark.ts 四条接口 / fast-download.ts 分片并发 / credentials.ts 加密存储 / prepared.ts 取链票据）
· `src/components/parse/parse-panel.tsx` · `extension/`（MV3 扩展，一键绑定网盘 cookie）
· `scripts/verify-all.mjs`（typecheck → 单测 → build → 临时 3101 端口 e2e → smoke → perf → 视口 → 后台审计）
· `scripts/audit-prod.mjs`（线上 36 项体检）· `docs/00`…`docs/32`（设计与实现记录）
· `desktop/`（碧翠丝资源桌面端：`electron/main.cjs` 生命周期与 IPC · `electron/site.cjs` 站点账号/收藏客户端 ·
  `electron/quark.cjs` 夸克接口 · `electron/dl.cjs` 分片下载引擎 · `electron/selftest.cjs` 无人值守自检 · `src/` React 界面）
· `src/lib/desktop/{token,auth}.ts` + `src/app/api/desktop/*`（桌面端 Bearer 令牌与账号/收藏接口）

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
   **改中文文件绝不能用 PowerShell 的 `ReadAllText/WriteAllText`、`-replace | Set-Content`**（会写坏 UTF-8，
   实测三次；最后一次把 `desktop/electron/main.cjs` 整份中文写废，只能重写文件）。只能用 `edit` / `write` 工具。
10. **夸克直链只能服务端中转**：CDN 签名绑定 `content-disposition` / `x-oss-traffic-limit` 等请求头，
    原样丢给浏览器/IDM 必 `412` 或 `SignatureDoesNotMatch`。
11. 夸克错误码：`31001 require login [guest]` = 没带登录态；`23018 download file size limit` = 游客/非会员
    单文件限制（≈50MB），要 `file/download` + 分享凭证 + 账号态 cookie 才过；`50051 st invalid` = stoken 过期，
    必须用真提取码重新换票（不能拿空码兜底）。
12. Windows `Compress-Archive` 会把条目名写成**反斜杠**，Linux 解压出一个名字里带 `\` 的文件 → 传服务器用
    `tar -czf`；`Caddyfile` 必须**纯 ASCII**（中文注释会让 Caddy 报 `unrecognized directive`）。
13. 读 DSH 会话日志：`session.v4.jsonl.zstd` 是**多帧拼接**，`zstdDecompressSync` 只解第一帧（只得到头 189 字节）；
    要按 magic `0xFD2FB528` + 帧头/块头自己扫帧，再逐帧解压拼起来。
14. **Electron `net.request` 给 `http://` 目标加 `Referer` 会被 Chromium 直接拦成
    `net::ERR_BLOCKED_BY_CLIENT`**（https 目标不受影响）→ 桌面端只在 https 直链上带 Referer。
15. 桌面端装依赖必须 `pnpm install --ignore-workspace`：仓库根的 `pnpm-workspace.yaml` 会把安装带到
    网站仓库，**改写 `pnpm-lock.yaml`**（实测发生过，已 `git checkout` 还原）。
16. 桌面端打包不要签名：`electron-builder` 会去 GitHub 下 `winCodeSign`（本机代理配错会失败），
    `win.signAndEditExecutable=false` + `forceCodeSigning=false` 才能出 `win-unpacked`。

## 8. 还没收口的债

- **P0 安全**：`tmp-supabase-users.csv` 仍被 git 跟踪，`raw.githubusercontent.com/.../main/tmp-supabase-users.csv`
  实测 **200 / 9,570 B**（34 个邮箱 + bcrypt 哈希）。要 `git rm --cached` + `git filter-repo --invert-paths` +
  force push + `UPDATE users SET token_version = token_version + 1`，并通知用户改密。详见 `docs/28` §2。
- 软 404：`/r/<不存在>`、`/c/<不存在>` 仍返回 200（`generateMetadata` 里返回 metadata 而不是 `notFound()`）。
- `view_count` 全库 0（详情页从不累加）；4923 条链接 `status` 全是 `unknown`（巡检从未落库）。
- 百度 / UC / 迅雷 网盘解析未实现。
- `DESIGN.md` 仍是初版深色方案（历史稿）；`.gitignore` 里的中文注释被 PowerShell 写成乱码。

## 9. 协作偏好

- 全程**简体中文**；代码标识符/命令/日志保持原文。
- 每轮结尾给**自检表**（检查项 / 结果），不要只报"已完成"。
- 长任务先给结论再给证据；涉及线上时用真实 curl 结果，不猜。
- 不要把密钥、密码、授权码贴进对话或写进仓库文件；需要时让用户自己改 `.env`。
