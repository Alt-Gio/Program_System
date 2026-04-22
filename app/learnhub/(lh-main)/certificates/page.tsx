"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format } from "date-fns";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const CERT_TYPE_LABEL: Record<string, string> = {
  learning: "Learning Certificate",
  work_completion: "Work Completion",
};

const PROGRAM_COLORS: Record<string, string> = {
  SPARK: "#5b6cff",
  DWIA: "#22d3a0",
  "Project CLICK": "#ff8c42",
  Tech4ED: "#ff5f6d",
};

function CertCard({ cert, onClaim }: { cert: Record<string, unknown>; onClaim?: () => void }) {
  const color = PROGRAM_COLORS[cert.programType as string] ?? "#5b6cff";
  const isClaimed = cert.status === "claimed" || cert.status === "issued";

  const shareLinkedIn = () => {
    const url = `${window.location.origin}/learnhub/verify/${cert.verificationId}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url as string)}`, "_blank", "noopener");
  };

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "#131626", border: `1px solid ${color}30` }}>
      {/* Header gradient */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${color}18 0%, transparent 100%)`, borderBottom: `1px solid ${color}15` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" /><path d="M8 12l3 3 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>{cert.courseTitle as string}</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: color + "20", color }}>{cert.programType as string}</span>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between"><span style={{ color: "#5c6490" }}>Type</span><span style={{ color: "#e8eaff" }}>{CERT_TYPE_LABEL[cert.certType as string] ?? cert.certType as string}</span></div>
          <div className="flex justify-between"><span style={{ color: "#5c6490" }}>Issued by</span><span style={{ color: "#e8eaff" }}>{cert.issuedByName as string}</span></div>
          <div className="flex justify-between"><span style={{ color: "#5c6490" }}>Date</span><span style={{ color: "#e8eaff" }}>{format(cert.issuedAt as number, "MMM d, yyyy")}</span></div>
          <div className="flex justify-between"><span style={{ color: "#5c6490" }}>Status</span><span className="font-semibold" style={{ color: isClaimed ? "#22d3a0" : "#ff8c42" }}>{isClaimed ? "✓ Claimed" : "Pending Claim"}</span></div>
        </div>

        <div className="flex gap-2 mt-auto pt-2">
          {!isClaimed && onClaim && (
            <button onClick={onClaim} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={{ background: color, color: "#fff", fontFamily: "var(--font-sora)" }}>
              Claim Now
            </button>
          )}
          <a href={`/learnhub/verify/${cert.verificationId as string}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center rounded-xl py-2 text-sm font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "#9ba3cc", border: "1px solid rgba(255,255,255,0.08)" }}>
            Verify
          </a>
          {isClaimed && (
            <button onClick={shareLinkedIn} className="flex-1 rounded-xl py-2 text-sm font-semibold" style={{ background: "#0077b5", color: "#fff", fontFamily: "var(--font-sora)" }}>
              LinkedIn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const { userId, session } = useLearnhubSession();

  const certs = useQuery(api.learnhub_certificates.getCertsByEmail, session ? { email: session.email } : "skip");
  const claimFn = useMutation(api.learnhub_certificates.claimCertificate);

  const handleClaim = async (certId: string) => {
    if (!userId) return;
    await claimFn({ certId: certId as Parameters<typeof claimFn>[0]["certId"], studentId: userId as Parameters<typeof claimFn>[0]["studentId"] });
  };

  const hasCerts = certs && certs.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>My Certificates</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
            {certs === undefined ? "Loading…" : `${certs.length} certificate${certs.length !== 1 ? "s" : ""} earned`}
          </p>
        </div>
        {hasCerts && <div className="text-3xl">🎓</div>}
      </div>

      {certs === undefined && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: "#131626" }} />)}
        </div>
      )}

      {certs && certs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="text-5xl">🏅</span>
          <p className="text-lg font-semibold" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>No certificates yet</p>
          <p className="text-sm" style={{ color: "#9ba3cc" }}>Complete an ILCDB program to earn your first certificate.</p>
        </div>
      )}

      {hasCerts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(certs as unknown as Record<string, unknown>[]).map((cert) => (
            <CertCard
              key={cert._id as string}
              cert={cert}
              onClaim={cert.status !== "claimed" ? () => handleClaim(cert._id as string) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
