"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import type { Id } from "@/convex/_generated/dataModel";

type ApplicationStatus =
  | "applied"
  | "under_review"
  | "accepted"
  | "in_progress"
  | "completed";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "applied",
  "under_review",
  "accepted",
  "in_progress",
  "completed",
];

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  applied: "#9ba3cc",
  under_review: "#ff8c42",
  accepted: "#22d3a0",
  in_progress: "#5b6cff",
  completed: "#7c8bff",
};

export default function ManageOpportunitiesPage() {
  const { userId, role, isMentor, isAdmin, loading } = useLearnhubSession();
  const [selectedOppId, setSelectedOppId] = useState<Id<"learnhub_work_opportunities"> | null>(null);

  const canManage = role === "org_partner" || isAdmin;

  const opportunities = useQuery(
    api.learnhub_work.listOrgOpportunities,
    canManage && userId ? { orgId: userId as Id<"learnhub_users"> } : "skip"
  );

  const applications = useQuery(
    api.learnhub_work.listApplicationsForOpportunity,
    selectedOppId ? { opportunityId: selectedOppId } : "skip"
  );

  const updateStatus = useMutation(api.learnhub_work.updateApplicationStatus);
  const endorse = useMutation(api.learnhub_work.endorseApplication);
  const closeOpp = useMutation(api.learnhub_work.closeOpportunity);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: "#131626" }} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Org Partners only</h1>
        <p className="text-sm mt-2 mb-4" style={{ color: "#9ba3cc" }}>
          Only org_partner accounts can manage opportunities.
        </p>
        <Link href="/learnhub/work" className="text-sm font-semibold" style={{ color: "#7c8bff" }}>
          ← Back to Opportunities
        </Link>
      </div>
    );
  }

  const handleStatus = async (
    applicationId: Id<"learnhub_work_applications">,
    status: ApplicationStatus
  ) => {
    if (!userId) return;
    try {
      await updateStatus({
        applicationId,
        status,
        actorId: userId as Id<"learnhub_users">,
      });
    } catch (err) {
      console.error("[manage] status update failed:", err);
    }
  };

  const handleEndorse = async (applicationId: Id<"learnhub_work_applications">) => {
    if (!userId) return;
    try {
      await endorse({
        applicationId,
        mentorId: userId as Id<"learnhub_users">,
      });
    } catch (err) {
      console.error("[manage] endorse failed:", err);
    }
  };

  const handleClose = async (opportunityId: Id<"learnhub_work_opportunities">) => {
    if (!userId) return;
    try {
      await closeOpp({ opportunityId, actorId: userId as Id<"learnhub_users"> });
    } catch (err) {
      console.error("[manage] close failed:", err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/learnhub/work" className="text-xs font-semibold mb-3 inline-block" style={{ color: "#7c8bff" }}>
        ← Back to Opportunities
      </Link>

      <div className="flex items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>Manage Opportunities</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>Review applicants and update their status.</p>
        </div>
        <Link
          href="/learnhub/work/post"
          className="text-xs px-3 py-2 rounded-lg font-semibold shrink-0"
          style={{ background: "#ff8c42", color: "#fff", fontFamily: "var(--font-sora)" }}
        >
          + New
        </Link>
      </div>

      {opportunities === undefined && (
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "#131626" }} />
      )}

      {opportunities && opportunities.length === 0 && (
        <div className="text-center py-12 rounded-2xl" style={{ background: "#131626", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold" style={{ color: "#e8eaff" }}>No opportunities posted yet</p>
          <p className="text-sm mt-1 mb-3" style={{ color: "#9ba3cc" }}>Post your first opening to start receiving applications.</p>
          <Link href="/learnhub/work/post" className="text-sm font-semibold px-4 py-2 rounded-xl inline-block" style={{ background: "#ff8c42", color: "#fff" }}>
            Post your first opportunity
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(opportunities ?? []).map((opp) => {
          const isOpen = opp.status === "open";
          const isSelected = selectedOppId === opp._id;
          return (
            <div key={opp._id} className="rounded-2xl overflow-hidden" style={{ background: "#131626", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setSelectedOppId(isSelected ? null : opp._id)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{opp.title}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isOpen ? "rgba(34,211,160,0.15)" : "rgba(255,95,109,0.15)", color: isOpen ? "#22d3a0" : "#ff5f6d" }}>
                      {opp.status}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#9ba3cc" }}>
                    {opp.workType} · {opp.payType}
                    {opp.payAmount ? ` · ${opp.payAmount}` : ""} ·{" "}
                    {(opp.filledSlots ?? 0)}/{opp.slots} slots · Apply by {format(opp.deadline, "MMM d")}
                  </p>
                </div>
                <span className="text-xs" style={{ color: "#7c8bff" }}>{isSelected ? "▼" : "▶"}</span>
              </button>

              {isSelected && (
                <div className="px-5 pb-5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mt-3 mb-3">
                    <p className="text-xs font-semibold" style={{ color: "#9ba3cc", letterSpacing: "0.06em", textTransform: "uppercase" }}>Applicants</p>
                    {isOpen && (
                      <button
                        onClick={() => handleClose(opp._id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: "rgba(255,95,109,0.1)", color: "#ff5f6d", border: "1px solid rgba(255,95,109,0.3)" }}
                      >
                        Close opportunity
                      </button>
                    )}
                  </div>

                  {applications === undefined && (
                    <div className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                  )}

                  {applications && applications.length === 0 && (
                    <p className="text-sm py-4" style={{ color: "#9ba3cc" }}>No applicants yet.</p>
                  )}

                  <div className="flex flex-col gap-2">
                    {(applications ?? []).map((app) => (
                      <div key={app._id} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#e8eaff" }}>{app.student?.name ?? "Unknown student"}</p>
                          <p className="text-xs truncate" style={{ color: "#9ba3cc" }}>{app.student?.email ?? ""}</p>
                          {app.note && <p className="text-xs mt-1 italic" style={{ color: "#c8caf0" }}>"{app.note}"</p>}
                          {app.mentorEndorsement && (
                            <p className="text-[10px] mt-1 font-semibold" style={{ color: "#22d3a0" }}>★ Mentor endorsed</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatus(app._id, e.target.value as ApplicationStatus)}
                            className="text-xs px-2 py-1 rounded-lg outline-none"
                            style={{ background: "#0d0f1a", color: STATUS_COLOR[app.status as ApplicationStatus], border: `1px solid ${STATUS_COLOR[app.status as ApplicationStatus]}40` }}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} style={{ color: "#e8eaff", background: "#0d0f1a" }}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                          {isMentor && !app.mentorEndorsement && (
                            <button
                              onClick={() => handleEndorse(app._id)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                              style={{ background: "rgba(34,211,160,0.12)", color: "#22d3a0", border: "1px solid rgba(34,211,160,0.3)" }}
                            >
                              Endorse
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
