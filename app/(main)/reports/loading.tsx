import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[240px]" />
        <Skeleton className="h-[240px]" />
      </div>
      <Skeleton className="h-[360px]" />
    </div>
  );
}
