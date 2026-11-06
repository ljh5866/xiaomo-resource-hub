/**
 * 网盘解析 provider 接口。
 *
 * 约束：站内只解析「已经收录在库里的链接」，不接受任意 URL —— 入口是 linkId，
 * 服务端自己从数据库取出 url/provider，前端无法构造别家链接来蹭解析。
 */

export type PanProvider = "quark" | "baidu" | "uc" | "xunlei";

export const PAN_PROVIDERS: PanProvider[] = ["quark", "baidu", "uc", "xunlei"];

export function isPanProvider(v: string | null | undefined): v is PanProvider {
  return !!v && (PAN_PROVIDERS as string[]).includes(v);
}

export type PanFile = {
  fid: string;
  name: string;
  size: number;
  isDir: boolean;
  /** 传给 directLink 的令牌（各平台不同：夸克 share_fid_token / 百度 fs_id …） */
  token?: string | null;
  updatedAt?: number | null;
};

export type PanShare = {
  provider: PanProvider;
  /** 平台侧的分享 id */
  shareId: string;
  /** 访问分享用的临时令牌 */
  stoken?: string | null;
  title?: string | null;
  files: PanFile[];
  total: number;
  /** 是否需要登录态才能进一步取直链（几乎都需要） */
  needsLogin: boolean;
};

export type PanDirect = {
  url: string;
  /** 直链有效期（秒），null 表示平台未给出 */
  expiresIn: number | null;
  fileName: string;
  size: number;
  /** 部分平台直链绑定 UA / 需要 Referer，前台展示时要提示 */
  headers?: Record<string, string>;
};

export type PanError =
  | { code: "no-credential"; message: string }
  | { code: "share-invalid"; message: string }
  | { code: "need-passcode"; message: string }
  | { code: "passcode-wrong"; message: string }
  | { code: "rate-limited"; message: string }
  | { code: "upstream"; message: string };

export class PanFail extends Error {
  code: PanError["code"];
  constructor(code: PanError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** 从各种形式的分享 URL 里抽出 shareId + 提取码 */
export type ParsedShare = { shareId: string; passcode: string };

export const SHARE_PARSERS: Record<PanProvider, (url: string, code?: string | null) => ParsedShare | null> = {
  quark: (url, code) => {
    const m = url.match(/pan\.quark\.cn\/s\/([0-9A-Za-z]+)/);
    if (!m) return null;
    const pwd = code?.trim() || new URL(url).searchParams.get("pwd") || "";
    return { shareId: m[1], passcode: pwd };
  },
  uc: (url, code) => {
    const m = url.match(/drive\.uc\.cn\/s\/([0-9A-Za-z]+)/);
    if (!m) return null;
    const pwd = code?.trim() || new URL(url).searchParams.get("pwd") || "";
    return { shareId: m[1], passcode: pwd };
  },
  baidu: (url, code) => {
    const m = url.match(/pan\.baidu\.com\/s\/([0-9A-Za-z_-]+)/);
    if (!m) return null;
    const pwd = code?.trim() || new URL(url).searchParams.get("pwd") || "";
    return { shareId: m[1], passcode: pwd };
  },
  xunlei: (url, code) => {
    const m = url.match(/pan\.xunlei\.com\/s\/([0-9A-Za-z_-]+)/);
    if (!m) return null;
    const pwd = code?.trim() || new URL(url).searchParams.get("pwd") || "";
    return { shareId: m[1], passcode: pwd };
  },
};
