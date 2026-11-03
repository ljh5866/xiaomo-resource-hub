"use client";

import { useRef, useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { PROVIDERS } from "@/lib/constants";

const providerName = (key: string) =>
  (PROVIDERS as Record<string, { name?: string } | undefined>)[key]?.name ?? key;

const REASONS = [
  { value: "link-dead", label: "链接打不开 / 已失效" },
  { value: "wrong-content", label: "内容与描述不符" },
  { value: "virus", label: "疑似病毒或捆绑" },
  { value: "other", label: "其他问题" },
];

/** 详情页的「举报失效」：弹窗填完直接提交，不用登录 */
export function ReportDialog({
  resourceId,
  links,
}: {
  resourceId: number;
  links: { id: number; provider: string; label: string | null }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("link-dead");
  const [linkId, setLinkId] = useState<string>(links[0] ? String(links[0].id) : "");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId,
            linkId: linkId ? Number(linkId) : null,
            reason,
            contact,
          }),
        });
        const json = (await res.json()) as { ok: boolean; message?: string };
        if (!json.ok) {
          setState("error");
          setMessage(json.message ?? "提交失败");
          return;
        }
        setState("ok");
        setMessage("收到，我们会在巡检时优先处理这条。");
        setContact("");
      } catch {
        setState("error");
        setMessage("网络异常，稍后再试");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setState("idle");
          setMessage("");
          dialogRef.current?.showModal();
        }}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1 text-[12px] text-dim transition-colors hover:text-danger"
      >
        <Flag className="size-3.5" strokeWidth={1.5} aria-hidden />
        链接失效？举报
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(440px,92vw)] border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <form onSubmit={submit}>
          <div className="p-5">
            <h2 className="font-serif text-[16px] font-semibold text-ink">举报问题</h2>
            <p className="mt-1 text-[12px] text-muted">不需要登录，但请如实填写。</p>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] text-muted">哪一条链接</span>
              <select
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                className="min-h-10 w-full border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="">整个资源</option>
                {links.map((l) => (
                  <option key={l.id} value={l.id}>
                    {providerName(l.provider)}
                    {l.label ? ` · ${l.label}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] text-muted">问题类型</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-10 w-full border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] text-muted">联系方式（可选）</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱或 TG，修好后通知你"
                maxLength={120}
                className="min-h-10 w-full border border-line bg-surface-2 px-2 text-[13px] text-ink outline-none focus:border-accent"
              />
            </label>

            {message && (
              <p
                className={
                  "mt-3 border px-3 py-2 text-[12px] " +
                  (state === "ok"
                    ? "border-ok/40 bg-ok/5 text-ok"
                    : "border-danger/40 bg-danger/5 text-danger")
                }
              >
                {message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="min-h-10 cursor-pointer border border-line px-3 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              关闭
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 cursor-pointer border border-accent bg-accent px-3 text-[13px] text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              {pending ? "提交中…" : "提交举报"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
