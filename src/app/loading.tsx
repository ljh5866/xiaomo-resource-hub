import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * 全局加载骨架。
 * 动态页（分类 / 详情 / 搜索）要等服务端 1s+，没有可见反馈时用户会以为「点了没反应」，
 * 所以这里同时给三样东西：顶部进度条（最先被看到）+ 文字提示 + 与真实版式一致的骨架。
 */
export default function Loading() {
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent/10" aria-hidden>
        <div
          className="h-full w-1/3 bg-accent"
          style={{ animation: "loading-bar 1.1s ease-in-out infinite" }}
        />
      </div>

      <div className="container-page py-12">
        <p className="font-mono text-[11px] tracking-[0.14em] text-dim">加载中…</p>
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-6 h-10 w-2/3 max-w-xl" />
        <Skeleton className="mt-4 h-4 w-full max-w-lg" />
        <div className="mt-10">
          <CardGridSkeleton count={6} />
        </div>
      </div>
    </>
  );
}
