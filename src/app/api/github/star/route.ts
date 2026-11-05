import { NextResponse } from "next/server";
import { get } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import {
  getGithubAccount,
  githubConfigured,
  isStarred,
  parseRepo,
  setStar,
} from "@/lib/github/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 当前用户对某个资源对应仓库的 star 状态 */
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("resourceId"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "参数不对" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, needLogin: true }, { status: 401 });

  const acct = getGithubAccount(user.id);
  if (!acct || !githubConfigured()) {
    return NextResponse.json({ ok: true, linked: false, starred: false });
  }

  const url = get<{ source_url: string | null }>(
    "SELECT source_url FROM resources WHERE id = ?",
    id,
  )?.source_url;
  const repo = url ? parseRepo(url) : null;
  if (!repo) return NextResponse.json({ ok: false, message: "不是 GitHub 项目" }, { status: 400 });

  try {
    const starred = await isStarred(acct.access_token, repo.owner, repo.repo);
    return NextResponse.json({ ok: true, linked: true, starred, login: acct.login });
  } catch {
    // token 失效也当作未授权，前端会引导重新授权
    return NextResponse.json({ ok: true, linked: false, starred: false });
  }
}

/** 点星 / 取消星 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { resourceId?: number; star?: boolean } | null;
  const id = Number(body?.resourceId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "参数不对" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, needLogin: true }, { status: 401 });

  const acct = getGithubAccount(user.id);
  if (!acct) return NextResponse.json({ ok: false, needLink: true }, { status: 409 });

  const url = get<{ source_url: string | null }>(
    "SELECT source_url FROM resources WHERE id = ?",
    id,
  )?.source_url;
  const repo = url ? parseRepo(url) : null;
  if (!repo) return NextResponse.json({ ok: false, message: "不是 GitHub 项目" }, { status: 400 });

  try {
    await setStar(acct.access_token, repo.owner, repo.repo, body?.star !== false);
    return NextResponse.json({ ok: true, starred: body?.star !== false, login: acct.login });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 400 });
  }
}
