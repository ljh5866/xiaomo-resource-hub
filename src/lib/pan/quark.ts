/**
 * 夸克网盘（含 UC，两者同一套 clouddrive 路由，见 uc.ts）。
 *
 * 链路（照 YunX-Desktop 的 QuarkConstants 实现）：
 *   sharepage/token   pwd_id + passcode → stoken        （匿名可调）
 *   sharepage/detail  stoken + pdir_fid → 文件列表       （匿名可调）
 *   sharepage/save    转存到自己的网盘                   （需要 Cookie）
 *   file/download     已转存 fid → 下载直链              （需要 Cookie）
 *   CDN 直链          必须带同一个 Cookie，否则 412
 *
 * 所有需要登录态的入口都显式接收 cookie 字符串 —— 由调用方决定用「用户自己的」
 * 还是「站点账号的」，本模块不碰 process.env。
 */
import { setDefaultResultOrder } from "node:dns";
import { PanFail, type PanDirect, type PanFile, type PanShare } from "./types";
import { panRequest } from "./http";

/**
 * 香港服务器上 Node 的 fetch 会优先连 IPv6，而到夸克 CDN 的 IPv6 不通 → ETIMEDOUT。
 * curl 有 Happy Eyeballs 会自动回退 IPv4，所以命令行测着是好的，只有 Node 挂。
 */
setDefaultResultOrder("ipv4first");

const API = "https://drive-pc.quark.cn";
const REFERER = "https://pan.quark.cn/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "quark-cloud-drive/3.23.2 Chrome/112.0.5615.165 Electron/24.1.3.8 Safari/537.36";

/** 站点自己的夸克账号（.env），作为用户未绑定时的回退 */
export function siteCookie(): string {
  return (process.env.QUARK_COOKIE ?? "").trim();
}

export function hasSiteCredential(): boolean {
  return siteCookie().length > 0;
}

/** 访问夸克 CDN 直链时必须带的头（实测：不带 Cookie 一律 412） */
export function quarkCdnHeaders(
  range: string | null | undefined,
  cookie: string,
): Record<string, string> {
  const h: Record<string, string> = { "user-agent": UA, referer: REFERER };
  if (cookie) h.cookie = cookie;
  if (range) h.range = range;
  return h;
}

/** 把多个 Set-Cookie 段落合并成一个 Cookie 头 */
export function mergeCookies(a: string, b: string): string {
  const jar = new Map<string, string>();
  for (const part of `${a};${b}`.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    jar.set(t.slice(0, eq), t.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** 从响应头里抽 Set-Cookie 并拼成 Cookie 头 */
export function collectSetCookies(headers: Headers): string {
  const raw =
    typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (headers as { getSetCookie: () => string[] }).getSetCookie()
      : [headers.get("set-cookie") ?? ""];
  const jar = new Map<string, string>();
  for (const line of raw) {
    for (const part of line.split(/,(?=[^;]+=)/)) {
      const first = part.split(";")[0]?.trim();
      if (!first) continue;
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      jar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * 验证 Cookie 并顺手「激活」它：先请求一次首页，让夸克补发业务 cookie，
 * 再请求 account/info 拿昵称。返回合并后的完整 cookie。
 */
export async function verifyCookie(
  cookie: string,
): Promise<{ cookie: string; nickname: string } | null> {
  let jar = cookie;

  const home = await panRequest("https://pan.quark.cn/", {
    headers: { "user-agent": UA, cookie: jar, referer: REFERER },
  }).catch(() => null);
  if (home?.headers["set-cookie"]) {
    jar = mergeCookies(jar, collectSetCookies(new Headers({ "set-cookie": home.headers["set-cookie"] })));
  }

  const res = await panRequest("https://pan.quark.cn/account/info?fr=pc&platform=pc", {
    headers: { "user-agent": UA, cookie: jar, referer: REFERER },
  }).catch(() => null);
  if (!res || res.status === 0) return null;

  if (res.headers["set-cookie"]) {
    jar = mergeCookies(jar, collectSetCookies(new Headers({ "set-cookie": res.headers["set-cookie"] })));
  }

  type NickResp = { data?: { nickname?: string } };
  let json: NickResp | null = null;
  try {
    json = JSON.parse(res.text) as NickResp;
  } catch {
    json = null;
  }
  const nickname = json?.data?.nickname;
  return nickname ? { cookie: jar, nickname } : null;
}

async function call(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
  cookie = "",
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ pr: "ucpro", fr: "pc", ...(init.query ?? {}) });
  const url = `${API}${path}?${qs.toString()}`;
  const headers: Record<string, string> = {
    "user-agent": UA,
    referer: REFERER,
    origin: "https://pan.quark.cn",
    accept: "application/json, text/plain, */*",
  };
  if (cookie) headers.cookie = cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json;charset=UTF-8";

  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  const res = await panRequest(url, {
    method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : null,
  }).catch((e) => {
    throw new PanFail("upstream", `夸克请求失败：${e instanceof Error ? e.message : String(e)}`);
  });

  if (res.status === 0) {
    throw new PanFail("upstream", "连不上夸克接口（fetch 与 curl 都失败了）");
  }
  if (res.status === 429) throw new PanFail("rate-limited", "夸克接口限流，稍后再试");

  type JsonResp = { status?: number; code?: number; message?: string; data?: Record<string, unknown> };
  let json: JsonResp | null = null;
  try {
    json = JSON.parse(res.text) as JsonResp;
  } catch {
    json = null;
  }
  if (!json) throw new PanFail("upstream", `夸克返回了非 JSON（HTTP ${res.status}）`);

  const code = json.code ?? json.status ?? 0;
  if (code !== 0 && code !== 200) {
    const msg = json.message || `夸克返回 ${code}`;
    if (code === 41004) throw new PanFail("share-invalid", "分享已失效或被取消");
    if (code === 41005 || code === 41008 || /提取码/.test(msg)) {
      throw new PanFail("need-passcode", msg);
    }
    if (code === 41006) throw new PanFail("passcode-wrong", "提取码不对");
    if (code === 41010 || /频繁|限流/.test(msg)) throw new PanFail("rate-limited", msg);
    if (code === 50051 || /st invalid|token \[st/i.test(msg)) {
      throw new PanFail("share-invalid", "取链令牌已失效，请刷新页面重试");
    }
    throw new PanFail("upstream", msg);
  }
  return (json.data ?? {}) as Record<string, unknown>;
}

/** pwd_id + passcode → stoken */
export async function quarkToken(shareId: string, passcode: string, cookie = ""): Promise<string> {
  const data = await call(
    "/1/clouddrive/share/sharepage/token",
    { body: { pwd_id: shareId, passcode } },
    cookie,
  );
  const stoken = String(data.stoken ?? "");
  if (!stoken) throw new PanFail("upstream", "没拿到 stoken（可能是分享已失效）");
  return stoken;
}

type DetailItem = {
  fid: string;
  file_name?: string;
  size?: number;
  dir?: boolean;
  share_fid_token?: string;
  updated_at?: number;
};

/** 列目录（pdirFid=0 为根） */
export async function quarkList(
  shareId: string,
  stoken: string,
  pdirFid = "0",
  cookie = "",
): Promise<{ files: PanFile[]; total: number; title: string | null }> {
  const data = await call(
    "/1/clouddrive/share/sharepage/detail",
    {
      query: {
        pwd_id: shareId,
        stoken,
        pdir_fid: pdirFid,
        force: "0",
        _page: "1",
        _size: "100",
        _fetch_banner: "0",
        _fetch_share: "0",
        _fetch_total: "1",
        _sort: "file_type:asc,updated_at:desc",
      },
    },
    cookie,
  );

  const list = (data.list ?? []) as DetailItem[];
  const metadata = (data.metadata ?? {}) as { _total?: number; title?: string };
  const share = (data.share ?? {}) as { title?: string; first_file?: { file_name?: string } };

  const files: PanFile[] = list.map((f) => ({
    fid: String(f.fid),
    name: String(f.file_name ?? "(未命名)"),
    size: Number(f.size ?? 0),
    isDir: Boolean(f.dir),
    token: f.share_fid_token ?? null,
    updatedAt: f.updated_at ?? null,
  }));

  return {
    files,
    total: Number(metadata._total ?? files.length),
    title: share.title ?? metadata.title ?? share.first_file?.file_name ?? null,
  };
}

/** stoken + 文件 → 完整分享信息 */
export async function quarkResolve(
  shareId: string,
  passcode: string,
  cookie = "",
): Promise<PanShare> {
  const stoken = await quarkToken(shareId, passcode, cookie);
  const { files, total, title } = await quarkList(shareId, stoken, "0", cookie);
  return { provider: "quark", shareId, stoken, title, files, total, needsLogin: true };
}

/** 转存到自己的网盘（需要 Cookie），返回网盘内的 fid */
async function quarkSave(
  shareId: string,
  stoken: string,
  file: PanFile,
  cookie: string,
): Promise<string> {
  if (!cookie) throw new PanFail("no-credential", "缺少网盘登录凭证");

  const task = await call(
    "/1/clouddrive/share/sharepage/save",
    {
      body: {
        fid_list: [file.fid],
        fid_token_list: [file.token ?? ""],
        to_pdir_fid: "0",
        pwd_id: shareId,
        stoken,
        pdir_fid: "0",
        scene: "link",
      },
    },
    cookie,
  );
  const taskId = String(task.task_id ?? "");
  if (!taskId) throw new PanFail("upstream", "转存任务没拿到 task_id");

  for (let i = 0; i < 12; i += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const t = await call(
      "/1/clouddrive/task",
      { query: { task_id: taskId, retry_index: String(i) } },
      cookie,
    );
    if (Number(t.status ?? 0) === 2) {
      const saveAs = (t.save_as ?? {}) as { save_as_top_fids?: string[] };
      const fid = saveAs.save_as_top_fids?.[0];
      if (!fid) throw new PanFail("upstream", "转存完成但没返回文件 id");
      return String(fid);
    }
  }
  throw new PanFail("upstream", "转存超时（夸克侧排队）");
}

/** 取下载直链 */
export async function quarkDirect(
  shareId: string,
  stoken: string,
  file: PanFile,
  cookie: string,
): Promise<PanDirect> {
  const savedFid = await quarkSave(shareId, stoken, file, cookie);
  const data = await call(
    "/1/clouddrive/file/download",
    { method: "POST", query: { sys: "win32", ve: "3.23.2" }, body: { fids: [savedFid] } },
    cookie,
  );

  const rows = (Array.isArray(data) ? data : (data.list ?? [])) as {
    download_url?: string;
    file_name?: string;
    size?: number;
  }[];
  const row = rows[0];
  if (!row?.download_url) {
    throw new PanFail("upstream", "夸克没返回下载地址（多半是账号被限速或风控）");
  }

  return {
    url: row.download_url,
    expiresIn: 3600,
    fileName: row.file_name ?? file.name,
    size: Number(row.size ?? file.size),
    headers: { "user-agent": UA, referer: REFERER },
  };
}
