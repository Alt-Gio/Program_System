import { Skeleton } from "@/components/ui/skeleton";

export default function ShortcutsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
