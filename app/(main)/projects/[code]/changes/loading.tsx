import { Skeleton } from "@/components/ui/skeleton";

export default function ChangesLoading() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-3 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <Skeleton className="h-16" />

      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
