import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page py-12">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-4 w-full max-w-lg" />
      <div className="mt-10">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  );
}
