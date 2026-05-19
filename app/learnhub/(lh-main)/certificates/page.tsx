"use client";

/**
 * /learnhub/certificates — learner-facing wall of earned certificates.
 *
 * Reads `getCertsByEmail` keyed off the signed-in session email. Now
 * surfaces the Gmail-ingested attachment image when present
 * (`imageStorageId` + `sourceEmail`) so learners see the actual cert PNG
 * the trusted sender mailed them — not just metadata.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Mail, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

const CERT_TYPE_LABEL: Record<string, string> = {
  learning: "Learning Certificate",
  work_completion: "Work Completion",
  event_participation: "Event Participation",
};

const PROGRAM_COLORS: Record<string, string> = {
  SPARK: "#5b6cff",
  DWIA: "#22d3a0",
  "Project CLICK": "#ff8c42",
  Tech4ED: "#ff5f6d",
  "Auto-Ingested": "#fbbf24",
};

type CertDoc = {
  _id: Id<"learnhub_certificates">;
  courseTitle: string;
  programType: string;
  certType: string;
  status: string;
  issuedAt: number;
  issuedByName: string;
  verificationId: string;
  imageStorageId?: Id<"_storage">;
  originalAttachmentName?: string;
  sourceEmail?: {
    messageId: string;
    senderEmail: string;
    subject: string;
    receivedAt: number;
  };
};

function CertAttachment({ storageId, alt, onOpen }: { storageId: Id<"_storage">; alt: string; onOpen: () => void }) {
  // Storage URL fetched via the dedicated cert-ingest helper. Keeps the
  // certificate page from needing the Convex storage URL on the auth
  // session (the helper just returns a signed URL).
  const url = useQuery(api.learnhub_cert_ingest.getStorageUrl, { storageId });
  if (url === undefined) {
    return (
      <div style={{ height: 160, borderRadius: 10, background: "#0d0f1a", animation: "pulse 1.4s infinite" }} />
    );
  }
  if (!url) {
    return (
      <div style={{
        height: 120, borderRadius: 10, background: "#0d0f1a",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#5c6490", fontSize: 12,
      }}>Attachment unavailable</div>
    );
  }
  return (
    <button onClick={onOpen} style={{
      width: "100%", padding: 0, border: 0, cursor: "pointer",
      borderRadius: 10, overflow: "hidden", background: "#0d0f1a",
    }} title="Open full size">
      <img src={url} alt={alt} style={{
        width: "100%", maxHeight: 220, objectFit: "cover", display: "block",
      }} />
    </button>
  );
}

function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(3,4,10,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 200,
    }}>
      <button onClick={onClose} aria-label="Close" style={{
        position: "absolute", top: 14, right: 14,
        width: 36, height: 36, borderRadius: 999, border: 0,
        background: "rgba(255,255,255,0.08)", color: "white",
        cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}><X size={18} /></button>
      <img onClick={(e) => e.stopPropagation()} src={url} alt={name} style={{
        maxWidth: "min(90vw, 1400px)", maxHeight: "85vh",
        borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
      }} />
    </div>
  );
}

function CertCard({ cert, onClaim, onOpenAttachment }: {
  cert: CertDoc;
  onClaim?: () => void;
  onOpenAttachment: (storageId: Id<"_storage">, name: string) => void;
}) {
  const color = PROGRAM_COLORS[cert.programType] ?? "#5b6cff";
  const isClaimed = cert.status === "claimed" || cert.status === "issued";

  const shareLinkedIn = () => {
    const url = `${window.location.origin}/learnhub/verify/${cert.verificationId}`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener",
    );
  };

  return (
    <div style={{
      background: "#131626", border: `1px solid ${color}30`,
      borderRadius: 18, overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
        background: `linear-gradient(135deg, ${color}18 0%, transparent 100%)`,
        borderBottom: `1px solid ${color}15`,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: color + "20", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
            <path d="M8 12l3 3 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#e8eaff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cert.courseTitle}
          </p>
          <span style={{
            display: "inline-block", marginTop: 3,
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, padding: "1px 7px",
            borderRadius: 999, background: color + "20", color,
          }}>{cert.programType}</span>
        </div>
      </div>

      {cert.imageStorageId && (
        <div style={{ padding: "10px 12px 0" }}>
          <CertAttachment
            storageId={cert.imageStorageId}
            alt={cert.courseTitle}
            onOpen={() => onOpenAttachment(cert.imageStorageId!, cert.originalAttachmentName ?? cert.courseTitle)}
          />
        </div>
      )}

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <Row label="Type" value={CERT_TYPE_LABEL[cert.certType] ?? cert.certType} />
          <Row label="Issued by" value={cert.issuedByName} />
          <Row label="Date" value={format(cert.issuedAt, "MMM d, yyyy")} />
          {cert.sourceEmail && (
            <Row label="From email" value={cert.sourceEmail.senderEmail} icon={<Mail size={11} />} />
          )}
          <Row label="Status" value={isClaimed ? "✓ Claimed" : "Pending Claim"} valueColor={isClaimed ? "#22d3a0" : "#ff8c42"} bold />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {!isClaimed && onClaim && (
            <button onClick={onClaim} style={{
              flex: 1, padding: "9px 14px", borderRadius: 999,
              border: 0, cursor: "pointer",
              background: color, color: "white", fontWeight: 700, fontSize: 13,
            }}>Claim Now</button>
          )}
          <a href={`/learnhub/verify/${cert.verificationId}`} target="_blank" rel="noopener noreferrer" style={{
            flex: 1, textAlign: "center", padding: "9px 14px", borderRadius: 999,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#9ba3cc", fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>Verify</a>
          {isClaimed && (
            <button onClick={shareLinkedIn} style={{
              flex: 1, padding: "9px 14px", borderRadius: 999,
              border: 0, cursor: "pointer",
              background: "#0077b5", color: "white", fontWeight: 700, fontSize: 13,
            }}>LinkedIn</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, bold, icon }: { label: string; value: string; valueColor?: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "#5c6490" }}>{label}</span>
      <span style={{ color: valueColor ?? "#e8eaff", fontWeight: bold ? 700 : 400, display: "inline-flex", alignItems: "center", gap: 4 }}>
        {icon}{value}
      </span>
    </div>
  );
}

export default function CertificatesPage() {
  const { userId, session } = useLearnhubSession();
  const certs = useQuery(
    api.learnhub_certificates.getCertsByEmail,
    session ? { email: session.email } : "skip",
  );
  const claimFn = useMutation(api.learnhub_certificates.claimCertificate);

  const [lightbox, setLightbox] = useState<{ storageId: Id<"_storage">; name: string } | null>(null);
  const lightboxUrl = useQuery(
    api.learnhub_cert_ingest.getStorageUrl,
    lightbox ? { storageId: lightbox.storageId } : "skip",
  );

  const handleClaim = async (certId: Id<"learnhub_certificates">) => {
    if (!userId) return;
    await claimFn({ certId, studentId: userId as Id<"learnhub_users"> });
  };

  const hasCerts = certs && certs.length > 0;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e8eaff", fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)" }}>
            My Certificates
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ba3cc" }}>
            {certs === undefined
              ? "Loading…"
              : `${certs.length} certificate${certs.length === 1 ? "" : "s"} earned`}
            {hasCerts ? " · click the image to view full size" : ""}
          </p>
        </div>
        {hasCerts && <div style={{ fontSize: 28 }}>🎓</div>}
      </div>

      {certs === undefined && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 240, borderRadius: 18, background: "#131626", opacity: 0.6 }} />
          ))}
        </div>
      )}

      {certs && certs.length === 0 && (
        <div style={{ padding: 60, textAlign: "center", color: "#9ba3cc" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🏅</div>
          <p style={{ margin: 0, fontWeight: 700, color: "#e8eaff", fontFamily: "var(--font-sora, 'Plus Jakarta Sans', sans-serif)" }}>No certificates yet</p>
          <p style={{ margin: "6px 0 0", fontSize: 13 }}>
            Complete an ILCDB program to earn your first one — or, if your program issues certs by email,
            ask your coordinator to enable the Gmail auto-ingest on this deployment.
          </p>
        </div>
      )}

      {hasCerts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {(certs as unknown as CertDoc[]).map((c) => (
            <CertCard
              key={c._id as unknown as string}
              cert={c}
              onClaim={c.status !== "claimed" ? () => handleClaim(c._id) : undefined}
              onOpenAttachment={(storageId, name) => setLightbox({ storageId, name })}
            />
          ))}
        </div>
      )}

      {lightbox && lightboxUrl && (
        <Lightbox url={lightboxUrl} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
