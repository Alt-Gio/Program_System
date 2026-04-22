import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { verifySession, SESSION_COOKIE } from "@/lib/learnhub/auth";

// POST /api/learnhub/certificates/issue
// Mentor-only: Copies the Slides template → exports as PDF → uploads to Drive → records in Convex.

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function getServiceAuth() {
  const key = process.env.LEARNHUB_SERVICE_ACCOUNT_KEY!;
  const email = process.env.LEARNHUB_SERVICE_ACCOUNT_EMAIL!;
  const impersonate = process.env.LEARNHUB_IMPERSONATE_EMAIL;
  const credentials = typeof key === "string" ? JSON.parse(key) : key;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    clientOptions: impersonate ? { subject: impersonate } : undefined,
  });
  return auth;
}

interface IssueBody {
  studentEmail: string;
  studentName: string;
  courseTitle: string;
  programType: string;
  certType: "learning" | "work_completion";
  sendEmail?: boolean;
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = await verifySession(sessionToken);
  if (!session || session.role !== "mentor") {
    return NextResponse.json({ error: "Mentor access required" }, { status: 403 });
  }

  const body: IssueBody = await request.json();
  const { studentEmail, studentName, courseTitle, programType, certType, sendEmail = true } = body;
  if (!studentEmail || !studentName || !courseTitle || !programType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const templateId = process.env.LEARNHUB_SLIDES_CERT_TEMPLATE_ID;
  const folderId = process.env.LEARNHUB_DRIVE_CERT_FOLDER_ID;
  if (!templateId || !folderId) {
    return NextResponse.json({ error: "Certificate template not configured" }, { status: 503 });
  }

  try {
    const auth = getServiceAuth();
    const drive = google.drive({ version: "v3", auth });
    const slides = google.slides({ version: "v1", auth });

    // 1. Issue Convex record first — get verificationId
    const certId = await convex.mutation(api.learnhub_certificates.issueCertificate, {
      studentEmail,
      courseTitle,
      programType,
      issuedBy: session.sub as Parameters<typeof api.learnhub_certificates.issueCertificate>[1]["issuedBy"],
      issuedByName: session.name,
      certType,
    });

    const certRecord = await convex.query(api.learnhub_certificates.getCertById, {
      certId: certId as Parameters<typeof api.learnhub_certificates.getCertById>[1]["certId"],
    });
    const verificationId = certRecord?.verificationId ?? `LH-${new Date().getFullYear()}-${programType}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const issueDate = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

    // 2. Copy the Slides template
    const copyRes = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `Certificate — ${studentName} — ${courseTitle}`,
        parents: [folderId],
      },
    });
    const copiedId = copyRes.data.id!;

    // 3. Replace text placeholders in the copy
    const REPLACEMENTS: Record<string, string> = {
      "{{STUDENT_NAME}}": studentName,
      "{{COURSE_TITLE}}": courseTitle,
      "{{PROGRAM_TYPE}}": programType,
      "{{ISSUE_DATE}}": issueDate,
      "{{ISSUED_BY}}": session.name,
      "{{VERIFICATION_ID}}": verificationId,
      "{{VERIFY_URL}}": `${process.env.NEXTAUTH_URL ?? "https://learnhub.dictregion5.gov.ph"}/learnhub/verify/${verificationId}`,
    };

    await slides.presentations.batchUpdate({
      presentationId: copiedId,
      requestBody: {
        requests: Object.entries(REPLACEMENTS).map(([from, to]) => ({
          replaceAllText: {
            containsText: { text: from, matchCase: true },
            replaceText: to,
          },
        })),
      },
    });

    // 4. Export as PDF
    const pdfRes = await drive.files.export(
      { fileId: copiedId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );

    // 5. Upload PDF as a new file
    const { Readable } = await import("stream");
    const pdfStream = Readable.from(Buffer.from(pdfRes.data as ArrayBuffer));
    const pdfUpload = await drive.files.create({
      requestBody: {
        name: `${studentName} — ${courseTitle} Certificate.pdf`,
        mimeType: "application/pdf",
        parents: [folderId],
      },
      media: { mimeType: "application/pdf", body: pdfStream },
      fields: "id, webViewLink",
    });
    const pdfFileId = pdfUpload.data.id!;
    const pdfUrl = pdfUpload.data.webViewLink!;

    // 6. Make PDF publicly readable
    await drive.permissions.create({
      fileId: pdfFileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // 7. Delete the intermediate Slides copy
    await drive.files.delete({ fileId: copiedId }).catch(() => {});

    // 8. Update Convex record with Drive file info
    await convex.mutation(api.learnhub_certificates.updateCertDriveFile, {
      certId: certId as Parameters<typeof api.learnhub_certificates.updateCertDriveFile>[0]["certId"],
      driveFileId: pdfFileId,
      pdfUrl,
    });

    // 9. Send email (optional)
    if (sendEmail) {
      try {
        const gmail = google.gmail({ version: "v1", auth });
        const verifyUrl = `${process.env.NEXTAUTH_URL ?? "https://learnhub.dictregion5.gov.ph"}/learnhub/verify/${verificationId}`;
        const emailBody = [
          `To: ${studentEmail}`,
          `Subject: Your ${programType} Certificate is Ready — ILCDB LearnHub`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          "",
          `<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">`,
          `<div style="background:#5b6cff;padding:24px;border-radius:12px 12px 0 0">`,
          `  <h1 style="color:#fff;margin:0;font-size:20px">🎓 Congratulations, ${studentName}!</h1>`,
          `</div>`,
          `<div style="background:#f7f8ff;padding:24px;border-radius:0 0 12px 12px">`,
          `  <p>Your <strong>${courseTitle}</strong> certificate has been issued by <strong>${session.name}</strong> through ILCDB LearnHub (DICT Region V).</p>`,
          `  <p><a href="${pdfUrl}" style="background:#5b6cff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Download Certificate PDF</a></p>`,
          `  <p style="font-size:13px;color:#666">Verification ID: <code>${verificationId}</code></p>`,
          `  <p style="font-size:13px;color:#666">Verify at: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
          `  <hr style="border:1px solid #eee;margin:16px 0"/>`,
          `  <p style="font-size:12px;color:#999">DICT Region V · ILCDB LearnHub · dictregion5.gov.ph</p>`,
          `</div></body></html>`,
        ].join("\n");
        const encoded = Buffer.from(emailBody).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
      } catch (mailErr) {
        console.warn("[LearnHub] Certificate email failed (non-critical):", mailErr);
      }
    }

    return NextResponse.json({ ok: true, certId, verificationId, pdfUrl });
  } catch (err) {
    console.error("[LearnHub] Certificate issue error:", err);
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 });
  }
}
