"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { deleteResource } from "@/lib/admin/actions";

/** 删除二次确认：原生 <dialog>，Esc 关闭，焦点锁定由浏览器负责 */
export function DeleteButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function confirm() {
    start(async () => {
      const res = await deleteResource(id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      dialogRef.current?.close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="min-h-9 cursor-pointer border border-line px-2 text-[12px] text-dim transition-colors hover:border-danger hover:text-danger"
      >
        删除
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(420px,92vw)] border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex items-start gap-3 p-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
          <div>
            <h2 className="font-serif text-[16px] font-semibold text-ink">确定删除这条资源？</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              「{title}」及其全部下载链接会被移除，搜索索引同步删除。此操作不可撤销。
            </p>
            {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-10 cursor-pointer border border-line px-3 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            取消
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="min-h-10 cursor-pointer border border-danger bg-danger/10 px-3 text-[13px] text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
          >
            {pending ? "删除中…" : "确认删除"}
          </button>
        </div>
      </dialog>
    </>
  );
}
