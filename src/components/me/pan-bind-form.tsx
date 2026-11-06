"use client";

import { useActionState } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { bindQuarkAction, type BindState } from "@/lib/pan/actions";

export function PanBindForm() {
  const [state, action, pending] = useActionState<BindState, FormData>(bindQuarkAction, {
    ok: true,
    message: "",
  });

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="pan-cookie" className="block text-[12px] font-medium text-ink">
          夸克 Cookie
        </label>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          浏览器登录 <span className="font-mono">pan.quark.cn</span> → F12 → Network → 刷新 → 点任意请求 →
          复制 Request Headers 里 <span className="font-mono">Cookie:</span> 整行。
          建议用小号，因为每次下载都会往这个账号里转存一份文件。
        </p>
        <textarea
          id="pan-cookie"
          name="cookie"
          rows={4}
          required
          spellCheck={false}
          placeholder="__pus=...; __puus=...; （整行粘贴，几百个字符）"
          className="mt-2 w-full resize-y rounded-[8px] border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-[1.6] text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] bg-accent px-4 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />}
          验证并绑定
        </button>
        <span className="text-[11px] text-dim">Cookie 会加密存在服务器，只用于替你把文件转存和取直链</span>
      </div>

      {state.message && (
        <p
          className={
            "flex items-start gap-1.5 rounded-[6px] px-3 py-2 text-[12px] " +
            (state.ok ? "bg-surface-2 text-ink" : "border border-danger/40 bg-danger/5 text-danger")
          }
        >
          {state.ok ? (
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          )}
          {state.message}
        </p>
      )}
    </form>
  );
}
