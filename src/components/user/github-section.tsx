import { get } from "@/db/client";
import { githubConfigured } from "@/lib/github/api";
import { GithubLink } from "@/components/user/github-link";

/**
 * 设置页里的「GitHub 授权」区块。
 * 服务端只读账号绑定状态，交互交给客户端组件。
 */
export async function GithubSection({ userId }: { userId: number }) {
  const configured = githubConfigured();
  const row = get<{ login: string; linked_at: number }>(
    "SELECT login, linked_at FROM github_accounts WHERE user_id = ?",
    userId,
  );

  return (
    <section className="rounded-[14px] border border-line bg-surface p-5">
      <h2 className="text-[15px] font-semibold text-ink">GitHub 授权</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        授权后可以在站内直接给开源项目点 Star，不用跳出去。只申请 star 所需的最小权限。
      </p>

      <div className="mt-4">
        <GithubLink
          configured={configured}
          login={row?.login ?? null}
          linkedAt={row?.linked_at ?? null}
        />
      </div>
    </section>
  );
}
