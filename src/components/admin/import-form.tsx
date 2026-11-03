"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { importCsv } from "@/lib/admin/actions";

const EXAMPLE = `title,slug,category,provider,url,extractCode,size,version,summary
Figma 组件库模板,figma-kit-demo,icon,quark,https://pan.quark.cn/s/EXAMPLE-9001,m01x,86 MB,v2.1,面向后台的组件库
Excel 财务模型模板,fin-model-demo,template,baidu,https://pan.baidu.com/s/EXAMPLE-9002,bk2x,24 MB,v1.0,三表联动财务模型`;

export function ImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  function run() {
    setResult(null);
    start(async () => {
      const res = await importCsv(text);
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
            className="min-h-9 cursor-pointer border border-line px-3 text-[12px] text-muted transition-colors hover:border-accent hover:text-accent"
          >
            填入示例
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={EXAMPLE}
          className="w-full resize-y bg-canvas p-4 font-mono text-[12px] leading-relaxed text-ink outline-none"
        />

        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Button variant="primary" onClick={run} disabled={pending || !text.trim()}>
            {pending ? "导入中…" : "开始导入"}
          </Button>
          <span className="font-mono text-[11px] text-dim">{lines ? `${lines} 行` : "空"}</span>
        </div>
      </div>

      {result && (
        <pre className="whitespace-pre-wrap border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink">
          {result}
        </pre>
      )}

      <div className="border border-line bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-muted">
        规则：slug 重复或分类不存在会被跳过并列出原因；新导入的资源状态为
        <span className="text-ink">已发布</span>、链接状态为
        <span className="text-ink">待校验</span>，跑一次
        <code className="mx-1 font-mono text-ink">pnpm links:check</code>
        之后才会有真实状态。
      </div>
    </div>
  );
}
