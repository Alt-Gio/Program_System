"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Building2 } from "lucide-react";

export default function PersonnelPage() {
  const personnel = useQuery(api.personnel.list, { isActive: true });
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{personnel?.length ?? 0} active personnel</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(personnel ?? []).map(p => (
          <Card key={p._id}>
            <CardContent className="p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-700">{p.firstName[0]}{p.lastName[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{p.position}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Building2 className="w-3 h-3" />{p.division}
                </div>
                {p.email && <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                  <Mail className="w-3 h-3" /><span className="truncate">{p.email}</span>
                </div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
