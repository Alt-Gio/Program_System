"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Building2 } from "lucide-react";

// Exact contents of the original /personnel page, unchanged — just
// extracted into its own component so the page can wrap it in tabs.
export function StaffDirectoryTab() {
  const personnel = useQuery(api.personnel.list, { isActive: true });
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {personnel?.length ?? 0} active personnel
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(personnel ?? []).map((p) => (
          <Card key={p._id}>
            <CardContent className="flex items-start gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <span className="text-sm font-bold text-blue-700">
                  {p.firstName[0]}
                  {p.lastName[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">
                  {p.firstName} {p.lastName}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {p.position}
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Building2 className="h-3 w-3" />
                  {p.division}
                </div>
                {p.email && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
