/**
 * 夸克请求的传输层。
 *
 * 为什么不是直接用 fetch：
 *   香港服务器到夸克的链路很慢（curl 实测 TLS 握手 3–6 秒），而 Node 的 undici
 *   默认 connect 超时只有 10 秒，叠上 DNS 和 CDN 轮询到不通的 IP，就会 ETIMEDOUT。
 *   同一时刻同一台机器 curl 却能通 —— 所以这里做成：
 *     ① 先试 fetch（本地开发快，200–300ms）
 *     ② 失败/超时立刻回退 curl 子进程（服务器上走这条）
 *
 * 两者返回结构一致，调用方不用关心用的哪条路。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type PanHttpResponse = {
  status: number;
  text: string;
  /** 响应头（小写键；curl 路径只回传 set-cookie） */
  headers: Record<string, string>;
  via: "fetch" | "curl";
};

const FETCH_TIMEOUT_MS = 8000;
const CURL_TIMEOUT_SEC = Number(process.env.PAN_CURL_TIMEOUT ?? 25);

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  const setCookies =
    typeof (h as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (h as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  if (setCookies.length) out["set-cookie"] = setCookies.join("\n");
  return out;
}

async function viaFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<PanHttpResponse> {
  const res = await fetch(url, {
    method,
    headers,
    body: body ?? undefined,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return {
    status: res.status,
    text: await res.text(),
    headers: headersToObject(res.headers),
    via: "fetch",
  };
}

async function viaCurl(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<PanHttpResponse> {
  const marker = "\n__XM_STATUS__";
  const args = [
    "-sS",
    "--compressed",
    "--max-time",
    String(CURL_TIMEOUT_SEC),
    "-X",
    method,
    "-w",
    `${marker}%{http_code}`,
  ];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  if (body) args.push("--data-binary", body);
  args.push(url);

  const { stdout } = await run("curl", args, { maxBuffer: 16 * 1024 * 1024 });
  const idx = stdout.lastIndexOf(marker);
  if (idx < 0) return { status: 0, text: stdout, headers: {}, via: "curl" };
  const status = Number(stdout.slice(idx + marker.length).trim()) || 0;
  return { status, text: stdout.slice(0, idx), headers: {}, via: "curl" };
}

/**
 * 发一个夸克请求：先 fetch，失败回退 curl。
 * 注意 curl 路径拿不到响应头（除了状态码），需要 Set-Cookie 的地方请用 fetch 或单独再取。
 */
/**
 * 是否配了出口代理。配了就走 curl 优先：
 * curl 原生读 HTTPS_PROXY/ALL_PROXY，而 Node 的 fetch 需要 NODE_USE_ENV_PROXY=1 才认，
 * 绕开这个开关能让部署只改 .env 就生效。
 */
function hasProxy(): boolean {
  const env = process.env;
  return Boolean(
    env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy || env.HTTP_PROXY || env.http_proxy,
  );
}

export async function panRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string | null } = {},
): Promise<PanHttpResponse> {
  const method = init.method ?? "GET";
  const headers = init.headers ?? {};
  const body = init.body ?? null;

  // 有代理：curl 直接走代理（国内出口时 RTT 从 340ms 降到 20ms 级）
  if (hasProxy()) {
    try {
      return await viaCurl(url, method, headers, body);
    } catch {
      /* 代理挂了就退回直连 */
    }
  }

  try {
    return await viaFetch(url, method, headers, body);
  } catch {
    return viaCurl(url, method, headers, body);
  }
}

/** 需要一个「能读到响应头」的请求时用（扫码登录的 Set-Cookie 场景） */
export async function panRequestWithHeaders(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string | null } = {},
): Promise<PanHttpResponse> {
  const method = init.method ?? "GET";
  const headers = init.headers ?? {};
  const body = init.body ?? null;

  try {
    return await viaFetch(url, method, headers, body);
  } catch {
    // curl 用 -D 把响应头写到单独文件更稳，但这里简化：重试一次 fetch，再不行返回无头结果
    try {
      return await viaFetch(url, method, headers, body);
    } catch {
      return viaCurl(url, method, headers, body);
    }
  }
}
