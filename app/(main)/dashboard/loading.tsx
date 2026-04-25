import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Strip: pending imports + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Skeleton className="h-[360px]" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
          <Skeleton className="h-[220px]" />
        </div>
      </div>

      {/* Programs grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
        </div>
      </div>
    </div>
  );
}
