# 小莫资源网 · XiaoMo Resource Hub

一个以「可检索、可信任、可持续更新」为核心的资源索引站。
**当前进度：M1 骨架已完成并可运行**（页面全通、数据库已灌种子、生产构建通过）。

## 一句话定位

> 把散落在网盘、论坛、公众号里的好用资源，整理成一张**带目录编号、标注失效状态、能三秒找到**的索引卡。

## 快速开始

```bash
pnpm install
pnpm db:migrate   # 建表（data/app.db）
pnpm db:seed      # 24 条种子数据 + 搜索索引
pnpm covers:gen   # 生成品牌封面
pnpm user:add admin@xiaomo.local xiaomo2026 --admin   # 建管理员
pnpm user:revoke admin@xiaomo.local                   # 强制该账号所有会话下线
pnpm dev          # http://localhost:3100
```

> 从头来一遍：`pnpm db:migrate && pnpm db:seed && pnpm covers:gen && pnpm user:add ...`

常用命令：

```bash
pnpm links:check   # 链接巡检（--dry 只看不写）
pnpm db:reindex    # 重建 FTS5 索引
pnpm covers:gen    # 为种子资源生成品牌封面
pnpm covers:gc     # 回收孤儿封面（--force 才真删）
pnpm backup        # 数据库快照 + 封面打包到 data/backups
pnpm seed:bulk     # 压测数据（--count 200 / --clean）
pnpm import:links  # 从链接清单生成导入 CSV（links.txt --cat template）
pnpm db:clean:content  # 清空内容（保留分类/标签/账号；--dry 先看）
pnpm test          # 单元测试（node:test，20 条）
pnpm build && pnpm start
node scripts/shot.mjs        # 视口截图与溢出检测
node scripts/test-admin.mjs  # 后台端到端（新建→发布→前台→导入）
node scripts/test-auth.mjs   # 鉴权端到端（拦截→登录→收藏→退出）
node scripts/test-guards.mjs # 删除二次确认 + 登录限流
node scripts/test-revoke.mjs # 会话吊销（revoke 后旧会话失效）
node scripts/test-pagination.mjs # 分页与「加载更多」
node scripts/test-report.mjs # 举报链路（游客提交 → 后台处理）
node scripts/test-submit.mjs # 投稿链路（提交 → 采纳生成草稿）
node scripts/test-seo.mjs    # 结构化数据（JSON-LD 字段校验）
node scripts/test-admin-tools.mjs # 后台三件套（搜索分页 / 分类标签 / 复测）
node scripts/test-import.mjs # 内容流水线（链接 → CSV → 导入）
node scripts/test-og.mjs     # 分享图（1200×630 PNG + og:image meta）
node scripts/drill-deploy.mjs # 部署演练（物料 / 环境 / 备份恢复 / 字体）
node scripts/perf.mjs        # 性能预算（LCP/CLS/TTFB）
```

部署见 [docs/09-部署与运维.md](docs/09-部署与运维.md)（含 `deploy/` 下的 Caddyfile 与 systemd 单元）。
阿里云香港机型见 [docs/20-阿里云香港部署.md](docs/20-阿里云香港部署.md)，服务器初始化用 `deploy/bootstrap-ubuntu.sh`。

## CI

`.github/workflows/ci.yml` 在每次 push / PR 跑两个 Job：

| Job | 内容 |
|---|---|
| `verify` | 类型检查 → 单测 → 从零建库+种子+封面 → 构建 → 起服务烟测 9 条路由 + `/admin` 必须 307 |
| `e2e` | 装 chromium → `test-auth` 鉴权链路 → `test-guards` 防护 → `shot` 三档视口溢出断言 → 上传截图 |

验收脚本靠环境变量适配本地/CI：`BASE_URL`、`BROWSER_PATH`（见 `scripts/lib/browser.mjs`）。

## 规划与交付文档

| 文档 | 内容 |
|---|---|
| [docs/00-参考项目研究.md](docs/00-参考项目研究.md) | GitHub 上 10 个同类项目的拆解：抄什么、丢什么 |
| [docs/01-项目规划.md](docs/01-项目规划.md) | 定位、用户、范围边界、指标体系、M0–M4 排期、风险 |
| [docs/02-技术架构与数据模型.md](docs/02-技术架构与数据模型.md) | 选型理由、架构图、表结构、搜索方案、巡检状态机 |
| [docs/03-信息架构与页面清单.md](docs/03-信息架构与页面清单.md) | 路由表、逐页线框、后台规范、SEO 策略 |
| [docs/04-M1-实现记录.md](docs/04-M1-实现记录.md) | **本层交付清单、踩坑记录（node:sqlite 替换 better-sqlite3）、验收数据、缺口** |
| [docs/05-改动指南.md](docs/05-改动指南.md) | **改哪儿、多贵、别碰什么**——为"以后会改很多次"准备的说明书 |
| [docs/06-M3-后台与运营.md](docs/06-M3-后台与运营.md) | **后台 CRUD / 批量导入 / 链接巡检**、踩坑记录、端到端验证结果 |
| [docs/07-M2-封面与收藏.md](docs/07-M2-封面与收藏.md) | **封面链路（上传→sharp→WebP→LQIP）与收藏（cookie 过渡）**、单元测试 |
| [docs/08-鉴权与自检.md](docs/08-鉴权与自检.md) | **登录鉴权、后台上锁、收藏入表**、三个退出登录的坑、每轮自检清单 |
| [docs/09-部署与运维.md](docs/09-部署与运维.md) | **VPS 部署、systemd/Caddy、备份恢复、定时任务、上线检查清单** |
| [docs/10-CI与自动化.md](docs/10-CI与自动化.md) | **GitHub Actions 两个 Job、脚本可移植改造、迁移器吞语句的真 Bug** |
| [docs/11-会话吊销.md](docs/11-会话吊销.md) | **JWT 吊销（token_version）、流式渲染下 redirect 不落地的坑** |
| [docs/12-列表分页.md](docs/12-列表分页.md) | **分页与「加载更多」、CLS 回归修复、压测数据脚本** |
| [docs/13-举报与后台防护.md](docs/13-举报与后台防护.md) | **举报链路、后台写操作的服务端鉴权（补上 server action 的洞）** |
| [docs/14-投稿与自动降权.md](docs/14-投稿与自动降权.md) | **投稿入口（采纳生成草稿）、举报满 3 次自动标失效** |
| [docs/15-结构化数据.md](docs/15-结构化数据.md) | **JSON-LD 四类齐备、kind→schema 类型映射、新旧两份打架的坑** |
| [docs/16-后台三件套.md](docs/16-后台三件套.md) | **资源搜索分页 / 分类标签管理 / 巡检一键复测** |
| [docs/17-内容流水线.md](docs/17-内容流水线.md) | **链接清单 → CSV → 导入**、CSV 纯函数与单测 |
| [docs/18-清空测试数据.md](docs/18-清空测试数据.md) | **清空内容（保留分类/标签/账号）、空库页面表现、哪些 e2e 会红** |
| [docs/19-分享图与部署演练.md](docs/19-分享图与部署演练.md) | **OG 分享图（sharp+SVG，中文靠系统字体）、部署演练脚本** |
| [docs/20-阿里云香港部署.md](docs/20-阿里云香港部署.md) | **香港轻量从下单到上线**、初始化脚本、域名与 HTTPS、迁移 |
| [docs/21-上线操作单.md](docs/21-上线操作单.md) | 首次上线的逐步操作单（部署、验证、回滚） |
| [docs/22-后台重做与注册系统.md](docs/22-后台重做与注册系统.md) | **后台控制台重做 + 普通用户注册体系**的规划与落地 |
| [docs/23-后台子域名.md](docs/23-后台子域名.md) | `admin.ttals.com` 子域方案、host 路由与登录页隔离 |
| [docs/24-注册邮箱验证码.md](docs/24-注册邮箱验证码.md) | QQ SMTP 验证码注册/登录、限流与哈希存储 |
| [docs/25-从Supabase迁移用户.md](docs/25-从Supabase迁移用户.md) | 33 个老账号迁入、bcrypt 兼容与自动升级 scrypt |
| [docs/26-用户中心.md](docs/26-用户中心.md) | `/me` 用户页与 `/me/settings` 设置页、头像上传、游客收敛 |
| [docs/27-会话记忆与当前状态.md](docs/27-会话记忆与当前状态.md) | **178 轮会话的完整复盘**：时间线、决策、坑、线上实测、待办 |
| [docs/28-项目现状评估.md](docs/28-项目现状评估.md) | **体检报告**：代码/数据/线上实测、P0 数据泄露、软 404、性能链路拆解、修复顺序 |
| [docs/29-详情页作品信息.md](docs/29-详情页作品信息.md) | **删「本站直链」+ 作品信息表**：meta_json 设计、TouchGal 详情抓取、部署步骤 |
| [AGENTS.md](AGENTS.md) | **长期记忆/工作区约定**（新会话自动加载）：环境、硬约束、部署纪律、踩坑索引 |
| [DESIGN.md](DESIGN.md) | ⚠️ 已过期：仍是初版「墨绿黑 + 黄铜 + 宋体 + 直角」；**现行视觉以 `src/app/globals.css` 的令牌为准（亮色极简扁平）** |

## 技术栈（实际落地版）

```
框架   Next.js 16.4 (App Router / RSC) + TypeScript 5.9
样式   Tailwind CSS v4（@theme inline 映射 DESIGN.md token）
数据   node:sqlite（运行时，Node 24 内建） + drizzle-kit（迁移/种子）
搜索   FTS5 + 2-gram 中文切词（纯 JS，零原生依赖），bm25 排序，LIKE 兜底
图片   sharp → WebP + LQIP，本地存储驱动（可换 R2/OSS）
鉴权   NextAuth v5 Credentials + scrypt；middleware 拦 /admin
数据   显式 SQL 迁移（scripts/migrate.mjs），不用 drizzle-kit push
文案   全部集中在 src/content/site.ts
渲染   静态 + ISR（revalidate 600/3600）+ 流式 Suspense
图标   lucide-react（1.5px 描边，无 emoji）
验收   playwright-core + 本机 Edge（真实视口截图与溢出检测）
```

## 目录

```
src/app       路由与页面（/, /c, /r, /t, /search, /updates, /admin/*, /go, /styleguide, sitemap, robots, rss）
src/components  ui 原语 / layout / resource / admin
src/content    site.ts（全部文案与导航配置）
src/db        schema(drizzle) · client(node:sqlite) · seed
src/lib       queries · search(FTS5) · admin(actions/schema) · constants · utils · links
src/scripts   reindex · check-links · gen-covers · covers-gc · add-user · cleanup-test
scripts       migrate.mjs · backup.mjs · shot.mjs / test-*.mjs（验收）
deploy        Caddyfile · systemd 单元 · deploy.sh
tests         node:test 用例（20 条）
data          app.db（gitignore）
.shots        验收截图（gitignore）
```

## 本地环境（已核对）

Node `v24.19.0` · pnpm `10.32.1` · git `2.55.0` · 无 PHP / 无 Docker
→ 因此技术路线为 Node 全栈，不走 WordPress / 苹果CMS。

## 下一步

**M4 准备**：部署脚本 / 备份 / 巡检定时 / 登录限流
**体验收尾**：删除二次确认 / 多尺寸封面 / 孤儿图回收 / 移动端细节
**内容**：200 条过审资源铺底，然后才是 SEO 推广
