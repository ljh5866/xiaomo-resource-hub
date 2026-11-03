/**
 * 种子数据：24 条资源 / 7 个分类 / 18 个标签
 * 运行：pnpm db:seed
 * 说明：链接一律为示例地址（EXAMPLE-xxxx），仅用于本地演示跳板与状态展示。
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  categories,
  downloadEvents,
  favorites,
  reports,
  resourceLinks,
  resourceTags,
  resources,
  tags,
  users,
} from "./schema";
import { hashUrl } from "../lib/links";
import { reindexAll } from "../lib/search/fts";

const now = Date.now();
const day = 86_400_000;
const daysAgo = (n: number) => new Date(now - n * day);

type Seed = {
  slug: string;
  title: string;
  subtitle: string;
  cat: string;
  kind: string;
  platforms: string[];
  version?: string;
  size: string;
  license: string;
  featured?: boolean;
  downloads: number;
  days: number;
  tags: string[];
  provider: "quark" | "baidu" | "aliyun" | "xunlei" | "123" | "115";
  status?: "ok" | "invalid" | "unknown";
  summary: string;
  content: string;
};

const CATEGORIES = [
  ["software", "软件工具", "AppWindow", "效率工具、系统增强、开发辅助，按平台标注。", 1],
  ["template", "模板文档", "LayoutTemplate", "Excel / PPT / Word / Notion 模板，开箱即用。", 2],
  ["material", "设计素材", "Palette", "图片、视频、音频、工程文件，注明用途与授权。", 3],
  ["course", "教程课程", "GraduationCap", "成体系的课程与实操教程，标注时长与难度。", 4],
  ["font", "字体字库", "Type", "中英文字体与可变字体，商用授权单独注明。", 5],
  ["icon", "图标插画", "Shapes", "图标库、插画包、UI 组件资源。", 6],
  ["ebook", "电子书", "BookOpen", "技术书、行业报告、手册文档。", 7],
] as const;

const TAGS = [
  ["excel", "Excel"], ["ppt", "PPT"], ["notion", "Notion"], ["design", "设计"],
  ["video", "视频剪辑"], ["audio", "音频"], ["font", "字体"], ["icon", "图标"],
  ["productivity", "效率"], ["dev", "开发"], ["windows", "Windows"], ["mac", "macOS"],
  ["course", "课程"], ["free", "免费"], ["opensource", "开源"], ["report", "报告"],
  ["ui", "UI 设计"], ["template", "模板"],
] as const;

const RESOURCES: Seed[] = [
  {
    slug: "excel-dashboard-pack",
    title: "Excel 数据看板模板合集",
    subtitle: "12 套可直接套用的经营分析看板，含公式说明",
    cat: "template", kind: "template", platforms: ["windows", "office"], version: "v3.2",
    size: "1.2 GB", license: "free", featured: true, downloads: 23481, days: 2,
    tags: ["excel", "template", "report"], provider: "quark", status: "ok",
    summary: "12 套经营分析看板，覆盖销售、库存、人力、财务四类场景，全部带公式注释。",
    content:
      "这套模板源自三份真实的月度经营会材料，把反复重做的图表固化成了可复用结构。每张看板都保留了数据源页、计算页、展示页三层，改数据不会牵动公式。\n\n适用场景：月度经营会、季度复盘、门店对比。包含销售漏斗、库存周转、人效分析、费用结构四类。所有图表基于 Excel 原生图表，不依赖插件，WPS 亦可打开。\n\n使用建议：先替换「数据源」页的示例数据，再检查「计算」页的命名区域是否覆盖到你的数据行数。",
  },
  {
    slug: "figma-ui-kit-minimal",
    title: "极简后台 UI Kit（Figma）",
    subtitle: "180+ 组件、深浅双主题、Auto Layout 全量",
    cat: "icon", kind: "material", platforms: ["mac", "web"], version: "v2.1",
    size: "86 MB", license: "free", featured: true, downloads: 8120, days: 4,
    tags: ["ui", "design", "template"], provider: "baidu", status: "ok",
    summary: "面向 B 端后台的 Figma 组件库，含表格、表单、图表容器与深浅两套变量。",
    content:
      "组件全部基于 Figma Variables 做主题切换，改一个集合就能整体换肤。表格组件支持列宽拖拽、空状态、加载态三种变体。\n\n结构上分为 Foundations（色彩/字阶/间距）、Components（按钮/输入/表格/导航）、Patterns（列表页/详情页/设置页）三层，方便按需取用。\n\n注意：图表为静态占位，需自行接入数据可视化库。",
  },
  {
    slug: "premiere-lut-pack",
    title: "电影感调色 LUT 合集（40 组）",
    subtitle: "适配 Premiere / DaVinci / Final Cut",
    cat: "material", kind: "material", platforms: ["windows", "mac"], version: "v1.4",
    size: "240 MB", license: "free", downloads: 15602, days: 6,
    tags: ["video", "design"], provider: "aliyun", status: "ok",
    summary: "40 组 .cube 格式 LUT，覆盖日系、胶片、冷调、纪实四种风格，附对比截图。",
    content:
      "全部为 .cube 格式，Premiere、DaVinci Resolve、Final Cut Pro 通用。每组附一张前后对比截图，方便快速判断适用场景。\n\n建议用法：先做基础曝光校正，再套 LUT，最后按素材色温微调强度（30%–70%）。直接套用容易过曝。\n\n包含四类：日系清透（12 组）、胶片颗粒（10 组）、冷调工业（8 组）、纪实录影（10 组）。",
  },
  {
    slug: "notion-second-brain",
    title: "Notion 第二大脑模板",
    subtitle: "收件箱 / 项目 / 领域 / 资源 四层 PARA 结构",
    cat: "template", kind: "template", platforms: ["web"], version: "v1.8",
    size: "12 MB", license: "free", featured: true, downloads: 11240, days: 1,
    tags: ["notion", "productivity", "template"], provider: "quark", status: "ok",
    summary: "基于 PARA 方法的 Notion 工作台，含每日收件箱、项目看板、周回顾自动化。",
    content:
      "骨架是 PARA：Projects（有截止日的事）、Areas（长期负责的领域）、Resources（参考资料）、Archives（归档）。入口只有一个「收件箱」，降低记录摩擦。\n\n内含三个数据库视图：今日待办、本周项目、停滞提醒（超过 14 天未动的项目自动高亮）。周回顾页提供 6 个复盘问题。\n\n导入方式：复制模板链接到自己的 Notion 工作区，然后按提示替换示例条目。",
  },
  {
    slug: "vscode-extensions-list",
    title: "前端开发 VS Code 插件清单",
    subtitle: "38 个经过半年使用筛选的插件 + 配置片段",
    cat: "software", kind: "software", platforms: ["windows", "mac", "linux"], version: "2026.10",
    size: "24 MB", license: "opensource", downloads: 6420, days: 3,
    tags: ["dev", "productivity", "opensource"], provider: "baidu", status: "ok",
    summary: "38 个前端常用插件的取舍理由、互相冲突说明，以及一份可直接粘贴的 settings.json。",
    content:
      "不是排行榜，是「留下什么、删掉什么」的记录。每个插件写了为什么留、什么情况下可以不用，以及和其他插件的冲突点（例如两个格式化插件同时启用会打架）。\n\n附 settings.json 片段，包含保存即格式化、Tailwind 类名排序、TypeScript 内存上限调整。\n\n适合已经装了一堆插件但编辑器越来越卡的人。",
  },
  {
    slug: "chinese-font-collection",
    title: "开源中文字体合集（可商用）",
    subtitle: "思源系列 / 霞鹜文楷 / 得意黑 等 14 款",
    cat: "font", kind: "font", platforms: ["windows", "mac"], version: "2026.09",
    size: "3.4 GB", license: "opensource", downloads: 19880, days: 8,
    tags: ["font", "design", "free", "opensource"], provider: "quark", status: "ok",
    summary: "14 款明确可商用的开源中文字体，附授权说明与适用场景建议。",
    content:
      "收录标准只有一条：授权明确允许商用且可自由分发。每款字体附官方授权页链接与一句话适用建议（正文/标题/展示）。\n\n包含：思源黑体、思源宋体、霞鹜文楷、得意黑、未来荧黑、寒蝉系列等。全部为可变字体或提供多字重。\n\n注意：字体文件体积大，安装前建议先用字体管理器做子集化，否则系统字体会变慢。",
  },
  {
    slug: "icon-set-lucide-plus",
    title: "线性图标库扩充包（1200 枚）",
    subtitle: "24px 网格、1.5px 描边、SVG + React 组件",
    cat: "icon", kind: "icon", platforms: ["web", "mac"], version: "v3.0",
    size: "18 MB", license: "opensource", downloads: 9340, days: 5,
    tags: ["icon", "ui", "design", "opensource"], provider: "aliyun", status: "ok",
    summary: "在通用线性图标基础上补齐业务场景缺口：物流、医疗、金融、教育四类。",
    content:
      "统一 24×24 网格、1.5px 描边、圆角端点，与主流线性图标库风格一致，可混用不违和。\n\n补齐的四类业务图标是通用库里最缺的：物流（运单/揽收/派送）、医疗（病历/处方/随访）、金融（对账/清算/额度）、教育（课表/作业/班级）。\n\n提供 SVG 原文件、React 组件（tree-shakable）与 Figma 组件库三种形态。",
  },
  {
    slug: "python-data-course",
    title: "Python 数据分析实战课（32 讲）",
    subtitle: "从 pandas 到可视化，含 6 个真实数据集",
    cat: "course", kind: "course", platforms: ["windows", "mac", "linux"], version: "2026",
    size: "8.6 GB", license: "free", downloads: 7210, days: 12,
    tags: ["course", "dev", "free"], provider: "xunlei", status: "ok",
    summary: "32 讲视频 + 6 个真实数据集 + Notebook 源码，覆盖清洗、分析、可视化全流程。",
    content:
      "课程结构是「一个问题一讲」：先给脏数据，再讲怎么判断该用什么方法，最后给可复用的代码块。不是 API 罗列。\n\n六个数据集包括电商订单、公交刷卡、气象观测、招聘信息、房价、文本评论，都是真实脱敏数据。\n\n前置要求：会基础 Python 语法即可。不需要统计学背景，但第 18 讲之后会引入假设检验。",
  },
  {
    slug: "ppt-report-deck",
    title: "年终汇报 PPT 模板（16:9）",
    subtitle: "4 套配色、120 页版式、全矢量可编辑",
    cat: "template", kind: "template", platforms: ["windows", "office", "wps"], version: "v2.0",
    size: "420 MB", license: "free", downloads: 31200, days: 9,
    tags: ["ppt", "template", "report"], provider: "quark", status: "ok",
    summary: "120 页年终汇报版式，含数据页、时间轴、团队页、规划页，四套配色可切换。",
    content:
      "版式按汇报逻辑排好：回顾（成绩/问题）→ 分析（数据/归因）→ 规划（目标/路径/资源）。直接用比从零排版快十倍。\n\n全部为矢量图形，改配色只需替换主题色板。图表为占位图形，替换数据后需手动调整刻度。\n\n提醒：模板只解决排版，不解决内容。先写好每页的一句话结论，再套版式。",
  },
  {
    slug: "blender-product-render",
    title: "Blender 产品渲染工程文件",
    subtitle: "布光 / 材质 / 后期节点全保留",
    cat: "material", kind: "material", platforms: ["windows", "mac", "linux"], version: "4.2",
    size: "1.8 GB", license: "free", downloads: 4380, days: 15,
    tags: ["design", "video"], provider: "baidu", status: "unknown",
    summary: "三个产品静物场景的完整工程，含三点布光、程序化材质与合成节点。",
    content:
      "三个场景：桌面小物（金属+塑料）、护肤瓶（磨砂玻璃）、耳机（织物+金属）。每个都保留了完整节点树，可以拆开看每一步怎么做的。\n\n重点在教学价值：程序化材质如何避免贴图接缝、HDRI 与区域光如何配比、合成阶段怎么加辉光不糊。\n\n需要 Blender 4.2 以上。渲染建议用 Cycles，样本 128 起。",
  },
  {
    slug: "wps-macro-toolbox",
    title: "WPS 宏工具箱（表格自动化）",
    subtitle: "批量拆分 / 合并 / 去重 / 格式清洗 12 个脚本",
    cat: "software", kind: "software", platforms: ["windows", "wps"], version: "v1.6",
    size: "6 MB", license: "free", downloads: 8760, days: 7,
    tags: ["excel", "productivity", "windows"], provider: "123", status: "ok",
    summary: "12 个常用表格自动化脚本，带操作面板，不需要懂 VBA 也能用。",
    content:
      "覆盖最高频的六件事：按列拆分多个工作表、多表合并、跨表去重、格式统一、空行清理、批量重命名。\n\n每个脚本都有可视化操作面板，选好区域点按钮即可。源码开放，可以照着自己改。\n\n注意：宏需要启用，部分企业环境会拦截。建议先在副本上试跑。",
  },
  {
    slug: "english-listening-pack",
    title: "职场英语听力素材包",
    subtitle: "会议 / 邮件 / 汇报 三类场景，含逐句文本",
    cat: "course", kind: "course", platforms: ["web"], version: "2026",
    size: "2.1 GB", license: "free", downloads: 5240, days: 20,
    tags: ["course", "audio", "free"], provider: "aliyun", status: "ok",
    summary: "三类职场场景的听力素材，每段配逐句文本、生词表与跟读标记。",
    content:
      "素材按场景切分：会议（打断、澄清、总结）、邮件（电话确认、催促、拒绝）、汇报（开场、数据描述、答疑）。\n\n每段 2–4 分钟，配逐句文本与生词表；重点句有跟读标记，方便做影子练习。\n\n建议节奏：先盲听一遍抓大意，再看文本精听，最后跟读。每天 20 分钟，四周见效。",
  },
  {
    slug: "docker-dev-env",
    title: "本地开发环境 Docker 编排模板",
    subtitle: "Node + Postgres + Redis + MinIO 一键起",
    cat: "software", kind: "software", platforms: ["windows", "mac", "linux"], version: "v2.3",
    size: "48 MB", license: "opensource", downloads: 3980, days: 11,
    tags: ["dev", "opensource", "productivity"], provider: "baidu", status: "ok",
    summary: "一套 compose 文件搞定本地全栈依赖，含健康检查、数据卷与初始化脚本。",
    content:
      "包含 Postgres（带初始化 SQL 挂载）、Redis（含密码与持久化配置）、MinIO（S3 兼容对象存储）、Mailhog（拦邮件）。\n\n所有服务都有 healthcheck，`depends_on` 带条件，避免启动顺序问题。数据卷独立命名，删容器不丢数据。\n\n附带一份 README 说明常见坑：Windows 下的卷权限、端口占用、ARM 镜像缺失。",
  },
  {
    slug: "video-transition-pack",
    title: "转场特效包（120 组）",
    subtitle: "Premiere / AE 双版本，含音效",
    cat: "material", kind: "material", platforms: ["windows", "mac"], version: "v4.1",
    size: "3.2 GB", license: "free", downloads: 18700, days: 14,
    tags: ["video", "design"], provider: "xunlei", status: "invalid",
    summary: "120 组转场，分遮挡、形变、光效、故障四类，附配套音效。",
    content:
      "四类转场：遮挡（物件划过）、形变（缩放/位移）、光效（闪白/漏光）、故障（信号干扰）。Premiere 版为 .prproj 预设，AE 版为 .aep 工程。\n\n每组配一个音效，节奏对得上，省去再找声音的时间。\n\n注意：转场吃性能，4K 时间线建议先渲染代理。当前网盘链接已失效，小编正在补备用源。",
  },
  {
    slug: "color-palette-library",
    title: "配色方案库（240 组）",
    subtitle: "含 HEX / RGB / HSB，标注对比度",
    cat: "icon", kind: "material", platforms: ["web", "mac"], version: "v1.2",
    size: "32 MB", license: "free", downloads: 5620, days: 18,
    tags: ["design", "ui"], provider: "quark", status: "ok",
    summary: "240 组配色，每组标注 WCAG 对比度是否达标，可直接导入 Figma。",
    content:
      "每组的五色都算了正文对比度，明确标出哪些组合通过了 4.5:1、哪些只适合大字。省去自己验的时间。\n\n按场景分类：后台管理（低饱和）、营销落地页（高对比）、数据可视化（色盲友好）、移动端（深色优先）。\n\n提供 ASE 色板、Figma 样式库、JSON 三种格式。",
  },
  {
    slug: "kubernetes-handbook",
    title: "Kubernetes 实战手册（PDF）",
    subtitle: "420 页，从部署到排障的现场笔记",
    cat: "ebook", kind: "ebook", platforms: ["web"], version: "2026.08",
    size: "68 MB", license: "free", downloads: 3410, days: 22,
    tags: ["dev", "report", "free"], provider: "aliyun", status: "ok",
    summary: "420 页实战手册，按「部署 → 观测 → 排障 → 扩容」组织，全是可复制的命令。",
    content:
      "写法偏实操：每个问题先给现象（Pod 一直 Pending / 服务偶发 502），再给排查路径，最后给命令。不铺垫概念。\n\n章节结构：集群搭建、工作负载、网络与 Service、存储、可观测性、故障排查、弹性伸缩。\n\n适合已经能跑起一个 Deployment，但排障时不知道从哪下手的人。",
  },
  {
    slug: "resume-templates",
    title: "简历模板合集（可直接编辑）",
    subtitle: "8 套版式，Word / Pages / Figma 三格式",
    cat: "template", kind: "template", platforms: ["windows", "mac", "web"], version: "v3.0",
    size: "180 MB", license: "free", downloads: 26400, days: 16,
    tags: ["template", "productivity", "free"], provider: "baidu", status: "ok",
    summary: "8 套针对不同岗位的简历版式，含填写示例与常见错误说明。",
    content:
      "按岗位分：技术、产品、设计、运营、财务、应届、转行、管理。每套都给了填写示例，不是空白表格。\n\n附一份「常见错误」清单：时间倒序写错、项目描述只写职责不写结果、技能条用百分比。\n\n提醒：模板只解决排版。真正决定通过率的是每段经历里的量化结果。",
  },
  {
    slug: "screen-recorder-lite",
    title: "轻量录屏工具（免安装）",
    subtitle: "单文件 12 MB，支持区域录制与麦克风混音",
    cat: "software", kind: "software", platforms: ["windows"], version: "v2.7",
    size: "12 MB", license: "free", downloads: 14200, days: 10,
    tags: ["windows", "productivity", "free"], provider: "123", status: "ok",
    summary: "单文件绿色版录屏工具，12MB，支持区域录制、麦克风与系统声音混音。",
    content:
      "不需要安装，双击即用。核心功能就三个：选区域、开录、导出 MP4。没有剪辑、没有云上传、没有登录。\n\n支持麦克风与系统声音同时录制，输出 H.264，体积控制得不错（10 分钟 1080p 约 120MB）。\n\n适用场景：录 bug 复现、录操作步骤、录短教程。需要剪辑的话另配工具。",
  },
  {
    slug: "excel-formula-cheatsheet",
    title: "Excel 函数速查表（含 200 例）",
    subtitle: "按使用频率排序，每个函数配一个真实例子",
    cat: "ebook", kind: "ebook", platforms: ["web", "office"], version: "2026.10",
    size: "8 MB", license: "free", downloads: 21800, days: 13,
    tags: ["excel", "productivity", "free"], provider: "quark", status: "ok",
    summary: "200 个高频函数的速查表，每个配一个能直接套用的例子与常见错误。",
    content:
      "不是按字母排序，是按「你多久用一次」排序：前 20 个覆盖了日常 80% 的场景。\n\n每个函数格式统一：语法、一句话作用、真实例子（带数据）、常见错误（比如 VLOOKUP 的近似匹配陷阱）。\n\n附一张 A4 打印版，可以贴在显示器边上。",
  },
  {
    slug: "audio-sfx-library",
    title: "音效素材库（600 组）",
    subtitle: "UI 音 / 转场音 / 环境音，48kHz 无损",
    cat: "material", kind: "material", platforms: ["windows", "mac"], version: "v1.0",
    size: "5.6 GB", license: "free", downloads: 6840, days: 25,
    tags: ["audio", "video", "design"], provider: "115", status: "unknown",
    summary: "600 组音效，分 UI 反馈、转场、环境三类，48kHz 无损，已做响度归一。",
    content:
      "三类音效：UI 反馈（点击/成功/错误/提示）、转场（whoosh/impact/riser）、环境（室内/街道/自然）。\n\n全部做过响度归一（-16 LUFS），混进项目里不会突然爆音。48kHz / 24bit 无损。\n\n注意：这个链接还没做过校验，建议先试听再批量下载。",
  },
  {
    slug: "productivity-workflow-guide",
    title: "个人效率系统搭建指南",
    subtitle: "从收集到复盘的完整流程，附工具选型表",
    cat: "course", kind: "course", platforms: ["web"], version: "2026",
    size: "320 MB", license: "free", downloads: 4120, days: 19,
    tags: ["productivity", "course", "free"], provider: "aliyun", status: "ok",
    summary: "把「收集—整理—执行—复盘」四步拆成可落地的动作，附工具选型对照表。",
    content:
      "重点不在工具，在流程。先定四步各自的动作边界，再选工具；反过来一定会陷入「换工具上瘾」。\n\n附工具选型表：按「单人/小团队」「纯文本/富媒体」「离线优先/云同步」三个维度给推荐，并标注迁移成本。\n\n最后两讲是复盘方法：周回顾问什么、月度看什么指标、季度怎么砍项目。",
  },
  {
    slug: "web-performance-checklist",
    title: "Web 性能优化检查清单",
    subtitle: "58 项可勾选，按收益排序",
    cat: "ebook", kind: "ebook", platforms: ["web"], version: "2026.09",
    size: "4 MB", license: "opensource", downloads: 3560, days: 21,
    tags: ["dev", "opensource", "report"], provider: "baidu", status: "ok",
    summary: "58 项性能优化检查点，按「改动成本 vs 收益」排序，附度量方法。",
    content:
      "每项都写了：改什么、预期收益量级、怎么验证、有什么副作用。避免「为了 0.1 秒牺牲可维护性」。\n\n分五组：网络与资源、渲染路径、JavaScript、图片与字体、缓存策略。\n\n前 12 项通常是性价比最高的，做完一般能拿到 60% 的收益。",
  },
  {
    slug: "mobile-ui-patterns",
    title: "移动端交互模式参考库",
    subtitle: "60 个真实 App 的交互拆解",
    cat: "icon", kind: "material", platforms: ["ios", "android", "web"], version: "v2.2",
    size: "210 MB", license: "free", downloads: 2980, days: 23,
    tags: ["ui", "design", "course"], provider: "quark", status: "invalid",
    summary: "60 个常见交互模式的拆解：手势、导航、空状态、加载、错误恢复。",
    content:
      "每个模式给三样东西：录屏、结构拆解图、什么时候该用/不该用。不是截图集，是决策参考。\n\n覆盖：下拉刷新与上滑加载的取舍、底部导航与侧滑菜单的边界、空状态的五种写法、错误恢复的三条路径。\n\n此资源链接已失效，等待补源。可先看同分类下的其他条目。",
  },
  {
    slug: "markdown-writing-kit",
    title: "Markdown 写作工具包",
    subtitle: "模板 / 快捷键 / 导出配置 一套带走",
    cat: "software", kind: "software", platforms: ["windows", "mac", "linux"], version: "v1.9",
    size: "36 MB", license: "opensource", downloads: 4740, days: 17,
    tags: ["productivity", "dev", "opensource"], provider: "123", status: "ok",
    summary: "写作模板、编辑器配置、导出样式三件套，专注长文写作不断流。",
    content:
      "包含：五种文章结构模板（教程/复盘/评测/清单/观点）、编辑器快捷键配置（Typora / Obsidian / VS Code）、导出用的 CSS 样式。\n\n核心思路是减少「写作时的决策」：标题层级固定、段落长度有约束、图片位置有约定。\n\n导出样式已适配公众号与知乎，粘过去基本不用再调。",
  },
];

async function main() {
  console.log("→ 清空旧数据…");
  await db.delete(downloadEvents);
  await db.delete(favorites);
  await db.delete(reports);
  await db.delete(resourceTags);
  await db.delete(resourceLinks);
  await db.delete(resources);
  await db.delete(tags);
  await db.delete(categories);
  await db.delete(users);

  console.log("→ 写入分类…");
  const catRows = await db
    .insert(categories)
    .values(
      CATEGORIES.map(([slug, name, icon, description, sortOrder]) => ({
        slug,
        name,
        icon,
        description,
        sortOrder,
      })),
    )
    .returning();

  const catMap = new Map(catRows.map((c) => [c.slug, c.id]));

  console.log("→ 写入标签…");
  const tagRows = await db
    .insert(tags)
    .values(TAGS.map(([slug, name]) => ({ slug, name })))
    .returning();
  const tagMap = new Map(tagRows.map((t) => [t.slug, t.id]));
  const tagCount = new Map<number, number>();

  console.log("→ 写入资源…");
  let seq = 0;

  for (const r of RESOURCES) {
    seq += 1;
    const publishedAt = daysAgo(r.days);
    const updatedAt = daysAgo(Math.max(0, r.days - 1));
    const year = publishedAt.getFullYear();

    const [row] = await db
      .insert(resources)
      .values({
        code: `XM-${year}-${String(seq).padStart(4, "0")}`,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        summary: r.summary,
        contentMd: r.content,
        categoryId: catMap.get(r.cat)!,
        kind: r.kind,
        platforms: JSON.stringify(r.platforms),
        version: r.version ?? null,
        sizeLabel: r.size,
        language: "zh-CN",
        licenseLabel: r.license,
        sourceUrl: `https://example.com/source/${r.slug}`,
        sourceNote: "示例来源记录：公开发布页面（仅骨架演示）",
        verifiedAt: updatedAt,
        status: "published",
        isFeatured: r.featured ?? false,
        viewCount: r.downloads * 6,
        downloadCount: r.downloads,
        favoriteCount: Math.round(r.downloads * 0.03),
        publishedAt,
        createdAt: publishedAt,
        updatedAt,
      })
      .returning({ rowId: resources.id });

    const url = `https://pan.${r.provider}.example.com/s/EXAMPLE-${seq
      .toString()
      .padStart(4, "0")}`;

    await db.insert(resourceLinks).values({
      resourceId: row.rowId,
      provider: r.provider,
      url,
      urlHash: hashUrl(url),
      extractCode: seq % 3 === 0 ? null : `m${String(1000 + seq).slice(1)}x`,
      label: "主链接",
      isPrimary: true,
      sortOrder: 0,
      status: r.status ?? "ok",
      checkedAt: daysAgo(r.status === "invalid" ? 30 : 1),
      failCount: r.status === "invalid" ? 4 : 0,
      clickCount: Math.round(r.downloads * 0.8),
    });

    // 每 4 条资源加一个备用链接，演示多网盘
    if (seq % 4 === 0) {
      const backup = `https://pan.baidu.example.com/s/BACKUP-${String(seq).padStart(4, "0")}`;
      await db.insert(resourceLinks).values({
        resourceId: row.rowId,
        provider: "baidu",
        url: backup,
        urlHash: hashUrl(backup),
        extractCode: "bk2x",
        label: "备用",
        isPrimary: false,
        sortOrder: 1,
        status: "ok",
        checkedAt: daysAgo(2),
      });
    }

    for (const t of r.tags) {
      const tagId = tagMap.get(t);
      if (!tagId) continue;
      await db.insert(resourceTags).values({ resourceId: row.rowId, tagId });
      tagCount.set(tagId, (tagCount.get(tagId) ?? 0) + 1);
    }
  }

  console.log("→ 更新标签计数…");
  for (const [tagId, n] of tagCount) {
    await db.update(tags).set({ useCount: n }).where(eq(tags.id, tagId));
  }

  const indexed = reindexAll();
  console.log(`→ 搜索索引：${indexed} 条`);

  console.log(`✓ 完成：${catRows.length} 个分类 / ${RESOURCES.length} 条资源 / ${tagRows.length} 个标签`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
