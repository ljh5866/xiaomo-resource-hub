/**
 * 部署演练（本地能演练的部分）：
 *   1. 部署物料完整性（systemd 单元 / Caddyfile / deploy.sh 的关键指令）
 *   2. 环境变量体检（AUTH_SECRET 长度、SITE_URL、占位值提醒）
 *   3. 备份 → 恢复演练（拿备份覆盖临时库，比对表计数）
 *   4. 分享图依赖：中文字体是否可用
 *
 *   node scripts/drill-deploy.mjs
 *
 * 真机上的部分（systemctl / caddy / 证书 / 健康检查）无法在 Windows 演练，
 * 会在最后打印成「需要在服务器执行」的清单。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";

const results = [];
const ok = (name, detail) => results.push({ name, status: "PASS", detail });
const warn = (name, detail) => results.push({ name, status: "WARN", detail });
const fail = (name, detail) => results.push({ name, status: "FAIL", detail });

/* ---------- 1. 部署物料 ---------- */
{
  const checks = [
    ["deploy/xiaomo.service", ["ExecStart", "Restart=always", "WorkingDirectory"]],
    ["deploy/xiaomo-maintenance.service", ["links:check", "backup.mjs", "covers:gc"]],
    ["deploy/xiaomo-maintenance.timer", ["OnCalendar", "Persistent=true"]],
    ["deploy/Caddyfile", ["reverse_proxy", "health_uri", "encode"]],
    ["deploy/deploy.sh", ["git pull", "db:migrate", "pnpm build", "systemctl restart"]],
  ];

  let missing = [];
  for (const [file, needles] of checks) {
    if (!fs.existsSync(file)) {
      missing.push(`${file} 不存在`);
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    for (const n of needles) {
      if (!text.includes(n)) missing.push(`${file} 缺少 ${n}`);
    }
  }

  if (missing.length) fail("部署物料", missing.join("；"));
  else ok("部署物料", `${checks.length} 个文件，关键指令齐全`);
}

/* ---------- 2. 环境变量 ---------- */
{
  const envPath = ".env";
  if (!fs.existsSync(envPath)) {
    fail("环境变量", ".env 不存在（cp .env.example .env）");
  } else {
    const env = Object.fromEntries(
      fs
        .readFileSync(envPath, "utf8")
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );

    const issues = [];
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) issues.push("AUTH_SECRET 少于 32 位");
    if ((env.AUTH_SECRET ?? "").includes("change-me")) issues.push("AUTH_SECRET 还是示例值");
    if (!env.SITE_URL) issues.push("SITE_URL 缺失");
    if ((env.SITE_URL ?? "").includes("localhost") || (env.SITE_URL ?? "").includes("127.0.0.1")) {
      issues.push("SITE_URL 还是本地地址（上线前改成域名）");
    }

    if (issues.some((i) => i.includes("少于") || i.includes("缺失"))) fail("环境变量", issues.join("；"));
    else if (issues.length) warn("环境变量", issues.join("；"));
    else ok("环境变量", "AUTH_SECRET 长度足够，SITE_URL 已配置");
  }
}

/* ---------- 3. 备份 → 恢复演练 ---------- */
{
  const db = "data/app.db";
  if (!fs.existsSync(db)) {
    fail("备份恢复", "data/app.db 不存在");
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xiaomo-drill-"));
    try {
      const before = new DatabaseSync(db);
      const counts = before
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM resources) AS resources,
             (SELECT COUNT(*) FROM resource_links) AS links,
             (SELECT COUNT(*) FROM categories) AS categories,
             (SELECT COUNT(*) FROM tags) AS tags,
             (SELECT COUNT(*) FROM users) AS users`,
        )
        .get();
      before.close();

      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const outDir = path.join(tmp, stamp);
      execSync(`node scripts/backup.mjs --keep 3`, { stdio: "pipe" });

      const backupsRoot = "data/backups";
      const latest = fs
        .readdirSync(backupsRoot)
        .filter((d) => fs.statSync(path.join(backupsRoot, d)).isDirectory())
        .sort()
        .reverse()[0];

      const snapshot = path.join(backupsRoot, latest, "app.db");
      if (!fs.existsSync(snapshot)) throw new Error("备份里没有 app.db");

      // 把备份恢复到临时位置，验证可用且数据一致
      const restoredPath = path.join(outDir, "restored.db");
      fs.mkdirSync(outDir, { recursive: true });
      fs.copyFileSync(snapshot, restoredPath);

      const after = new DatabaseSync(restoredPath);
      const restored = after
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM resources) AS resources,
             (SELECT COUNT(*) FROM resource_links) AS links,
             (SELECT COUNT(*) FROM categories) AS categories,
             (SELECT COUNT(*) FROM tags) AS tags,
             (SELECT COUNT(*) FROM users) AS users`,
        )
        .get();
      // 恢复后能正常查询才算真的可用
      const probe = after
        .prepare("SELECT COUNT(*) AS n FROM resources WHERE status = 'published'")
        .get();
      after.close();

      const same = ["resources", "links", "categories", "tags", "users"].every(
        (k) => String(counts[k]) === String(restored[k]),
      );

      if (same) {
        ok(
          "备份恢复",
          `快照 ${latest}：resources=${restored.resources} links=${restored.links} categories=${restored.categories}，查询可用（published=${probe.n}）`,
        );
      } else {
        fail("备份恢复", `计数不一致：原 ${JSON.stringify(counts)} vs 恢复 ${JSON.stringify(restored)}`);
      }
    } catch (e) {
      fail("备份恢复", String(e.message).slice(0, 160));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

/* ---------- 4. 中文字体（分享图依赖） ---------- */
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80">
    <text x="10" y="55" font-family="Microsoft YaHei, Noto Sans CJK SC, SimSun, sans-serif"
          font-size="40" fill="#fff">中文测试</text>
  </svg>`;

  try {
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(buf).metadata();

    let fontCount = null;
    if (os.platform() !== "win32") {
      try {
        const list = execSync("fc-list :lang=zh 2>/dev/null | wc -l", { encoding: "utf8" }).trim();
        fontCount = Number(list);
      } catch {
        fontCount = null;
      }
    }

    if (fontCount === 0) {
      warn("中文字体", "fc-list 找不到中文字体，分享图里的中文会变成方块（装 fonts-noto-cjk）");
    } else {
      ok(
        "中文字体",
        `渲染成功 ${meta.width}×${meta.height}${fontCount ? `，系统中文族 ${fontCount} 个` : ""}`,
      );
    }
  } catch (e) {
    fail("中文字体", String(e.message).slice(0, 120));
  }
}

/* ---------- 报告 ---------- */
console.log("\n部署演练（本地可验证的部分）\n");
for (const r of results) {
  const mark = r.status === "PASS" ? "✓" : r.status === "WARN" ? "!" : "✗";
  console.log(`${mark} ${r.name}：${r.detail}`);
}

const failed = results.filter((r) => r.status === "FAIL");

console.log(`
需要在服务器上做的（本地无法演练）：
  1. cp deploy/*.service deploy/*.timer /etc/systemd/system/ && systemctl daemon-reload
  2. cp deploy/Caddyfile /etc/caddy/Caddyfile（改域名）&& systemctl reload caddy
  3. systemctl enable --now xiaomo xiaomo-maintenance.timer
  4. curl -fsS https://<域名>/api/health   ← 期望 {"ok":true,...}
  5. apt install -y fonts-noto-cjk         ← 分享图的中文依赖
  6. 上传一次封面 + 导入一条资源，确认 data/ 目录权限对 www-data 可写
`);

if (failed.length) {
  console.error(`✗ ${failed.length} 项失败`);
  process.exit(1);
}
console.log("✓ 演练通过（没有 FAIL；WARN 项上线前处理即可）");
