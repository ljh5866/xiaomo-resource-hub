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

/** 转存 + 取直链 */
export async function quarkDirect(
  shareId: string,
  stoken: string,
  file: PanFile,
): Promise<DirectLink> {
  const cookie = getPanCookie("quark") ?? "";
  return invokeCmd<DirectLink>("quark_share_direct", {
    shareId,
    stoken,
    fid: file.fid,
    fidToken: file.fid_token,
    fileName: file.name,
    size: file.size,
    cookie,
  });
}

/** 直链 → 下载到本地下载目录，返回保存路径 */
export async function quarkDownload(
  url: string,
  fileName: string,
): Promise<string> {
  const cookie = getPanCookie("quark") ?? "";
  return invokeCmd<string>("quark_download_file", { url, fileName, cookie });
}

/** 订阅下载进度（返回取消函数） */
export async function onDownloadProgress(
  cb: (got: number, total: number) => void,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<[number, number]>("pan-download", (e) => {
    const [got, total] = e.payload ?? [0, 0];
    cb(got, total);
  });
  return un;
}
