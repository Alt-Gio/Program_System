"use client";
import { Suspense } from "react";

import { useMemo, useState } from "react";
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

type EligibilityStatus = "eligible" | "borderline" | "not_eligible";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "applied",
  "under_review",
  "accepted",
  "in_progress",
  "completed",
];

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  applied: "var(--lh-text-2)",
  under_review: "#ff8c42",
  accepted: "#22d3a0",
  in_progress: "#5b6cff",
  completed: "#7c8bff",
};

const ELIGIBILITY_COLOR: Record<EligibilityStatus, string> = {
  eligible: "#22d3a0",
  borderline: "#ff8c42",
  not_eligible: "#ff5f6d",
};

function ManageOpportunitiesPageInner() {
  const { userId, role, isMentor, isAdmin, loading } = useLearnhubSession();
  const user = useQuery(api.learnhub_users.getUser, userId ? { id: userId as Id<"learnhub_users"> } : "skip");
  const users = useQuery(api.learnhub_users.listUsers, {});
  const [selectedOppId, setSelectedOppId] = useState<Id<"learnhub_work_opportunities"> | null>(null);
  const [referralStudentId, setReferralStudentId] = useState("");
  const [referralNote, setReferralNote] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = role === "org_partner" || isAdmin || (user?.role === "mentor" && user.mentorStatus === "verified");
  const students = useMemo(() => (users ?? []).filter((u) => u.role === "student"), [users]);

  const opportunities = useQuery(
    api.learnhub_work.listOrgOpportunities,
    canManage && userId ? { actorId: userId as Id<"learnhub_users"> } : "skip"
  );

  const applications = useQuery(
    api.learnhub_work.listApplicationsForOpportunity,
    selectedOppId ? { opportunityId: selectedOppId } : "skip"
  );

  const updateStatus = useMutation(api.learnhub_work.updateApplicationStatus);
  const endorse = useMutation(api.learnhub_work.endorseApplication);
  const closeOpp = useMutation(api.learnhub_work.closeOpportunity);
  const referStudent = useMutation(api.learnhub_work.referStudentToOpportunity);

  if (loading || (userId && user === undefined)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--lh-card)" }} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-4xl mb-3">ðŸ”’</p>
        <h1 className="text-xl font-bold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>Verified creators only</h1>
        <p className="text-sm mt-2 mb-4" style={{ color: "var(--lh-text-2)" }}>
          Only admins, verified mentors, and org partners can manage opportunities.
        </p>
        <Link href="/learnhub/work" className="text-sm font-semibold" style={{ color: "#7c8bff" }}>
          â† Back to Opportunities
        </Link>
      </div>
    );
  }

  const handleStatus = async (
    applicationId: Id<"learnhub_work_applications">,
    status: ApplicationStatus
  ) => {
    if (!userId) return;
    setNotice("");
    try {
      await updateStatus({
        applicationId,
        status,
        actorId: userId as Id<"learnhub_users">,
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Status update failed.");
    }
  };

  const handleEndorse = async (applicationId: Id<"learnhub_work_applications">) => {
    if (!userId) return;
    setNotice("");
    try {
      await endorse({
        applicationId,
        mentorId: userId as Id<"learnhub_users">,
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Endorsement failed.");
    }
  };

  const handleClose = async (opportunityId: Id<"learnhub_work_opportunities">) => {
    if (!userId) return;
    setNotice("");
    try {
      await closeOpp({ opportunityId, actorId: userId as Id<"learnhub_users"> });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Close failed.");
    }
  };

  const handleRefer = async () => {
    if (!userId || !selectedOppId || !referralStudentId) return;
    setNotice("");
    try {
      await referStudent({
        opportunityId: selectedOppId,
        studentId: referralStudentId as Id<"learnhub_users">,
        actorId: userId as Id<"learnhub_users">,
        note: referralNote.trim() || undefined,
      });
      setReferralStudentId("");
      setReferralNote("");
      setNotice("Referral sent. The student can accept it from their opportunities feed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Referral failed.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 lh-work-page">
      <Link href="/learnhub/work" className="text-xs font-semibold mb-3 inline-block" style={{ color: "#7c8bff" }}>
        â† Back to Opportunities
      </Link>

      <div className="flex items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>Manage Opportunities</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lh-text-2)" }}>Review matched applicants, endorse candidates, and pass opportunities to students.</p>
        </div>
        <Link
          href="/learnhub/work/post"
          className="text-xs px-3 py-2 rounded-lg font-semibold shrink-0"
          style={{ background: "#ff8c42", color: "#fff", fontFamily: "var(--font-sora)" }}
        >
          + New
        </Link>
      </div>

      {notice && <p className="text-sm mb-3 rounded-xl px-3 py-2" style={{ color: notice.includes("sent") ? "#22d3a0" : "#ff5f6d", background: "var(--lh-card-3)", border: "1px solid rgba(255,255,255,0.08)" }}>{notice}</p>}

      {opportunities === undefined && (
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--lh-card)" }} />
      )}

      {opportunities && opportunities.length === 0 && (
        <div className="text-center py-12 rounded-2xl" style={{ background: "var(--lh-card)", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <p className="text-3xl mb-2">ðŸ“‹</p>
          <p className="font-semibold" style={{ color: "var(--lh-text)" }}>No opportunities posted yet</p>
          <p className="text-sm mt-1 mb-3" style={{ color: "var(--lh-text-2)" }}>Post your first opening to start receiving applications.</p>
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
            <div key={opp._id} className="rounded-2xl overflow-hidden" style={{ background: "var(--lh-card)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => {
                  setSelectedOppId(isSelected ? null : opp._id);
                  setReferralStudentId("");
                  setReferralNote("");
                }}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold" style={{ color: "var(--lh-text)", fontFamily: "var(--font-sora)" }}>{opp.title}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isOpen ? "rgba(34,211,160,0.15)" : "rgba(255,95,109,0.15)", color: isOpen ? "#22d3a0" : "#ff5f6d" }}>
                      {opp.status}
                    </span>
                    {opp.eligibilityMode && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(91,108,255,0.12)", color: "#7c8bff" }}>{opp.eligibilityMode}</span>}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--lh-text-2)" }}>
                    {opp.workType} Â· {opp.payType}
                    {opp.payAmount ? ` Â· ${opp.payAmount}` : ""} Â·{" "}
                    {(opp.filledSlots ?? 0)}/{opp.slots} slots Â· Apply by {format(opp.deadline, "MMM d")}
                  </p>
                </div>
                <span className="text-xs" style={{ color: "#7c8bff" }}>{isSelected ? "â–¼" : "â–¶"}</span>
              </button>

              {isSelected && (
                <div className="px-5 pb-5 border-t" style={{ borderColor: "var(--lh-border)" }}>
                  <div className="flex items-center justify-between mt-3 mb-3">
                    <p className="text-xs font-semibold" style={{ color: "var(--lh-text-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Applicants</p>
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

                  <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(91,108,255,0.06)", border: "1px solid rgba(91,108,255,0.16)" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--lh-text)" }}>Pass this opportunity to a student</p>
                    <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_auto]">
                      <select value={referralStudentId} onChange={(e) => setReferralStudentId(e.target.value)} className="text-xs rounded-lg px-2 py-2 outline-none" style={{ background: "var(--lh-input-bg)", color: "var(--lh-text)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <option value="">Choose student</option>
                        {students.map((student) => <option key={student._id} value={student._id}>{student.name}</option>)}
                      </select>
                      <input value={referralNote} onChange={(e) => setReferralNote(e.target.value)} placeholder="Optional referral reason" className="text-xs rounded-lg px-2 py-2 outline-none" style={{ background: "var(--lh-input-bg)", color: "var(--lh-text)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      <button onClick={handleRefer} disabled={!referralStudentId} className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40" style={{ background: "#22d3a0", color: "#06111f" }}>Refer</button>
                    </div>
                  </div>

                  {applications === undefined && (
                    <div className="h-20 rounded-xl animate-pulse" style={{ background: "var(--lh-card-3)" }} />
                  )}

                  {applications && applications.length === 0 && (
                    <p className="text-sm py-4" style={{ color: "var(--lh-text-2)" }}>No applicants yet.</p>
                  )}

                  <div className="flex flex-col gap-2">
                    {(applications ?? []).map((app) => {
                      const eligibility = app.eligibilityStatus as EligibilityStatus | undefined;
                      const eligibilityColor = eligibility ? ELIGIBILITY_COLOR[eligibility] : "var(--lh-text-2)";
                      return (
                        <div key={app._id} className="rounded-xl p-3 flex items-start justify-between gap-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${eligibilityColor}33` }}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--lh-text)" }}>{app.student?.name ?? "Unknown student"}</p>
                              {eligibility && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: eligibilityColor + "20", color: eligibilityColor }}>{eligibility.replace("_", " ")} Â· {app.matchScore ?? 0}%</span>}
                            </div>
                            <p className="text-xs truncate" style={{ color: "var(--lh-text-2)" }}>{app.student?.email ?? ""}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(app.student?.expertiseTags ?? []).slice(0, 5).map((tag) => <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: "#7c8bff", background: "rgba(91,108,255,0.1)" }}>{tag}</span>)}
                              {app.student?.xpPoints !== undefined && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: "#ff8c42", background: "rgba(255,140,66,0.1)" }}>{app.student.xpPoints.toLocaleString()} XP</span>}
                            </div>
                            {app.note && <p className="text-xs mt-2 italic" style={{ color: "#c8caf0" }}>&quot;{app.note}&quot;</p>}
                            {app.reasoningNote && app.reasoningNote !== app.note && <p className="text-xs mt-2" style={{ color: "#c8caf0" }}>Reasoning: {app.reasoningNote}</p>}
                            {app.missingRequirements && app.missingRequirements.length > 0 && <p className="text-[10px] mt-2" style={{ color: "#ff8c42" }}>Missing: {app.missingRequirements.join(" Â· ")}</p>}
                            {app.mentorEndorsement && (
                              <p className="text-[10px] mt-1 font-semibold" style={{ color: "#22d3a0" }}>â˜… Endorsed{app.endorsedByUser?.name ? ` by ${app.endorsedByUser.name}` : ""}</p>
                            )}
                            {app.referral && (
                              <p className="text-[10px] mt-1 font-semibold" style={{ color: "#7c8bff" }}>â†— Applied from referral</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <select
                              value={app.status}
                              onChange={(e) => handleStatus(app._id, e.target.value as ApplicationStatus)}
                              className="text-xs px-2 py-1 rounded-lg outline-none"
                              style={{ background: "var(--lh-input-bg)", color: STATUS_COLOR[app.status as ApplicationStatus], border: `1px solid ${STATUS_COLOR[app.status as ApplicationStatus]}40` }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s} style={{ color: "var(--lh-text)", background: "var(--lh-input-bg)" }}>
                                  {s.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                            {(isMentor || isAdmin) && !app.mentorEndorsement && (
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
                      );
                    })}
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

export default function ManageOpportunitiesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <ManageOpportunitiesPageInner />
    </Suspense>
  )
}