"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import dynamic from "next/dynamic";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

// Recharts is split out of this page's initial chunk — the page shell
// (KPI tiles, headings) paints immediately, charts hydrate after.
const chartLoader = () => (
  <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ba3cc", fontSize: 12 }}>
    Loading chart…
  </div>
);
const ModalityPieChart = dynamic(
  () => import("@/components/learnhub/mentor/MentorReportCharts").then((m) => m.ModalityPieChart),
  { ssr: false, loading: chartLoader },
);
const ProvinceBarChart = dynamic(
  () => import("@/components/learnhub/mentor/MentorReportCharts").then((m) => m.ProvinceBarChart),
  { ssr: false, loading: chartLoader },
);
const SectorPieChart = dynamic(
  () => import("@/components/learnhub/mentor/MentorReportCharts").then((m) => m.SectorPieChart),
  { ssr: false, loading: chartLoader },
);
const CategoryBarChart = dynamic(
  () => import("@/components/learnhub/mentor/MentorReportCharts").then((m) => m.CategoryBarChart),
  { ssr: false, loading: chartLoader },
);

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const CURRENT_YEAR = new Date().getFullYear();

const PROVINCE_ABBR: Record<string, string> = {
  "Camarines Sur": "CS",
  "Albay": "AL",
  "Sorsogon": "SR",
  "Masbate": "MS",
  "Catanduanes": "CT",
  "Camarines Norte": "CN",
};

const SECTOR_LABELS: Record<string, string> = {
  gov_workforce: "Gov Workforce",
  education: "Education Sector",
  vulnerable: "Vulnerable Groups",
  private: "Private Sector",
  other: "Other",
};

const VULNERABLE_LABELS: Record<string, string> = {
  pdl: "PDLs (BJMP)",
  als: "ALS Students",
  arb: "ARBs",
  senior: "Senior Citizens",
  pwd: "Persons w/ Disability",
  ip: "Indigenous People",
  other_vulnerable: "Other",
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "#131626", borderRadius: 16, padding: "20px 22px",
      border: "1px solid rgba(255,255,255,0.07)", flex: 1, minWidth: 0,
    }}>
      <p style={{ fontSize: 22, marginBottom: 8 }}>{icon}</p>
      <p style={{ color: "#9ba3cc", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#e8eaff", fontSize: 28, fontWeight: 800, fontFamily: "var(--font-sora)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: "#22d3a0", fontSize: 11, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Province avatar ───────────────────────────────────────────────────────────
function ProvinceAvatar({ name, count }: { name: string; count: number }) {
  const abbr = PROVINCE_ABBR[name] ?? name.slice(0, 2).toUpperCase();
  return (
    <div title={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%", background: "rgba(91,108,255,0.15)",
        border: "2px solid #5b6cff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 13, color: "#a0acff",
      }}>{abbr}</div>
      <span style={{ color: "#9ba3cc", fontSize: 10 }}>{count}</span>
    </div>
  );
}

// ── Gender Bar ────────────────────────────────────────────────────────────────
function GenderBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#c8caf0", fontSize: 13 }}>{label}</span>
        <span style={{ color: "#e8eaff", fontSize: 13, fontWeight: 700 }}>{count.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 800ms ease" }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MentorReportPage() {
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [year, setYear] = useState(CURRENT_YEAR);

  const { userId, loading: sessionLoading } = useLearnhubSession();

  const reportData = useQuery(
    api.learnhub_reports.getQuarterlyReport,
    userId ? { mentorId: userId, quarter, year } : "skip"
  );

  const handlePrint = useCallback(() => window.print(), []);

  const isLoading = reportData === undefined;

  const totalBeneficiaries = reportData?.totalBeneficiaries ?? 0;
  const genderBreakdown = reportData?.genderBreakdown ?? { female: 0, male: 0, prefer_not_to_say: 0, unknown: 0 };
  const totalGendered = genderBreakdown.female + genderBreakdown.male + (genderBreakdown.prefer_not_to_say ?? 0);

  const modalityData = reportData?.modalityBreakdown
    ? [
        { name: "Online", value: reportData.modalityBreakdown.online },
        { name: "Face-to-Face", value: reportData.modalityBreakdown.faceToFace },
        { name: "Hybrid", value: reportData.modalityBreakdown.hybrid },
      ].filter((d) => d.value > 0)
    : [];

  const sectorData = reportData?.sectorBreakdown
    ? Object.entries(reportData.sectorBreakdown)
        .map(([k, v]) => ({ name: SECTOR_LABELS[k] ?? k, value: v as number }))
        .filter((d) => d.value > 0)
    : [];

  const categoryData = reportData?.categoryPerformance ?? [];

  const vulnerableTotal = reportData?.vulnerableGroups
    ? Object.values(reportData.vulnerableGroups).reduce((a, b) => a + (b as number), 0)
    : 0;

  const specialCampaign = (reportData?.campaigns ?? []).find((c) => c.tag === "NWM_2026") ??
    (reportData?.campaigns ?? [])[0] ?? null;

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          .learnhub-sidebar, .learnhub-topbar, .report-actions, .no-print { display: none !important; }
          .report-content { max-width: 100% !important; margin: 0 !important; }
          .report-card { break-inside: avoid; }
        }
      `}</style>

      <div className="report-content" style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ color: "#5b6cff", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
              ILCDB · Mentor Report
            </p>
            <h1 style={{ color: "#e8eaff", fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800, margin: 0 }}>
              {year} Quarterly Accomplishment
            </h1>
            <p style={{ color: "#9ba3cc", fontSize: 13, marginTop: 4 }}>
              Detailed analysis of digital literacy initiatives — {quarter} {year}
            </p>
          </div>
          <div className="report-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Quarter selector */}
            <div style={{ display: "flex", gap: 1, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
              {QUARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuarter(q)}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                    background: quarter === q ? "#5b6cff" : "transparent",
                    color: quarter === q ? "#fff" : "#9ba3cc",
                  }}
                >{q}</button>
              ))}
            </div>
            {/* Year selector */}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, color: "#e8eaff", padding: "6px 12px", fontSize: 13, cursor: "pointer",
              }}
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={handlePrint}
              style={{
                padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: "rgba(255,255,255,0.07)", color: "#c8caf0", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
              }}
            >🖨 Print PDF</button>
          </div>
        </div>

        {/* Province avatars */}
        <div className="report-card" style={{
          background: "#131626", borderRadius: 16, padding: "20px 24px", marginBottom: 16,
          border: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {(reportData?.provinceDistribution ?? []).map((p, i) => (
              <ProvinceAvatar key={p.province} name={p.province} count={p.count} />
            ))}
            {!reportData && [
              "Camarines Sur", "Albay", "Sorsogon", "Masbate", "Catanduanes", "Camarines Norte",
            ].map((p) => <ProvinceAvatar key={p} name={p} count={0} />)}
          </div>
          <p style={{ color: "#9ba3cc", fontSize: 11, marginTop: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            VERIFIED OPERATIONS TEAM · Bicol Region — {QUARTERS.indexOf(quarter) === 0 ? "January" : QUARTERS.indexOf(quarter) === 1 ? "April" : QUARTERS.indexOf(quarter) === 2 ? "July" : "October"} to {QUARTERS.indexOf(quarter) === 0 ? "March" : QUARTERS.indexOf(quarter) === 1 ? "June" : QUARTERS.indexOf(quarter) === 2 ? "September" : "December"} {year}
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <StatCard icon="📋" label="Total Trainings" value={isLoading ? "—" : (reportData?.totalTrainings ?? 0)} sub="Sessions conducted" />
          <StatCard icon="👥" label="Beneficiaries" value={isLoading ? "—" : totalBeneficiaries.toLocaleString()} sub="Successful completions" />
          <StatCard icon="📍" label="Province Coverage" value={isLoading ? "—" : `${reportData?.provinceCoverage ?? 0}%`} sub={`${reportData?.coveredProvinces?.length ?? 0} of 6 provinces`} />
          {specialCampaign && (
            <StatCard icon="⚡" label={`${specialCampaign.tag} Impact`} value={specialCampaign.studentCount.toLocaleString()} sub={`${specialCampaign.eventCount} events`} />
          )}
        </div>

        {/* Charts Row 1: Modality + Province */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 16 }}>
          <div className="report-card" style={{ background: "#131626", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Training Modality</p>
            {modalityData.length > 0 ? (
              <ModalityPieChart data={modalityData} />
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#9ba3cc", fontSize: 13 }}>No data for {quarter} {year}</p>
              </div>
            )}
          </div>

          <div className="report-card" style={{ background: "#131626", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Beneficiaries by Province</p>
            {(reportData?.provinceDistribution ?? []).some((p) => p.count > 0) ? (
              <ProvinceBarChart data={reportData?.provinceDistribution ?? []} abbrMap={PROVINCE_ABBR} />
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#9ba3cc", fontSize: 13 }}>No data for {quarter} {year}</p>
              </div>
            )}
          </div>
        </div>

        {/* Special Campaign + Training Modules */}
        {specialCampaign && (
          <div className="report-card" style={{
            background: "#131626", borderRadius: 16, padding: "20px 24px", marginBottom: 16,
            border: "1px solid rgba(255,140,66,0.25)",
            display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24,
          }}>
            <div>
              <p style={{ color: "#ff8c42", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                {specialCampaign.tag.replace(/_/g, " ")} CORE FOCUS
              </p>
              <p style={{ color: "#e8eaff", fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{specialCampaign.studentCount.toLocaleString()}</p>
              <p style={{ color: "#9ba3cc", fontSize: 12 }}>Participants</p>
              <div style={{ marginTop: 16 }}>
                <GenderBar label="Female" count={genderBreakdown.female} total={totalGendered} color="#f472b6" />
                <GenderBar label="Male" count={genderBreakdown.male} total={totalGendered} color="#5b6cff" />
              </div>
            </div>
            <div>
              <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Project Training Modules <span style={{ color: "#22d3a0" }}>Active Streams</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(reportData?.trainingModules ?? []).slice(0, 8).map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "#5b6cff", fontWeight: 700, fontSize: 12, minWidth: 24 }}>{String(i + 1).padStart(2, "0")}.</span>
                    <p style={{ color: "#c8caf0", fontSize: 13, lineHeight: 1.4, margin: 0 }}>{m.title}</p>
                    {m.registrantCount > 0 && (
                      <span style={{ marginLeft: "auto", color: "#22d3a0", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {m.registrantCount} learners
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Training Modules (if no campaign) */}
        {!specialCampaign && (reportData?.trainingModules ?? []).length > 0 && (
          <div className="report-card" style={{
            background: "#131626", borderRadius: 16, padding: "20px 24px", marginBottom: 16,
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Training Modules</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
              {reportData!.trainingModules.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: "#5b6cff", fontWeight: 700, fontSize: 12, minWidth: 24 }}>{String(i + 1).padStart(2, "0")}.</span>
                  <p style={{ color: "#c8caf0", fontSize: 13, lineHeight: 1.4, margin: 0 }}>{m.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Row 2: Sector Pie + Category Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 16 }}>
          <div className="report-card" style={{ background: "#131626", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Beneficiary Sector</p>
            {sectorData.length > 0 ? (
              <SectorPieChart data={sectorData} />
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#9ba3cc", fontSize: 13 }}>No sector data yet</p>
              </div>
            )}
          </div>

          <div className="report-card" style={{ background: "#131626", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Key Category Performance</p>
            {categoryData.length > 0 ? (
              <CategoryBarChart data={categoryData} />
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#9ba3cc", fontSize: 13 }}>No category data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Gender Demographics */}
        <div className="report-card" style={{
          background: "#131626", borderRadius: 16, padding: "20px 24px", marginBottom: 16,
          border: "1px solid rgba(255,255,255,0.07)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24,
        }}>
          <div>
            <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Gender Demographics</p>
            <GenderBar label="Female" count={genderBreakdown.female} total={totalGendered} color="#f472b6" />
            <GenderBar label="Male" count={genderBreakdown.male} total={totalGendered} color="#5b6cff" />
            {genderBreakdown.prefer_not_to_say > 0 && (
              <GenderBar label="Prefer not to say" count={genderBreakdown.prefer_not_to_say} total={totalGendered} color="#9ba3cc" />
            )}
          </div>

          {/* Vulnerable Groups */}
          {vulnerableTotal > 0 && (
            <div>
              <p style={{ color: "#9ba3cc", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Identified Vulnerable Groups <span style={{ color: "#ff8c42" }}>({vulnerableTotal} Participants)</span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                {Object.entries(reportData?.vulnerableGroups ?? {})
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#c8caf0", fontSize: 12 }}>{VULNERABLE_LABELS[k] ?? k}</span>
                      <span style={{ color: "#e8eaff", fontWeight: 700, fontSize: 12 }}>{(v as number).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Export Actions */}
        <div className="report-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={handlePrint}
            style={{
              padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: "#5b6cff", color: "#fff", border: "none", cursor: "pointer",
            }}
          >🖨 Export PDF</button>
          <button
            style={{
              padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: "rgba(255,255,255,0.07)", color: "#c8caf0",
              border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
            }}
          >📊 Export to Sheets</button>
          <button
            style={{
              padding: "10px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
              background: "rgba(255,255,255,0.07)", color: "#c8caf0",
              border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
            }}
          >🔗 Share Report</button>
        </div>
      </div>
    </>
  );
}
