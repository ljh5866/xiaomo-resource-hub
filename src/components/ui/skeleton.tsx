import { cn } from "@/lib/utils";

/** 骨架形状必须与真实内容一致（DESIGN.md §5.6） */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse bg-surface-2", className)}
      style={{ animationDuration: "1.6s" }}
    />
  );
}

export function ResourceCardSkeleton() {
  return (
    <div className="border border-line bg-surface">
      <Skeleton className="aspect-[21/9] w-full sm:aspect-[16/10]" />
      <div className="space-y-2 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ResourceCardSkeleton key={i} />
      ))}
    </div>
  );
}
