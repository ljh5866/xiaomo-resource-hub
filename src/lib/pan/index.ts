/**
 * 网盘解析入口：按 provider 分发，并缓存 stoken（服务端内存，10 分钟）。
 *
 * stoken 不能下发到前端 —— 拿到它等于拿到这次分享的读取权，
 * 前端只拿 fid 列表，取直链时由服务端用缓存里的 stoken 重新拼请求。
 *
 * 凭证由调用方传入（用户自己的 cookie 优先，回退站点账号），本模块不读环境变量。
 */
import * as quark from "./quark";
import type { PanDirect, PanFile, PanProvider, PanShare } from "./types";

type CacheEntry = { shareId: string; stoken: string; at: number };
const stokenCache = new Map<string, CacheEntry>();
const TTL = 10 * 60 * 1000;

function put(linkId: number, shareId: string, stoken: string) {
  stokenCache.set(String(linkId), { shareId, stoken, at: Date.now() });
}

function take(linkId: number, shareId: string): string | null {
  const hit = stokenCache.get(String(linkId));
  if (!hit) return null;
  if (hit.shareId !== shareId) return null;
  if (Date.now() - hit.at > TTL) {
    stokenCache.delete(String(linkId));
    return null;
  }
  return hit.stoken;
}

/** 该平台是否已经接好（其余三个还没实现，前台会显示「暂不支持」） */
export function providerReady(provider: PanProvider): boolean {
  return provider === "quark";
}

export async function resolveShare(
  linkId: number,
  provider: PanProvider,
  shareId: string,
  passcode: string,
  cookie = "",
): Promise<PanShare> {
  if (provider !== "quark") throw new Error(`${provider} 还没接，目前只支持夸克`);
  const share = await quark.quarkResolve(shareId, passcode, cookie);
  if (share.stoken) put(linkId, shareId, share.stoken);
  return share;
}

export async function getDirectLink(
  linkId: number,
  provider: PanProvider,
  shareId: string,
  passcode: string,
  file: PanFile,
  cookie = "",
  pdirFid = "0",
): Promise<PanDirect> {
  if (provider !== "quark") throw new Error(`${provider} 还没接`);

  /**
   * 取链必须用**新鲜**的 stoken：夸克会作废旧的（实测 code 50051 `token [st invalid]`），
   * 而且必须带真实提取码换。
   *
   * 更要紧的是：`share_fid_token` 是**和 stoken 同源**的 ——
   * 用新 stoken 配旧文件 token 转存，夸克直接报「转存文件token校验异常」。
   * 所以这里用同一个新 stoken 重新列一次目录，拿配套的文件 token。
   */
  const stoken = await quark.quarkToken(shareId, passcode, cookie);
  put(linkId, shareId, stoken);

  let freshToken = file.token ?? null;
  try {
    const { files } = await quark.quarkList(shareId, stoken, pdirFid || "0", cookie);
    const hit = files.find((f) => f.fid === file.fid);
    if (hit?.token) freshToken = hit.token;
  } catch {
    // 列目录失败就退回调用方给的 token，让夸克自己报错
  }

  return quark.quarkDirect(shareId, stoken, { ...file, token: freshToken }, cookie);
}

/** 浏览子目录：复用解析时缓存的 stoken，不再重新换 token */
export async function listFiles(
  linkId: number,
  provider: PanProvider,
  shareId: string,
  pdirFid: string,
  cookie = "",
): Promise<{ files: PanFile[]; total: number }> {
  if (provider !== "quark") throw new Error(`${provider} 还没接`);

  let stoken = take(linkId, shareId);
  if (!stoken) {
    stoken = await quark.quarkToken(shareId, "", cookie);
    put(linkId, shareId, stoken);
  }
  const { files, total } = await quark.quarkList(shareId, stoken, pdirFid, cookie);
  return { files, total };
}
