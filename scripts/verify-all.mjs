/**
 * 本地全量自检（部署前跑这一个就够）
 *   node scripts/verify-all.mjs
 *
 * 依次执行：
 *   typecheck → 单测 → 构建 → 种子数据 → 起临时服务(3101) →
 *   全部 e2e → 冒烟 → 性能 → 三断点视觉 → 后台逐页自检 → 收尾
 *
 * 全程不会碰生产服务器；跑完把临时服务关掉。
 */
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
let server = null;

function record(name, ok, detail = "", ms = null) {
  results.push({ name, ok, detail, ms });
  const mark = ok ? "\x1b[38;5;108m✓\x1b[0m" : "\x1b[38;5;203m✗\x1b[0m";
  console.log(`${mark} ${name}${detail ? `  — ${detail}` : ""}${ms != null ? `  (${ms}s)` : ""}`);
}

function run(name, cmd, args, opts = {}) {
  const t0 = Date.now();
  const res = spawnSync(cmd, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...(opts.env ?? {}) },
    timeout: opts.timeout ?? 600_000,
  });
  const ms = Math.round((Date.now() - t0) / 1000);
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const ok = res.status === 0;
  record(name, ok, ok ? (opts.hint ?? "") : out.split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 220), ms);
  return { ok, out };
}

async function waitHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {
      /* 还没起来 */
    }
    await sleep(500);
  }
  return false;
}

function stopServer() {
  if (!server) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
  server = null;
}

console.log(`\n本地全量自检（临时服务 :${PORT}）\n`);

/* 1. 静态检查 */
run("类型检查", "pnpm", ["typecheck"]);
run("单元测试", "pnpm", ["test"]);

/* 2. 构建 */
const build = run("构建", "pnpm", ["build"]);
if (!build.ok) {
  console.error("\n构建失败，后续检查没有意义，已中止。");
  process.exit(1);
}

/* 3. 种子数据（演示资源 + 4 个分类 + 本地管理员） */
run("种子数据", "pnpm", ["db:seed"], { hint: "24 条演示资源，本地专用" });
run("分类标签收敛", "pnpm", ["db:seed:taxonomy"], { hint: "4 分类 / 18 标签" });
run("本地管理员", "node", ["node_modules/tsx/dist/cli.mjs", "src/scripts/add-user.ts", "admin@xiaomo.local", "xiaomo2026", "--admin"], {
  hint: "db:seed 会清空 users，这里补回来",
});

/* 4. 起临时服务（直接用 node 跑 next start，避开 pnpm/shell 转义问题） */
console.log(`\n启动临时服务 :${PORT} ...`);
const logFile = "verify-server.log";
const logFd = (await import("node:fs")).openSync(logFile, "w");
server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  stdio: ["ignore", logFd, logFd],
  shell: false,
});

const healthy = await waitHealth();
record("服务启动", healthy, healthy ? BASE : "健康检查超时");

if (!healthy) {
  stopServer();
  process.exit(1);
}

/* 5. e2e（全部指向 3101） */
const e2e = [
  "test-auth.mjs",
  "test-revoke.mjs",
  "test-guards.mjs",
  "test-pagination.mjs",
  "test-report.mjs",
  "test-submit.mjs",
  "test-seo.mjs",
  "test-og.mjs",
  "test-import.mjs",
  "test-register.mjs",
  "test-admin-tools.mjs",
];

for (const file of e2e) {
  run(file.replace(".mjs", ""), "node", [`scripts/${file}`], { env: { BASE_URL: BASE } });
}

/* 6. 冒烟 / 性能 / 视觉 */
run("冒烟检查", "node", ["scripts/smoke.mjs"], { env: { BASE_URL: BASE } });
run("性能预算", "node", ["scripts/perf.mjs"], { env: { BASE_URL: BASE } });
run("三断点视觉", "node", ["scripts/shot.mjs"], { env: { BASE_URL: BASE } });

/* 7. 后台逐页自检（本地用默认管理员） */
run("后台逐页自检", "node", ["scripts/audit-prod.mjs"], {
  env: {
    FRONT: BASE,
    ADMIN: BASE,
    AUDIT_EMAIL: process.env.AUDIT_EMAIL ?? "admin@xiaomo.local",
    AUDIT_PASS: process.env.AUDIT_PASS ?? "xiaomo2026",
  },
});

stopServer();

/* 8. 汇总 */
const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
const totalMs = results.reduce((s, r) => s + (r.ms ?? 0), 0);

console.log(`\n────────────────────────────`);
console.log(`共 ${results.length} 项：通过 ${pass}，失败 ${fail.length}，总耗时 ${totalMs}s`);
if (fail.length) {
  console.error(`\n失败项：\n${fail.map((f) => `  · ${f.name} — ${f.detail}`).join("\n")}`);
  process.exit(1);
}
console.log("✓ 全部通过，可以部署");
