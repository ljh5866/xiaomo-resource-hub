import Link from "next/link";

/** 会话版本不一致（改密码 / 被 revoke）时的落地页 —— 流式渲染下 200 比半路 redirect 更可靠 */
export function SessionRevoked() {
  return (
    <div className="container-page grid place-items-center py-24">
      <div className="max-w-md border border-line bg-surface p-8 text-center">
        <p className="font-mono text-[11px] tracking-[0.22em] text-dim">SESSION EXPIRED</p>
        <h1 className="mt-3 font-sans text-[24px] font-bold text-ink">会话已失效</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          账号信息已变更（改密码或被强制下线），这台设备的登录不能再访问后台。
          请重新登录一次。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login?next=/admin"
            className="inline-flex min-h-11 items-center bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
          >
            重新登录
          </Link>
          <a
            href="/api/logout"
            className="inline-flex min-h-11 items-center border border-line px-4 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            清除会话
          </a>
        </div>
      </div>
    </div>
  );
}
