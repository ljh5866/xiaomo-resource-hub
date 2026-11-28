/**
 * 网盘登录态（本地）。
 *
 * 桌面端不依赖站点服务器取 cookie：
 *  ① 「从浏览器导入」直接读本机 Chrome/Edge/Firefox 的 cookie（Rust 侧 DPAPI 解密）
 *  ② 读不到就手动粘贴
 * 拿到后存本地，解析网盘时由本机直接请求，不经过服务器。
 */

const KEY = "xm.pan.cookie.";

export type BrowserInfo = {
  id: string;
  name: string;
  kind: string;
  db_paths: string[];
};

export type ImportResult = {
  browser: string;
  cookie: string;
  count: number;
  skipped_v20: number;
};

export type PanProvider = "quark" | "uc" | "baidu" | "xunlei" | "115";

export const PAN_DOMAINS: Record<PanProvider, string[]> = {
  quark: [".quark.cn"],
  uc: [".uc.cn"],
  baidu: [".baidu.com"],
  xunlei: [".xunlei.com"],
  "115": [".115.com", ".115cdn.com"],
};

export const PAN_NAMES: Record<PanProvider, string> = {
  quark: "夸克网盘",
  uc: "UC 网盘",
  baidu: "百度网盘",
  xunlei: "迅雷云盘",
  "115": "115 网盘",
};

const IN_TAURI =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export function inTauri(): boolean {
  return IN_TAURI;
}

/** 列出本机装了哪些浏览器（能找到 cookie 库的） */
export async function scanBrowsers(): Promise<BrowserInfo[]> {
  if (!IN_TAURI) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<BrowserInfo[]>("scan_browsers");
}

/** 从某个浏览器导入指定网盘域的 cookie */
export async function importBrowserCookies(
  browserId: string,
  provider: PanProvider,
): Promise<ImportResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ImportResult>("import_browser_cookies", {
    browserId,
    domains: PAN_DOMAINS[provider],
  });
}

export function savePanCookie(provider: PanProvider, cookie: string) {
  localStorage.setItem(KEY + provider, cookie);
}

export function getPanCookie(provider: PanProvider): string | null {
  return localStorage.getItem(KEY + provider);
}

export function clearPanCookie(provider: PanProvider) {
  localStorage.removeItem(KEY + provider);
}

/** 粗略判断 cookie 里有没有网盘的关键字段 */
export function looksLikePanCookie(provider: PanProvider, cookie: string): boolean {
  if (!cookie.trim()) return false;
  const need: Record<PanProvider, string[]> = {
    quark: ["__pus", "__puus"],
    uc: ["__pus", "__puus"],
    baidu: ["BDUSS"],
    xunlei: ["sub", "pan.xunlei"],
    "115": ["UID", "CID"],
  };
  return need[provider].some((k) => cookie.includes(k));
}

/** 各网盘的登录页/首页（内嵌窗口打开这个） */
export const PAN_LOGIN_URL: Record<PanProvider, string> = {
  quark: "https://pan.quark.cn/",
  uc: "https://drive.uc.cn/",
  baidu: "https://pan.baidu.com/",
  xunlei: "https://pan.xunlei.com/",
  "115": "https://115.com/",
};

/**
 * 打开内嵌登录窗口，等用户在窗口里扫码登录后点「完成登录」。
 * 返回拿到的 cookie（失败返回 null）。
 */
export async function openPanLogin(
  provider: PanProvider,
  timeoutMs = 5 * 60_000,
): Promise<string | null> {
  if (!IN_TAURI) return null;
  const { invoke } = await import("@tauri-apps/api/core");

  await invoke("open_pan_login", {
    url: PAN_LOGIN_URL[provider],
    title: `登录 ${PAN_NAMES[provider]}`,
  });

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1200));
    const picked = await invoke<{ cookie: string; host: string } | null>("take_pan_cookie");
    if (picked?.cookie) {
      // 关键：只隐藏不关闭 —— 关掉就丢登录态，后续转存/取链还要用这个页面
      await invoke("hide_pan_login");
      return picked.cookie;
    }
  }
  return null;
}

/** 网盘窗口是否还活着（活着才有 httpOnly 登录态） */
export async function panWindowAlive(): Promise<boolean> {
  if (!IN_TAURI) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("pan_window_alive");
}

/** 让应用里开着的网盘窗口重新显形（用户手动关了就只能重新登录） */
export async function reopenPanWindow(provider: PanProvider): Promise<void> {
  if (!IN_TAURI) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_pan_login", {
    url: PAN_LOGIN_URL[provider],
    title: `登录 ${PAN_NAMES[provider]}`,
  });
}
