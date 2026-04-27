import { Skeleton } from "@/components/ui/skeleton";

// Tailored skeleton for /activities/new — mirrors the multi-card form
// (Program & Location, Activity Details, Schedule, Participants, Reports)
// so the user perceives instant navigation while Convex hydrates.
export default function NewActivityLoading() {
  return (
    <div className="page-content max-w-4xl mx-auto space-y-6">
      {Array.from({ length: 4 }).map((_, card) => (
        <div
          key={card}
          className="rounded-xl border border-gray-200 p-5 space-y-4"
        >
          {/* CardHeader */}
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          {/* Two-column field grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
