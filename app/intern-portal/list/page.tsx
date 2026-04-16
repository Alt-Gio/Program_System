"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Search, Plus, ChevronRight, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials, fmtH, STATUS_CFG } from "../_utils";

const STATUS_OPTS = ["ALL","ACTIVE","COMPLETED","ON_LEAVE","INACTIVE"] as const;

export default function AllInternsPage() {
  const interns  = useQuery(api.interns.list);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<string>("ALL");
  const loading = interns === undefined;

  const filtered = useMemo(() => {
    if (!interns) return [];
    return interns.filter(i => {
      const q = search.toLowerCase();
      const matchQ = !q || i.fullName.toLowerCase().includes(q) || i.school.toLowerCase().includes(q) || (i.course ?? "").toLowerCase().includes(q);
      const matchS = status === "ALL" || i.status === status;
      return matchQ && matchS;
    });
  }, [interns, search, status]);

  const stats = useMemo(() => {
    if (!interns) return null;
    return {
      total:     interns.length,
      active:    interns.filter(i => i.status === "ACTIVE").length,
      completed: interns.filter(i => i.status === "COMPLETED").length,
      onLeave:   interns.filter(i => i.status === "ON_LEAVE").length,
    };
  }, [interns]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Interns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete roster of all registered interns</p>
        </div>
        <Link href="/interns"><Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow shrink-0"><Plus className="w-4 h-4" />Add Intern</Button></Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",     val: stats?.total ?? 0,     color: "text-gray-900" },
          { label: "Active",    val: stats?.active ?? 0,    color: "text-green-600" },
          { label: "Completed", val: stats?.completed ?? 0, color: "text-blue-600" },
          { label: "On Leave",  val: stats?.onLeave ?? 0,   color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            {loading ? <Skeleton className="h-7 w-8 mx-auto mb-1" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name, school, or course…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-white text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                status === s ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}>{s === "ALL" ? "All" : s.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <GraduationCap className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">{search || status !== "ALL" ? "No interns match your filters" : "No interns registered yet"}</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold">
                <th className="px-4 py-3 text-left w-8">#</th>
                <th className="px-4 py-3 text-left">Intern</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">School</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Department</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Hours</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((intern, idx) => {
                const cfg  = STATUS_CFG[intern.status] ?? STATUS_CFG.INACTIVE;
                const color = avatarColor(intern.fullName);
                const pct  = intern.requiredHours > 0 ? Math.min(100, Math.round((intern.totalHours / intern.requiredHours) * 100)) : 0;
                const barC = pct >= 100 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
                return (
                  <tr key={intern.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-3 text-gray-400 font-medium tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm" style={{ backgroundColor: color }}>{initials(intern.fullName)}</div>
                          <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white", cfg.dot)} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{intern.fullName}</p>
                          <p className="text-[11px] text-gray-400 truncate">{intern.course ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell truncate max-w-[160px]">{intern.school}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{intern.department ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="min-w-[90px]">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                          <span>{fmtH(intern.totalHours)}</span><span className="font-bold tabular-nums" style={{ color: barC }}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barC }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{intern.requiredHours}h required</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.badge)}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/interns/${intern.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
                          View <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">Showing {filtered.length} of {interns?.length ?? 0} interns</p>
            <div className="flex items-center gap-1 text-[11px] text-gray-400"><Users className="w-3 h-3" />{stats?.active ?? 0} active</div>
          </div>
        )}
      </div>
    </div>
  );
}
