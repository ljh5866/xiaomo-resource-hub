import { getSessionUser } from "@/lib/auth";
import { get } from "@/db/client";
import { isPanProvider, SHARE_PARSERS } from "@/lib/pan/types";
import { listFiles, providerHasCredential, providerReady, resolveShare } from "@/lib/pan";

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
 * POST /api/pan/resolve { linkId }
 *
 * 只接受「库里的链接 id」，不接受任意 URL —— 防止被当成公共解析接口刷。
 * 需要登录。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let linkId = 0;
  let pdirFid = "0";
  try {
    const body = (await req.json()) as { linkId?: number; pdirFid?: string };
    linkId = Number(body.linkId ?? 0);
    pdirFid = String(body.pdirFid ?? "0");
  } catch {
    return Response.json({ error: "请求格式不对" }, { status: 400 });
  }
  if (!Number.isFinite(linkId) || linkId <= 0) {
    return Response.json({ error: "缺少 linkId" }, { status: 400 });
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
  if (!isPanProvider(provider)) {
    return Response.json({ error: "这个来源不支持解析" }, { status: 400 });
  }
  if (!providerReady(provider)) {
    return Response.json(
      { error: `${provider} 解析还没接好，目前只支持夸克`, unsupported: true },
      { status: 400 },
    );
  }

  const parsed = SHARE_PARSERS[provider](link.url, link.extractCode);
  if (!parsed) {
    return Response.json({ error: "链接格式无法识别（可能不是分享链接）" }, { status: 400 });
  }

  try {
    // 进子目录：复用已缓存的 stoken，只换 pdir_fid
    if (pdirFid && pdirFid !== "0") {
      const sub = await listFiles(link.id, provider, parsed.shareId, pdirFid);
      return Response.json({
        ok: true,
        share: {
          provider,
          shareId: parsed.shareId,
          stoken: null,
          title: null,
          files: sub.files,
          total: sub.total,
          needsLogin: true,
        },
        credential: providerHasCredential(provider),
        resource: { slug: link.slug, title: link.title },
      });
    }

    const share = await resolveShare(link.id, provider, parsed.shareId, parsed.passcode);
    return Response.json({
      ok: true,
      share,
      credential: providerHasCredential(provider),
      resource: { slug: link.slug, title: link.title },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "解析失败";
    const code = (err as { code?: string }).code ?? "upstream";
    return Response.json({ error: message, code }, { status: 502 });
  }
}
