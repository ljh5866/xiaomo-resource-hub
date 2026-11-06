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
          夸克 Cookie / cURL
        </label>

        <div className="mt-2 space-y-2 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
          <p className="font-medium text-ink">方式一（推荐，最不容易出错）</p>
          <p>
            电脑浏览器打开 <span className="font-mono">pan.quark.cn</span> 登录 → F12 → Network → 刷新 →
            右键任意一条请求 → <span className="font-mono">Copy</span> →{" "}
            <span className="font-mono">Copy as cURL</span> → 整段粘到下面
          </p>
          <p className="font-medium text-ink">方式二</p>
          <p>
            同样位置点开请求 → <span className="font-mono">Headers → Request Headers</span> → 复制{" "}
            <span className="font-mono">Cookie:</span> 冒号后那一整行
          </p>
          <p className="text-danger">
            ✗ 不要用控制台 <span className="font-mono">document.cookie</span>：拿不到 httpOnly 的{" "}
            <span className="font-mono">__pus / __puus</span>，粘过来一定验证失败
          </p>
        </div>

        <textarea
          id="pan-cookie"
          name="cookie"
          rows={5}
          required
          spellCheck={false}
          placeholder="方式一：直接粘贴整段 curl 'https://pan.quark.cn/...' -H 'cookie: __pus=...'&#10;方式二：粘贴 __pus=...; __puus=...; isQuark=true"
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
