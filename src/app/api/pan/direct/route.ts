import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { isPanProvider, SHARE_PARSERS, type PanFile } from "@/lib/pan/types";
import { getDirectLink, providerReady } from "@/lib/pan";
import { resolveCookie } from "@/lib/pan/credentials";

type LinkRow = {
  id: number;
  provider: string;
  url: string;
  extractCode: string | null;
  slug: string;
  title: string;
  status: string;
};

/**
 * POST /api/pan/direct { linkId, fid, name, size, token }
 *
 * 取单个文件的下载直链。stoken 从服务端缓存里取，前端拿不到。
 * 夸克需要先转存到自己的网盘再取链，所以会在网盘里留一份副本。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let payload: { linkId?: number; fid?: string; name?: string; size?: number; token?: string; pdirFid?: string } = {};
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }

  const linkId = Number(payload.linkId ?? 0);
  const fid = String(payload.fid ?? "");
  if (!Number.isFinite(linkId) || linkId <= 0 || !fid) {
    return Response.json({ error: "缺少参数" }, { status: 400 });
  }

  const link = get<LinkRow>(
    `SELECT l.id, l.provider, l.url, l.extract_code AS extractCode,
            r.slug, r.title, r.status
       FROM resource_links l
       JOIN resources r ON r.id = l.resource_id
      WHERE l.id = ?`,
    linkId,
  );
  if (!link || link.status !== "published") {
    return Response.json({ error: "链接不存在" }, { status: 404 });
  }

  const provider = link.provider;
  if (!isPanProvider(provider) || !providerReady(provider)) {
    return Response.json({ error: "这个来源暂不支持" }, { status: 400 });
  }

  const parsed = SHARE_PARSERS[provider](link.url, link.extractCode);
  if (!parsed) return Response.json({ error: "链接格式无法识别" }, { status: 400 });

  const file: PanFile = {
    fid,
    name: String(payload.name ?? "未命名"),
    size: Number(payload.size ?? 0),
    isDir: false,
    token: payload.token ?? null,
  };
  const subDir = String(payload.pdirFid ?? "0");

  const cred = resolveCookie(user.id ?? null, provider);
  if (!cred) {
    return Response.json({ error: "还没有绑定网盘账号，先去「我的 → 网盘绑定」", code: "no-credential" }, { status: 400 });
  }

  try {
    const direct = await getDirectLink(link.id, provider, parsed.shareId, parsed.passcode, file, cred.cookie, subDir);
    return Response.json({ ok: true, direct, credentialSource: cred.source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "取直链失败";
    const code = (err as { code?: string }).code ?? "upstream";
    return Response.json({ error: message, code }, { status: 502 });
  }
}
