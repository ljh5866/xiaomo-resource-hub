/**
 * 站点配置：所有会变的文案、导航、区块标题集中在这里。
 * 改文案 → 只改这个文件，不动页面组件。
 */

export const site = {
  name: "小莫资源网",
  latin: "XIAOMO INDEX",
  seal: "莫",
  tagline: "认真归档的好用资源",
  baseUrl: process.env.SITE_URL ?? "http://localhost:3100",

  seo: {
    title: "小莫资源网 · 软件、游戏与开源项目索引",
    description:
      "小莫资源网：软件工具、热门游戏、游戏 MODS、GitHub 开源项目的索引站。每条下载链接标注校验时间，失效即降权，让找资源这件事三秒结束。",
    keywords: [
      "资源下载",
      "资源站",
      "软件下载",
      "游戏下载",
      "游戏mod",
      "开源项目",
      "网盘资源",
    ],
  },

  nav: [
    { href: "/c/software", label: "分类", desktopOnly: true },
    { href: "/updates", label: "每日更新", desktopOnly: true },
    { href: "/login", label: "登录" },
  ],

  footer: {
    blurb:
      "只做索引，不做托管。每条链接标注最近校验时间，失效即降权并在修复后恢复。",
    links: [
      { href: "/about", label: "关于" },
      { href: "/about#source", label: "来源说明" },
      { href: "/updates", label: "每日更新" },
      { href: "/submit", label: "投稿" },
      { href: "/rss.xml", label: "RSS" },
      { href: "/about#report", label: "举报失效" },
    ],
    legal: "本站仅收录公开发布的资源信息，如涉权利问题请通过「来源说明」页联系下架。",
  },

  hero: {
    eyebrow: "编号归档",
    titleLines: ["找资源，", "别再翻十个网盘。"],
    lead: "软件、游戏、MOD、开源项目，逐条编号归档。每条下载链接都标注最近校验时间——",
    leadEmphasis: "失效的会被标出来，而不是悄悄消失。",
    hotLabel: "热门：",
    hotKeywords: ["效率工具", "单机游戏", "汉化 MOD", "开源项目", "Docker", "绿色免安装"],
  },

  sections: {
    categories: { title: "按分类找", more: "查看全部", moreHref: "/updates" },
    featured: { title: "本周精选", note: "编辑策展，每周一更新" },
    latest: { title: "最新收录", note: "按上架时间", more: "查看全部", moreHref: "/updates" },
    tags: { title: "热门标签", note: "按使用次数" },
  },

  trust: {
    total: "已归档资源",
    dead: "链接死链率",
    fresh: "本周更新",
  },

  search: {
    header: "搜索资源、编号、标签…",
    hero: (n: string) => `搜索 ${n} 个资源…`,
    page: "搜索资源…",
  },

  /** 分类图标与显示顺序在 DB 里；这里只放展示层的补充配置 */
  categoryHints: {
    software: "效率工具、系统增强、开发辅助",
    template: "Excel / PPT / Word / Notion 模板",
    material: "图片、视频、音频、工程文件",
    course: "成体系课程与实操教程",
    font: "中英文字体与可变字体",
    icon: "图标库、插画包、UI 组件",
    ebook: "技术书、行业报告、手册",
  } as Record<string, string>,
} as const;

export type SiteConfig = typeof site;
