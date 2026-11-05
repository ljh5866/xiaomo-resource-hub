/**
 * 只铺"骨架"：分类 + 标签，不碰任何资源。
 *   pnpm db:seed:taxonomy
 *
 * 为什么需要它：迁移文件只建表不插数据；`db:seed` 会连演示资源一起塞进去。
 * 上线到干净数据库时，分类是空的 → /c/xxx 直接 404。
 *
 * 幂等 + 会收敛：
 *   - 表里已有的分类/标签：按 slug 保留（名称、图标、描述、排序会被更新成这里的值）
 *   - 表里多出来、且没有任何资源的分类：删除
 *   - 表里多出来、但还有资源的：改成前台隐藏（不删，避免误伤）
 */
import { all, run } from "../db/client";

const CATEGORIES: [slug: string, name: string, icon: string, description: string, order: number][] =
  [
    [
      "software",
      "软件工具",
      "AppWindow",
      "效率工具、系统增强、开发辅助，按平台标注，附版本与校验信息。",
      1,
    ],
    [
      "games",
      "热门游戏",
      "Gamepad2",
      "近期热度高的单机与联机游戏，标注版本、语言与配置要求。",
      2,
    ],
    [
      "mods",
      "游戏 MODS",
      "Puzzle",
      "画质、汉化、玩法扩展类 MOD，注明适配的游戏版本与安装方式。",
      3,
    ],
    [
      "opensource",
      "GitHub 开源项目",
      "Github",
      "值得关注的开源项目与自建服务，附仓库地址与部署难度。",
      4,
    ],
  ];

const TAGS: [slug: string, name: string][] = [
  // 游戏标签：不同游戏各自的 MOD 都靠它归类
  ["minecraft", "我的世界"],
  ["windows", "Windows"],
  ["mac", "macOS"],
  ["android", "Android"],
  ["linux", "Linux"],
  ["green", "绿色免安装"],
  ["portable", "便携版"],
  ["chinese", "汉化"],
  ["crack", "破解补丁"],
  ["mod", "MOD"],
  ["game", "游戏"],
  ["single", "单机"],
  ["online", "联机"],
  ["opensource", "开源"],
  ["github", "GitHub"],
  ["selfhost", "自建服务"],
  ["docker", "Docker"],
  ["free", "免费"],
  ["tool", "工具"],
];

const wantedCats = new Set(CATEGORIES.map((c) => c[0]));
const wantedTags = new Set(TAGS.map((t) => t[0]));

/* ---------- 分类 ---------- */
let catAdded = 0;
let catUpdated = 0;
for (const [slug, name, icon, description, sortOrder] of CATEGORIES) {
  const exists = all<{ n: number }>("SELECT COUNT(*) AS n FROM categories WHERE slug = ?", slug)[0]
    ?.n;

  if (exists) {
    run(
      "UPDATE categories SET name = ?, icon = ?, description = ?, sort_order = ?, is_visible = 1 WHERE slug = ?",
      name,
      icon,
      description,
      sortOrder,
      slug,
    );
    catUpdated += 1;
  } else {
    run(
      "INSERT INTO categories (slug, name, icon, description, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, 1)",
      slug,
      name,
      icon,
      description,
      sortOrder,
    );
    catAdded += 1;
  }
}

let catRemoved = 0;
let catHidden = 0;
for (const row of all<{ id: number; slug: string }>("SELECT id, slug FROM categories")) {
  if (wantedCats.has(row.slug)) continue;

  const used =
    all<{ n: number }>("SELECT COUNT(*) AS n FROM resources WHERE category_id = ?", row.id)[0]?.n ??
    0;

  if (used === 0) {
    run("DELETE FROM categories WHERE id = ?", row.id);
    catRemoved += 1;
  } else {
    run("UPDATE categories SET is_visible = 0 WHERE id = ?", row.id);
    catHidden += 1;
  }
}

/* ---------- 标签 ---------- */
let tagAdded = 0;
for (const [slug, name] of TAGS) {
  const exists = all<{ n: number }>("SELECT COUNT(*) AS n FROM tags WHERE slug = ?", slug)[0]?.n;
  if (exists) {
    run("UPDATE tags SET name = ? WHERE slug = ?", name, slug);
  } else {
    run("INSERT INTO tags (slug, name, use_count) VALUES (?, ?, 0)", slug, name);
    tagAdded += 1;
  }
}

let tagRemoved = 0;
for (const row of all<{ id: number; slug: string }>("SELECT id, slug FROM tags")) {
  if (wantedTags.has(row.slug)) continue;
  const used =
    all<{ n: number }>("SELECT COUNT(*) AS n FROM resource_tags WHERE tag_id = ?", row.id)[0]?.n ??
    0;
  if (used === 0) {
    run("DELETE FROM tags WHERE id = ?", row.id);
    tagRemoved += 1;
  }
}

const cats = all<{ n: number }>("SELECT COUNT(*) AS n FROM categories")[0]?.n ?? 0;
const tags = all<{ n: number }>("SELECT COUNT(*) AS n FROM tags")[0]?.n ?? 0;

console.log(
  `✓ 分类 ${cats} 个（新增 ${catAdded} / 更新 ${catUpdated} / 删除 ${catRemoved} / 隐藏 ${catHidden}）`,
);
console.log(`✓ 标签 ${tags} 个（新增 ${tagAdded} / 删除 ${tagRemoved}）`);
console.log("  资源数量未改动；下一步可以导入自己的内容。");
