import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, TriangleAlert, Unplug } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getCredentialRow } from "@/lib/pan/credentials";
import { hasSiteCredential } from "@/lib/pan/quark";
import { unbindQuarkAction } from "@/lib/pan/actions";
import { PanBindForm } from "@/components/me/pan-bind-form";
import { PanQrBind } from "@/components/me/pan-qr-bind";
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
  const siteFallback = hasSiteCredential();

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
              {siteFallback && (
                <p className="mb-4 rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] text-muted">
                  站点目前配了一个公共账号，未绑定的用户也能解析和下载，但速度受服务器限制，
                  而且所有文件都会转存到同一个账号里。绑定自己的更划算。
                </p>
              )}
              <div className="space-y-4">
                <PanExtensionBind />
                <div className="flex items-center gap-2 text-[11px] text-dim">
                  <span className="h-px flex-1 bg-line" />
                  或者手动粘贴
                  <span className="h-px flex-1 bg-line" />
                </div>
                <PanBindForm />
              </div>

              <details className="mt-5 border-t border-line pt-3">
                <summary className="cursor-pointer text-[12px] text-muted hover:text-ink">
                  扫码登录（实验性，可能失败）
                </summary>
                <div className="mt-4 space-y-3">
                  <p className="rounded-[6px] bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted">
                    夸克的扫码登录不在 HTTP 层交接登录态，服务端实测拿到的只有访客 cookie
                    （`isQuark=false`、网盘接口返回 401 guest），所以扫码成功后大概率仍然绑不上。
                    优先用上面的手动粘贴；扫码只作为备选。
                  </p>
                  <PanQrBind />
                </div>
              </details>
            </>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-2 text-[11px] leading-relaxed text-dim">
        <p>· Cookie 用 AES-256-GCM 加密存储，密钥由站点密钥派生；解绑即物理删除。</p>
        <p>· 每次点下载都会把这个文件转存一份到你的网盘，下载完可以在夸克里删掉。</p>
        <p>· Cookie 大约 1–2 个月过期，过期后这里会显示「上次使用失败」，重新粘一次即可。</p>
      </section>
    </div>
  );
}
