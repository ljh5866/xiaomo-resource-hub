import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { authorizeUrl, githubConfigured } from "@/lib/github/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 相对跳转：反代后面 req.url 是内网地址，绝对 URL 会把 localhost 写进 Location */
function go(path: string) {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

/** 发起 GitHub 授权：带上回跳地址，state 防 CSRF */
export async function GET(req: NextRequest) {
  const back = req.nextUrl.searchParams.get("next") ?? "/me";

  const user = await getSessionUser();
  if (!user) return go(`/login?next=${encodeURIComponent(back)}`);
  if (!githubConfigured()) return go("/me/settings?github=unconfigured");

  const origin = process.env.SITE_URL?.replace(/\/$/, "") ?? "";
  if (!origin) return go("/me/settings?github=error");

  const redirectUri = `${origin}/api/github/callback`;
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(authorizeUrl(state, redirectUri), 302);
  res.cookies.set("gh_oauth_state", `${state}|${back}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
