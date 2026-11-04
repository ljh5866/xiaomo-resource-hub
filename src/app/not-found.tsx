import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page grid place-items-center py-24">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] tracking-[0.22em] text-dim">404 · NOT IN INDEX</p>
        <h1 className="mt-4 font-sans text-[32px] font-bold text-ink">
          这张卡片不在目录里
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          可能资源已下架，或者链接地址抄错了。试试搜索，或者从分类重新进去。
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <ButtonLink href="/" variant="primary">回首页</ButtonLink>
          <ButtonLink href="/search" variant="secondary">去搜索</ButtonLink>
        </div>
        <p className="mt-6 text-[12px] text-dim">
          编号形如 <span className="font-mono">XM-2026-0417</span>，可在
          <Link href="/search" className="text-accent"> 搜索框 </Link>
          直接粘贴。
        </p>
      </div>
    </div>
  );
}
