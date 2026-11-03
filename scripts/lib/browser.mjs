import { chromium } from "playwright-core";

/**
 * 验收脚本共用：浏览器与站点地址都可从环境变量覆盖。
 *   BASE_URL=http://127.0.0.1:3100
 *   BROWSER_PATH="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
 *
 * CI 里不设 BROWSER_PATH，回落到 playwright 自带的 chromium。
 */
export const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";

const LOCAL_EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export function launch(options = {}) {
  const executablePath = process.env.BROWSER_PATH || LOCAL_EDGE;
  return chromium.launch({ executablePath, headless: true, ...options });
}

export const CREDENTIALS = {
  email: process.env.TEST_EMAIL ?? "admin@xiaomo.local",
  password: process.env.TEST_PASSWORD ?? "xiaomo2026",
};
