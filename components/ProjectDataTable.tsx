"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, numberWithCommas } from "@/lib/utils";
import {
  Database, TrendingUp, TrendingDown, Minus, Users, Download, Tag,
  MapPin, Server, Code, Wifi, Network, HardDrive,
  Trash2, Upload, Plus, Settings as SettingsIcon,
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { DICT_PROJECTS } from "@/lib/types";

interface ProjectDataTableProps {
  projectId: Id<"projects">;
  projectCode: string;
  projectColor: string;
  year?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Download, Tag, MapPin, Server, Code, Wifi, Network, HardDrive,
  Database, TrendingUp, TrendingDown, Minus,
};

export function ProjectDataTable({ projectId, projectCode, projectColor, year }: ProjectDataTableProps) {
  // Get project-specific highlight fields
  const projectDef = DICT_PROJECTS.find(p => p.code === projectCode);
  const highlightFields = projectDef?.highlightFields || [
    { key: "participants", label: "Total Participants", icon: "Users", format: "number" as const, source: "computed" as const },
    { key: "venue", label: "Venue/Location", icon: "MapPin", format: "text" as const, source: "activity" as const },
    { key: "status", label: "Status", icon: "Tag", format: "text" as const, source: "activity" as const },
  ];
  
  const [highlightField, setHighlightField] = useState<string>(highlightFields[0]?.key || "participants");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const activities = useQuery(api.activities.listActivities, {
    projectId,
    year,
  });
  const deleteActivity = useMutation(api.activities.deleteActivity);
  const logAction = useMutation(api.import_log.logManualAction);

  if (!activities) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const selectedField = highlightFields.find(f => f.key === highlightField);

  // Calculate statistics for the highlighted field
  const getFieldValue = (activity: any, fieldKey: string) => {
    const field = highlightFields.find(f => f.key === fieldKey);
    if (!field) return null;

    // Handle different data sources
    switch (field.source) {
      case "computed":
        // Special computed fields
        if (fieldKey === "participants") {
          const p = activity.participants;
          return p.nga.male + p.nga.female + p.lgu.male + p.lgu.female + 
                 p.suc.male + p.suc.female + p.others.male + p.others.female;
        }
        if (field.computeFn) {
          return field.computeFn(activity);
        }
        return null;
      
      case "extraFields":
        // Get from extraFields object
        return activity.extraFields?.[fieldKey] ?? "N/A";
      
      case "activity":
        // Get directly from activity object
        return activity[fieldKey] ?? "N/A";
      
      case "participants":
        // Get from participants breakdown
        const p = activity.participants;
        if (fieldKey === "male") {
          return p.nga.male + p.lgu.male + p.suc.male + p.others.male;
        }
        if (fieldKey === "female") {
          return p.nga.female + p.lgu.female + p.suc.female + p.others.female;
        }
        return null;
      
      default:
        return activity[fieldKey] ?? "N/A";
    }
  };

  // Get statistics
  const values = activities.map(a => getFieldValue(a, highlightField)).filter(v => typeof v === "number") as number[];
  const maxValue = values.length > 0 ? Math.max(...values) : 0;
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const avgValue = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  // Sort activities by highlighted field
  const sortedActivities = [...activities].sort((a, b) => {
    const valA = getFieldValue(a, highlightField);
    const valB = getFieldValue(b, highlightField);

    if (typeof valA === "number" && typeof valB === "number") {
      return valB - valA; // Descending for numbers
    }
    return 0;
  });

  const allVisibleIds = sortedActivities.map((a) => String(a._id));
  const allSelected =
    selected.size > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      allSelected ? new Set() : new Set(allVisibleIds),
    );
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const count = selected.size;
    const ok = confirm(
      `Delete ${count} activit${count === 1 ? "y" : "ies"}? This cannot be undone after this session.`,
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const ids = Array.from(selected) as Id<"activities">[];
      for (const id of ids) {
        await deleteActivity({ id });
      }
      try {
        await logAction({
          program: projectDef?.shortName ?? projectCode,
          action: "bulk_delete",
          entityType: "activity",
          summary: `Bulk-deleted ${count} activit${count === 1 ? "y" : "ies"} from ${projectDef?.shortName ?? projectCode}`,
          detail: { count, ids },
          affectedRows: count,
          isVoiceInitiated: false,
        });
      } catch {
        // audit log is best-effort
      }
      toast.success(`Deleted ${count} activit${count === 1 ? "y" : "ies"}`);
      clearSelection();
    } catch (e: any) {
      toast.error(`Bulk delete failed: ${e?.message ?? e}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkExport = () => {
    const ids = Array.from(selected);
    const rows = sortedActivities.filter((a) => ids.includes(String(a._id)));
    if (rows.length === 0) return;
    const header =
      "Title,Start Date,End Date,Venue,Status,Participants,Remarks";
    const csv = [
      header,
      ...rows.map((a) => {
        const p = a.participants;
        const total =
          p.nga.male +
          p.nga.female +
          p.lgu.male +
          p.lgu.female +
          p.suc.male +
          p.suc.female +
          p.others.male +
          p.others.female;
        return [
          csvCell(a.activityTitle),
          csvCell(a.startDate),
          csvCell(a.endDate),
          csvCell(a.venue),
          csvCell(a.status),
          total,
          csvCell(a.remarks ?? ""),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectCode}-selected-${ids.length}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${ids.length} rows as CSV`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" style={{ color: projectColor }} />
              Project Data Table
            </CardTitle>
            <CardDescription className="mt-1">
              Connected to Google Sheets · {activities.length} activities
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Highlight:</span>
            <Select value={highlightField} onValueChange={setHighlightField}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {highlightFields.map(field => {
                  const Icon = field.icon ? ICON_MAP[field.icon] : Database;
                  return (
                    <SelectItem key={field.key} value={field.key}>
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {field.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics for highlighted field */}
        {selectedField?.format === "number" && values.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                <span className="text-[10px] font-semibold text-green-700 uppercase">Highest</span>
              </div>
              <p className="text-xl font-bold text-green-700">{numberWithCommas(maxValue)}</p>
              <p className="text-[10px] text-green-600 mt-0.5">{selectedField.label}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Minus className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-semibold text-blue-700 uppercase">Average</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{numberWithCommas(avgValue)}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">{selectedField.label}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] font-semibold text-amber-700 uppercase">Lowest</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{numberWithCommas(minValue)}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">{selectedField.label}</p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {selected.size > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="text-sm font-semibold text-blue-900">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-blue-300 bg-white text-xs"
              onClick={handleBulkExport}
            >
              <Download className="h-3 w-3" /> Export selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-red-200 bg-white text-xs text-red-600 hover:bg-red-50"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3" /> {deleting ? "Deleting…" : "Delete selected"}
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-xs text-blue-700 hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="w-10 px-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </TableHead>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="min-w-[250px]">Activity Title</TableHead>
                  <TableHead className="text-center">Province</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-bold" style={{ color: projectColor }}>
                        {selectedField?.label}
                      </span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: projectColor }} />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActivities.map((activity, index) => {
                  const fieldValue = getFieldValue(activity, highlightField);
                  const isMax = selectedField?.type === "number" && fieldValue === maxValue;
                  const isMin = selectedField?.type === "number" && fieldValue === minValue;
                  
                  const isSelected = selected.has(String(activity._id));
                  return (
                    <TableRow
                      key={activity._id}
                      className={cn(
                        "hover:bg-gray-50 transition-colors",
                        isMax && "bg-green-50 hover:bg-green-100",
                        isMin && values.length > 1 && "bg-amber-50 hover:bg-amber-100",
                        isSelected && "bg-blue-50 hover:bg-blue-100"
                      )}
                    >
                      <TableCell className="w-10 px-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${activity.activityTitle}`}
                          checked={isSelected}
                          onChange={() => toggleRow(String(activity._id))}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-500 font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" 
                            style={{ backgroundColor: projectColor }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {activity.activityTitle}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{activity.venue}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-gray-600">{activity.province || "N/A"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-gray-600">
                          {formatDate(activity.startDate, "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {selectedField?.format === "number" && typeof fieldValue === "number" && (
                            <>
                              <span className={cn(
                                "text-sm font-bold",
                                isMax && "text-green-700",
                                isMin && values.length > 1 && "text-amber-700",
                                !isMax && !isMin && "text-gray-900"
                              )}>
                                {numberWithCommas(fieldValue)}
                              </span>
                              {isMax && (
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5 py-0">
                                  MAX
                                </Badge>
                              )}
                              {isMin && values.length > 1 && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0">
                                  MIN
                                </Badge>
                              )}
                            </>
                          )}
                          {selectedField?.format === "text" && (
                            <span className="text-xs text-gray-700 truncate max-w-[200px]">
                              {fieldValue as string}
                            </span>
                          )}
                          {selectedField?.format === "date" && typeof fieldValue === "number" && (
                            <span className="text-xs text-gray-700">
                              {formatDate(fieldValue, "MMM d, yyyy")}
                            </span>
                          )}
                          {selectedField?.format === "list" && (
                            <span className="text-xs text-gray-700 truncate max-w-[200px]">
                              {Array.isArray(fieldValue) ? fieldValue.join(", ") : fieldValue as string}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] px-2 py-0.5",
                            activity.status === "Reported" && "bg-green-50 text-green-700 border-green-300",
                            activity.status === "Validated" && "bg-blue-50 text-blue-700 border-blue-300",
                            activity.status === "Submitted" && "bg-amber-50 text-amber-700 border-amber-300",
                            activity.status === "Draft" && "bg-gray-50 text-gray-700 border-gray-300"
                          )}
                        >
                          {activity.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              No activities yet for {projectDef?.shortName ?? projectCode}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Connect a Google Sheet, import a CSV, or add manually.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href={`/import-log?program=${encodeURIComponent(projectDef?.shortName ?? "")}`}
              >
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Import CSV or paste
                </Button>
              </Link>
              <Link href={`/projects/${projectCode.toLowerCase()}`}>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add manually
                </Button>
              </Link>
              <Link href={`/projects/${projectCode.toLowerCase()}`}>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <SettingsIcon className="h-3.5 w-3.5" /> Connect sheet
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function csvCell(s: string): string {
  const str = String(s ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
