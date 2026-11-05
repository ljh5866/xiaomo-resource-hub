"use client";

import { useSearchParams } from "next/navigation";

/**
 * GitHub 授权状态与操作。
 *
 * - 未配置 client id/secret：给出配置提示，不显示授权按钮
 * - 已绑定：显示 @login 与解除按钮
 * - 未绑定：跳 /api/github/authorize 完成 OAuth
 */
export function GithubLink({
  configured,
  login,
  linkedAt,
}: {
  configured: boolean;
  login: string | null;
  linkedAt: number | null;
}) {
  const params = useSearchParams();
  const notice = params.get("github");

  if (!configured) {
    return (
      <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        还没配置 GitHub OAuth。到 GitHub → Settings → Developer settings → OAuth Apps 建一个应用，
        回调地址填 <code className="font-mono text-[11px]">https://ttals.com/api/github/callback</code>，
        然后把 <code className="font-mono text-[11px]">GITHUB_CLIENT_ID</code> 和{" "}
        <code className="font-mono text-[11px]">GITHUB_CLIENT_SECRET</code> 写进 .env 并重启服务。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {login ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink">
            已授权 <span className="font-mono">@{login}</span>
          </span>
          {linkedAt && (
            <span className="font-mono text-[11px] text-dim">
              {new Date(linkedAt * 1000).toISOString().slice(0, 10)}
            </span>
          )}
          <form action="/api/github/unlink" method="post">
            <button
              type="submit"
              className="min-h-9 cursor-pointer rounded-[10px] border border-line px-3 text-[12px] text-muted transition-colors hover:border-danger hover:text-danger"
            >
              解除授权
            </button>
          </form>
        </div>
      ) : (
        <a
          href={`/api/github/authorize?next=${encodeURIComponent("/me/settings")}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-ink px-3 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          授权 GitHub
        </a>
      )}

      {notice === "linked" && <p className="text-[12px] text-ok">授权成功，现在可以在站内点 Star 了</p>}
      {notice === "unlinked" && <p className="text-[12px] text-muted">已解除授权</p>}
      {notice === "denied" && <p className="text-[12px] text-danger">授权被取消或校验失败，请重试</p>}
      {notice === "error" && <p className="text-[12px] text-danger">授权过程出错，请稍后再试</p>}
    </div>
  );
}
