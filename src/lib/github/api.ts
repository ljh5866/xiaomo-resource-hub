import { get, run } from "@/db/client";

/**
 * GitHub 授权与 Star。
 *
 * 用途：用户在站内点「Star」，直接调用 GitHub API 给仓库点星，
 * 不用跳出去。需要一次性授权（public_repo 权限，仅够 star/unstar）。
 *
 * 配置（GitHub → Settings → Developer settings → OAuth Apps）：
 *   GITHUB_CLIENT_ID=xxx
 *   GITHUB_CLIENT_SECRET=xxx
 *   回调地址填：https://ttals.com/api/github/callback
 */

export const GH_AUTHORIZE = "https://github.com/login/oauth/authorize";
export const GH_TOKEN = "https://github.com/login/oauth/access_token";
export const GH_API = "https://api.github.com";

/** 只申请 star 所需的最小权限 */
const SCOPE = "public_repo";

/**
 * 兜底读取：有些部署方式（systemd 没加载 EnvironmentFile、pm2、容器）
 * 会把 .env 里的变量漏掉。这里直接读一次项目根的 .env，避免「明明写了却读到空」。
 */
import fs from "node:fs";
import path from "node:path";

let cachedFileEnv: Record<string, string> | null = null;

function readEnvFile() {
  if (cachedFileEnv) return cachedFileEnv;
  const out: Record<string, string> = {};
  try {
    const file = path.join(process.cwd(), ".env");
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
    }
  } catch {
    /* 没文件就算了 */
  }
  cachedFileEnv = out;
  return out;
}

function env(name: string) {
  return (process.env[name] ?? readEnvFile()[name] ?? "").trim();
}

export function githubConfigured() {
  const id = env("GITHUB_CLIENT_ID");
  const secret = env("GITHUB_CLIENT_SECRET");
  // 占位符 / 明显没填的值一律当未配置，避免把用户甩到 GitHub 报错页
  const placeholder = /^(你的|xxx|changeme|your[-_]?|client[-_]?id$|client[-_]?secret$)/i;
  if (!id || !secret || placeholder.test(id) || placeholder.test(secret)) return false;
  if (id.length < 10 || secret.length < 20) return false;
  return true;
}

export function authorizeUrl(state: string, redirectUri: string) {
  const u = new URL(GH_AUTHORIZE);
  u.searchParams.set("client_id", env("GITHUB_CLIENT_ID"));
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", SCOPE);
  u.searchParams.set("state", state);
  u.searchParams.set("allow_signup", "true");
  return u.toString();
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(GH_TOKEN, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env("GITHUB_CLIENT_ID"),
      client_secret: env("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`交换 token 失败 ${res.status}`);
  const data = (await res.json()) as { access_token?: string; scope?: string; error?: string };
  if (!data.access_token) throw new Error(data.error ?? "没有拿到 access_token");
  return { token: data.access_token, scope: data.scope ?? SCOPE };
}

export async function fetchGithubUser(token: string) {
  const res = await fetch(`${GH_API}/user`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`读取 GitHub 用户失败 ${res.status}`);
  const u = (await res.json()) as { id: number; login: string };
  return { id: String(u.id), login: u.login };
}

export function saveGithubAccount(
  userId: number,
  github: { id: string; login: string },
  token: string,
  scope: string,
) {
  run(
    `INSERT INTO github_accounts (user_id, github_id, login, access_token, scopes, linked_at)
     VALUES (?,?,?,?,?,unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       github_id = excluded.github_id,
       login = excluded.login,
       access_token = excluded.access_token,
       scopes = excluded.scopes,
       linked_at = unixepoch()`,
    userId,
    github.id,
    github.login,
    token,
    scope,
  );
}

export function getGithubAccount(userId: number) {
  return get<{ login: string; access_token: string }>(
    "SELECT login, access_token FROM github_accounts WHERE user_id = ?",
    userId,
  );
}

/** 从 GitHub 仓库地址解析 owner/repo */
export function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export async function isStarred(token: string, owner: string, repo: string) {
  const res = await fetch(`${GH_API}/user/starred/${owner}/${repo}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  throw new Error(`查询 star 状态失败 ${res.status}`);
}

export async function setStar(token: string, owner: string, repo: string, star: boolean) {
  const res = await fetch(`${GH_API}/user/starred/${owner}/${repo}`, {
    method: star ? "PUT" : "DELETE",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-length": "0",
    },
  });
  if (res.status === 204) return true;
  if (res.status === 401) throw new Error("GitHub 授权已失效，请重新授权");
  if (res.status === 403) throw new Error("GitHub 拒绝操作（token 权限不足或触发了限速）");
  throw new Error(`Star 失败 ${res.status}`);
}
