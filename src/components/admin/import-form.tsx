"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCsv } from "@/lib/admin/actions";

const EXAMPLE = `标题,slug,分类slug,网盘,链接,提取码,大小,版本,摘要
Figma 组件库模板,figma-kit-demo,icon,quark,https://pan.quark.cn/s/EXAMPLE-9001,m01x,86 MB,v2.1,面向后台的组件库
Excel 财务模型模板,fin-model-demo,template,baidu,https://pan.baidu.com/s/EXAMPLE-9002,bk2x,24 MB,v1.0,三表联动的财务模型`;

export function ImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  function run() {
    setResult(null);
    start(async () => {
      const res = await importCsv(text);
      setOk(res.ok);
      setResult(res.message);
      if (res.ok) {
        router.refresh();
        if ((res.inserted ?? 0) > 0) setText("");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="font-serif text-[15px] font-semibold text-ink">粘贴 CSV</h2>
            <p className="mt-0.5 text-[11px] text-dim">
              列顺序：标题, slug, 分类slug, 网盘, 链接, 提取码, 大小, 版本, 摘要
            </p>
          </div>
          <button
            type="button"
            onClick={() => setText(EXAMPLE)}
            className="min-h-9 shrink-0 cursor-pointer border border-line px-3 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
          >
            填入示例
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder="把表格里的内容整段粘进来，第一行表头会被自动跳过"
          className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[12px] leading-relaxed text-ink outline-none placeholder:text-dim"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="font-mono text-[11px] text-dim">{lines} 行</span>
          <button
            type="button"
            onClick={run}
            disabled={pending || lines === 0}
            className="min-h-10 cursor-pointer border border-accent bg-accent px-4 text-[13px] text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "导入中…" : "开始导入"}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={
            "border px-4 py-3 text-[13px] leading-relaxed " +
            (ok ? "border-ok/40 bg-ok/5 text-ok" : "border-danger/40 bg-danger/5 text-danger")
          }
        >
          <pre className="whitespace-pre-wrap font-sans">{result}</pre>
        </div>
      )}
    </div>
  );
}
