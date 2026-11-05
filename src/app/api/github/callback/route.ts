import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  exchangeCode,
  fetchGithubUser,
  githubConfigured,
  saveGithubAccount,
} from "@/lib/github/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function go(path: string) {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

/** GitHub 授权回调：换 token、记账号、回到来源页 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookie = req.cookies.get("gh_oauth_state")?.value ?? "";
  const [expected, back = "/me"] = cookie.split("|");

  if (!githubConfigured() || !code || !state || state !== expected) {
    return go("/me/settings?github=denied");
  }

  const user = await getSessionUser();
  if (!user) return go("/login?next=/me");

  const origin = process.env.SITE_URL?.replace(/\/$/, "") ?? "";
  if (!origin) return go("/me/settings?github=error");

  try {
    const { token, scope } = await exchangeCode(code, `${origin}/api/github/callback`);
    const gh = await fetchGithubUser(token);
    saveGithubAccount(user.id, gh, token, scope);

    const res = go(`${back}?github=linked`);
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch {
    return go("/me/settings?github=error");
  }
}
