import { NextResponse } from "next/server";
import { run } from "@/db/client";
import { getSessionUser } from "@/lib/auth";
import { githubConfigured } from "@/lib/github/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function go(path: string) {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}

/** 解除 GitHub 授权：删掉本地保存的 token */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return go("/login?next=/me/settings");

  run("DELETE FROM github_accounts WHERE user_id = ?", user.id);
  return go("/me/settings?github=unlinked");
}

export async function GET() {
  return NextResponse.json({ configured: githubConfigured() });
}
