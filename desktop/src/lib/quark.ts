/**
 * 夸克分享解析（本机直连，Rust 侧发请求，cookie 不出本机）。
 */
import { getPanCookie, inTauri } from "./pan";

export type PanFile = {
  fid: string;
  name: string;
  size: number;
  is_dir: boolean;
  fid_token: string;
  updated_at: number;
};

export type ShareListing = {
  title: string | null;
  total: number;
  files: PanFile[];
  cookie_names: string[];
};

/** 从分享链接里提取 pwd_id 和提取码 */
export function parseQuarkUrl(url: string): { shareId: string; passcode: string } | null {
  const m = url.match(/pan\.quark\.cn\/s\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const shareId = m[1];
  // 提取码可能在 ?pwd= 或 #pwd=
  const p = url.match(/[?#].*?pwd=([A-Za-z0-9]{4})/);
  return { shareId, passcode: p?.[1] ?? "" };
}

export function fmtSize(n: number): string {
  if (!n) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)}${u[i]}`;
}

const invokeCmd = async <T>(cmd: string, args: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
};

/** 拿到 stoken（顺带验证 cookie 是否有效） */
export async function quarkToken(shareId: string, passcode: string): Promise<string> {
  const cookie = getPanCookie("quark") ?? "";
  if (!cookie) throw new Error("还没登录夸克网盘，先在侧栏「网盘登录」里扫码");
  if (!inTauri()) throw new Error("解析只能在桌面端里用");
  return invokeCmd<string>("quark_share_token", { shareId, passcode, cookie });
}

/** 列目录 */
export async function quarkList(
  shareId: string,
  stoken: string,
  pdirFid = "0",
): Promise<ShareListing> {
  const cookie = getPanCookie("quark") ?? "";
  return invokeCmd<ShareListing>("quark_share_list", {
    shareId,
    stoken,
    pdirFid,
    cookie,
  });
}

/** 一步到位：链接 → 文件列表 */
export async function resolveQuarkShare(url: string): Promise<{
  shareId: string;
  passcode: string;
  stoken: string;
  listing: ShareListing;
}> {
  const parsed = parseQuarkUrl(url);
  if (!parsed) throw new Error("这不是夸克分享链接");
  const stoken = await quarkToken(parsed.shareId, parsed.passcode);
  const listing = await quarkList(parsed.shareId, stoken);
  return { ...parsed, stoken, listing };
}

export type DirectLink = { url: string; file_name: string; size: number };

/**
 * 转存 + 取直链 —— **在网盘窗口的页面里执行**。
 * 因为夸克转存需要 httpOnly 的 `__pus`，页面外拿不到（会返回 require login [guest] 31001）。
 */
export async function panWebDirect(
  shareId: string,
  stoken: string,
  file: PanFile,
): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("pan_web_direct", {
    shareId,
    stoken,
    fid: file.fid,
    fidToken: file.fid_token,
    fileName: file.name,
  });
}

/** 轮询页面回传的结果：成功给 url，失败给 err */
export async function waitPanDirect(
  timeoutMs = 90_000,
): Promise<{ url: string; name: string; fid: string; err: string } | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 900));
    const r = await invoke<{ url: string; name: string; fid: string; err: string } | null>(
      "take_pan_direct",
    );
    if (r && (r.url || r.err)) return r;
  }
  return null;
}

/** 下载完成后清理转存文件（在网盘页面里删） */
export async function panWebDelete(fids: string[]): Promise<void> {
  const clean = fids.filter(Boolean);
  if (!clean.length) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("pan_web_delete", { fids: clean }).catch(() => {});
}

const CONN_KEY = "xm.dl.conns";

/** 连接数（夸克按连接限速，越大越快；太多会被风控） */
export function getConns(): number {
  const v = Number(localStorage.getItem(CONN_KEY) ?? "");
  return Number.isFinite(v) && v >= 1 ? Math.min(128, v) : 16;
}

export function setConns(n: number) {
  localStorage.setItem(CONN_KEY, String(Math.max(1, Math.min(128, Math.floor(n)))));
}

/** 直链 → 分片并发下载到本地下载目录，返回保存路径 */
export async function quarkDownload(
  url: string,
  fileName: string,
  conns?: number,
): Promise<string> {
  const cookie = getPanCookie("quark") ?? "";
  return invokeCmd<string>("pan_download_chunked", {
    url,
    fileName,
    cookie,
    conns: conns ?? getConns(),
  });
}

export type DlTick = { got: number; total: number; done: number; chunks: number };

/** 订阅下载进度（返回取消函数） */
export async function onDownloadProgress(cb: (p: DlTick) => void): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<DlTick>("pan-download", (e) => {
    if (e.payload) cb(e.payload);
  });
  return un;
}
