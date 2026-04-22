import { api } from "@/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { format } from "date-fns";
import type { Metadata } from "next";

interface Props { params: { certId: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Certificate Verification · ${params.certId}`,
    description: "Verify an ILCDB LearnHub certificate issued by DICT Region V",
  };
}

export default async function VerifyCertPage({ params }: Props) {
  let cert: Awaited<ReturnType<typeof fetchQuery<typeof api.learnhub_certificates.getCertByVerificationId>>> | null = null;

  try {
    cert = await fetchQuery(api.learnhub_certificates.getCertByVerificationId, {
      verificationId: params.certId,
    });
  } catch {
    // Convex not configured or cert not found
  }

  const isValid = cert !== null && cert.status !== "pending";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#0d0f1a" }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 20%, rgba(34,211,160,0.08) 0%, transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md">
        {/* DICT / ILCDB branding */}
        <div className="text-center mb-8">
          <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}>DICT Region V</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}>ILCDB LearnHub</p>
          <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>Certificate Verification</p>
        </div>

        {/* Status card */}
        <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#131626", border: isValid ? "1px solid rgba(34,211,160,0.3)" : "1px solid rgba(255,95,109,0.3)" }}>
          {/* Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: isValid ? "rgba(34,211,160,0.1)" : "rgba(255,95,109,0.1)" }}>
              {isValid ? (
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#22d3a0" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="#22d3a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#ff5f6d" strokeWidth="2" /><line x1="15" y1="9" x2="9" y2="15" stroke="#ff5f6d" strokeWidth="2" strokeLinecap="round" /><line x1="9" y1="9" x2="15" y2="15" stroke="#ff5f6d" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: isValid ? "#22d3a0" : "#ff5f6d", fontFamily: "var(--font-sora)" }}>
                {isValid ? "Certificate Verified" : cert === null ? "Certificate Not Found" : "Unverified"}
              </p>
              <p className="text-sm" style={{ color: "#9ba3cc" }}>
                {isValid ? "This certificate is authentic." : "No matching record found for this ID."}
              </p>
            </div>
          </div>

          {/* Certificate details */}
          {cert && (
            <>
              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="flex flex-col gap-3">
                <DetailRow label="Certificate" value={cert.courseTitle} />
                <DetailRow label="Program" value={cert.programType} />
                <DetailRow label="Recipient" value={cert.studentEmail} />
                <DetailRow label="Issued By" value={cert.issuedByName} />
                <DetailRow label="Date Issued" value={format(cert.issuedAt, "MMMM d, yyyy")} />
                <DetailRow label="Status" value={cert.status.charAt(0).toUpperCase() + cert.status.slice(1)} highlight={isValid} />
                <DetailRow label="Verification ID" value={cert.verificationId} mono />
              </div>

              {cert.pdfUrl && (
                <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold transition-all" style={{ background: "#5b6cff", color: "#fff", fontFamily: "var(--font-sora)" }}>
                  Download Certificate PDF
                </a>
              )}
            </>
          )}

          {!cert && (
            <div className="rounded-xl px-4 py-3 text-sm text-center" style={{ background: "rgba(255,95,109,0.06)", color: "#9ba3cc" }}>
              If you believe this is an error, contact <span style={{ color: "#5b6cff" }}>ilcdb@dictregion5.gov.ph</span>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#5c6490" }}>
          Verification ID: <span className="font-mono">{params.certId}</span>
        </p>
        <p className="text-center text-xs mt-1" style={{ color: "#5c6490" }}>
          DICT Region V · ILCDB LearnHub · dictregion5.gov.ph
        </p>
      </div>
    </main>
  );
}

function DetailRow({ label, value, mono = false, highlight = false }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm shrink-0" style={{ color: "#5c6490" }}>{label}</span>
      <span className={`text-sm text-right ${mono ? "font-mono" : "font-medium"}`} style={{ color: highlight ? "#22d3a0" : "#e8eaff" }}>{value}</span>
    </div>
  );
}
