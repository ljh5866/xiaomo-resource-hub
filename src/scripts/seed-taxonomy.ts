/**
 * 只铺"骨架"：7 个分类 + 18 个标签，不碰任何资源。
 *   pnpm db:seed:taxonomy
 *
 * 为什么需要它：迁移文件只建表，不插数据；`db:seed` 会连 24 条演示资源一起塞进去。
 * 上线到干净数据库时，分类是空的 → /c/template 直接 404。
 *
 * 幂等：按 slug 冲突就跳过（INSERT OR IGNORE）。
 */
import { all, run } from "../db/client";

const CATEGORIES: [slug: string, name: string, icon: string, description: string, order: number][] =
  [
    ["software", "软件工具", "AppWindow", "效率工具、系统增强、开发辅助，按平台标注。", 1],
    ["template", "模板文档", "LayoutTemplate", "Excel / PPT / Word / Notion 模板，开箱即用。", 2],
    ["material", "设计素材", "Palette", "图片、视频、音频、工程文件，注明用途与授权。", 3],
    ["course", "教程课程", "GraduationCap", "成体系的课程与实操教程，标注时长与难度。", 4],
    ["font", "字体字库", "Type", "中英文字体与可变字体，商用授权单独注明。", 5],
    ["icon", "图标插画", "Shapes", "图标库、插画包、UI 组件资源。", 6],
    ["ebook", "电子书", "BookOpen", "技术书、行业报告、手册文档。", 7],
  ];

const TAGS: [slug: string, name: string][] = [
  ["excel", "Excel"],
  ["ppt", "PPT"],
  ["notion", "Notion"],
  ["design", "设计"],
  ["video", "视频剪辑"],
  ["audio", "音频"],
  ["font", "字体"],
  ["icon", "图标"],
  ["productivity", "效率"],
  ["dev", "开发"],
  ["windows", "Windows"],
  ["mac", "macOS"],
  ["course", "课程"],
  ["free", "免费"],
  ["opensource", "开源"],
  ["report", "报告"],
  ["ui", "UI 设计"],
  ["template", "模板"],
];

let catAdded = 0;
for (const [slug, name, icon, description, sortOrder] of CATEGORIES) {
  const before = all<{ n: number }>("SELECT COUNT(*) AS n FROM categories WHERE slug = ?", slug)[0]
    ?.n;
  run(
    "INSERT OR IGNORE INTO categories (slug, name, icon, description, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, 1)",
    slug,
    name,
    icon,
    description,
    sortOrder,
  );
  if (!before) catAdded += 1;
}

let tagAdded = 0;
for (const [slug, name] of TAGS) {
  const before = all<{ n: number }>("SELECT COUNT(*) AS n FROM tags WHERE slug = ?", slug)[0]?.n;
  run("INSERT OR IGNORE INTO tags (slug, name, use_count) VALUES (?, ?, 0)", slug, name);
  if (!before) tagAdded += 1;
}

const cats = all<{ n: number }>("SELECT COUNT(*) AS n FROM categories")[0]?.n ?? 0;
const tags = all<{ n: number }>("SELECT COUNT(*) AS n FROM tags")[0]?.n ?? 0;

console.log(`✓ 分类 ${cats} 个（新增 ${catAdded}） / 标签 ${tags} 个（新增 ${tagAdded}）`);
console.log("  资源数量未改动；下一步可以导入自己的内容。");
