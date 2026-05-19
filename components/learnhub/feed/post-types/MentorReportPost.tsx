"use client";

interface MentorReportMetadata {
  kind?: string;
  reportId?: string;
  quarter?: string;
  year?: number;
  totalTrainings?: number;
  totalBeneficiaries?: number;
  provinceCoverage?: number;
  modalityBreakdown?: { online?: number; faceToFace?: number; hybrid?: number };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex-1 rounded-lg px-3 py-2.5 text-center"
      style={{ background: "rgba(13,15,26,0.5)", border: "1px solid rgba(91,108,255,0.18)" }}
    >
      <div className="text-lg font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#9ba3cc" }}>
        {label}
      </div>
    </div>
  );
}

export function MentorReportPost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as MentorReportMetadata;
  const mod = m.modalityBreakdown ?? {};
  const totalMod = (mod.online ?? 0) + (mod.faceToFace ?? 0) + (mod.hybrid ?? 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.06) 100%)",
        border: "1px solid rgba(99,102,241,0.3)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ borderBottom: "1px solid rgba(99,102,241,0.15)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">📊</span>
          <span
            className="text-xs font-semibold tracking-wide uppercase truncate"
            style={{ color: "#a5b4fc", fontFamily: "var(--font-sora)" }}
          >
            Quarterly Report
          </span>
        </div>
        <span
          className="text-[11px] font-semibold tabular-nums shrink-0"
          style={{ color: "#a5b4fc" }}
        >
          {m.quarter ?? "—"} {m.year ?? ""}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex gap-2">
          <Stat label="Trainings" value={m.totalTrainings ?? 0} />
          <Stat label="Beneficiaries" value={m.totalBeneficiaries ?? 0} />
          <Stat label="Province coverage" value={`${m.provinceCoverage ?? 0}%`} />
        </div>

        {totalMod > 0 && (
          <div
            className="rounded-lg px-3 py-2.5 text-xs"
            style={{ background: "rgba(13,15,26,0.4)", border: "1px solid rgba(99,102,241,0.12)" }}
          >
            <div className="uppercase tracking-wider text-[10px] mb-1" style={{ color: "#9ba3cc" }}>
              Modality
            </div>
            <div className="flex items-center gap-3" style={{ color: "#e8eaff" }}>
              <span>🌐 {mod.online ?? 0} online</span>
              <span>🤝 {mod.faceToFace ?? 0} on-site</span>
              <span>🔀 {mod.hybrid ?? 0} hybrid</span>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <a
            href="/learnhub/mentor/report"
            className="text-xs font-semibold"
            style={{ color: "#7c8bff" }}
          >
            View full report →
          </a>
        </div>
      </div>
    </div>
  );
}
