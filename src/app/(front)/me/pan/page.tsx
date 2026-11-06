import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, TriangleAlert, Unplug } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getCredentialRow } from "@/lib/pan/credentials";

import { unbindQuarkAction } from "@/lib/pan/actions";
import { PanExtensionBind } from "@/components/me/pan-extension-bind";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "网盘绑定",
  robots: { index: false, follow: false },
};

/**
 * 网盘绑定页：用户把自己的夸克账号挂到站点上。
 *
 * 绑定后解析/下载用「他自己的账号」，直链在浏览器端就能直接打开，
 * 不再走服务器中转，也就不受站点带宽限制。
 */
export default async function PanBindPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login?next=%2Fme%2Fpan");

  const row = getCredentialRow(viewer.id, "quark");


  return (
    <div className="container-page max-w-3xl py-10">
      <nav className="flex items-center gap-1 text-[12px] text-dim">
        <Link href="/me" className="hover:text-accent">
          我的
        </Link>
        <span aria-hidden>/</span>
        <span className="text-muted">网盘绑定</span>
      </nav>

      <h1 className="mt-5 font-sans text-[24px] font-bold text-ink lg:text-[28px]">网盘绑定</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        绑定自己的网盘账号后，站内解析和下载都用<strong className="text-ink">你自己的账号</strong>：
        文件转存到你的网盘，直链在你的浏览器里直接就能打开，速度是你自己的带宽，不受本站服务器限制。
      </p>

      <section className="mt-8 rounded-[10px] border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-2" style={{ backgroundColor: "#4C8BF5" }} />
            <h2 className="text-[14px] font-semibold text-ink">夸克网盘</h2>
          </div>
          {row ? (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-ok/10 px-2 py-0.5 text-[11px] text-ok">
              <CheckCircle2 className="size-3" strokeWidth={2} aria-hidden />
              已绑定{row.nickname ? ` · ${row.nickname}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-dim">未绑定</span>
          )}
        </div>

        <div className="p-4">
          {row ? (
            <div className="space-y-3">
              {row.last_error && (
                <p className="flex items-start gap-1.5 rounded-[6px] border border-danger/40 bg-danger/5 px-3 py-2 text-[12px] text-danger">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  上次使用失败：{row.last_error}（Cookie 可能已过期，重新绑定即可）
                </p>
              )}
              <p className="text-[12px] leading-relaxed text-muted">
                解析和下载会优先使用这个账号。如果浏览器里登录的是同一个账号，直链可以直接打开；
                否则系统会自动改用服务器中转（速度受服务器带宽限制）。
              </p>
              <form action={unbindQuarkAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] border border-line px-3 text-[12px] text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  <Unplug className="size-3.5" strokeWidth={1.5} aria-hidden />
                  解除绑定
                </button>
              </form>
            </div>
          ) : (
            <>
              <p className="mb-4 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
                本站<strong className="text-ink">不代持任何网盘账号</strong>：绑定后解析和下载都用你自己的账号，
                文件转存到你的网盘、直链在你的浏览器直接打开，走你自己的带宽。未绑定无法使用站内解析。
              </p>
              <div className="space-y-4">
                <PanExtensionBind />

                <div className="space-y-2 rounded-[6px] bg-surface-2 px-3 py-3 text-[11px] leading-relaxed text-muted">
                  <p>没装扩展：点「下载扩展」→ 解压 → 打开浏览器扩展页 → 开启「开发者模式」→「加载解压缩的扩展」→ 选中解压出的文件夹 → 回本页点「重新检测」。</p>
                  <p>用之前先在同一个浏览器登录 pan.quark.cn。</p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
