export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// POST /api/learnhub/forms-webhook
// Called by a Google Apps Script onFormSubmit trigger (or manual webhook push).
// Expected body from the Apps Script:
//   { secret, email, name, courseTitle, programType, certType, mentorEmail }
//
// Install the Apps Script in the Google Form that ILCDB uses to track completions.
// Set the webhook URL to: https://[your-domain]/api/learnhub/forms-webhook

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface WebhookBody {
  secret: string;
  email: string;
  name: string;
  courseTitle: string;
  programType: string;
  certType?: "learning" | "work_completion";
  mentorEmail?: string;
  autoIssueCert?: boolean;
}

export async function POST(request: NextRequest) {
  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.secret !== process.env.LH_FORMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, name, courseTitle, programType, certType = "learning", mentorEmail, autoIssueCert = true } = body;

  if (!email || !name || !courseTitle || !programType) {
    return NextResponse.json({ error: "Missing required fields: email, name, courseTitle, programType" }, { status: 400 });
  }

  // Resolve mentor user (must exist in Convex)
  let issuedBy: string | null = null;
  let issuedByName = "DICT Region V – LearnHub";

  if (mentorEmail) {
    try {
      const mentor = await convex.query(api.learnhub_users.getUserByEmail, { email: mentorEmail });
      if (mentor) {
        issuedBy = mentor._id;
        issuedByName = mentor.name;
      }
    } catch {
      // non-critical — will use default issuer
    }
  }

  // If no mentor found, try finding any mentor user to act as issuer (fallback)
  if (!issuedBy) {
    try {
      const users = await convex.query(api.learnhub_users.listUsers, {});
      const mentor = users.find((u) => u.role === "mentor");
      if (mentor) { issuedBy = mentor._id; issuedByName = mentor.name; }
    } catch {
      return NextResponse.json({ error: "No mentor account found to issue certificate" }, { status: 503 });
    }
  }

  if (!issuedBy) {
    return NextResponse.json({ error: "Cannot resolve issuer — create a mentor account first" }, { status: 503 });
  }

  try {
    const certId = await convex.mutation(api.learnhub_certificates.issueCertificate, {
      studentEmail: email,
      courseTitle,
      programType,
      issuedBy: issuedBy as Parameters<typeof api.learnhub_certificates.issueCertificate>[1]["issuedBy"],
      issuedByName,
      certType,
    });

    const cert = await convex.query(api.learnhub_certificates.getCertById, {
      certId: certId as Parameters<typeof api.learnhub_certificates.getCertById>[1]["certId"],
    });

    // Trigger certificate pipeline if auto-issue enabled and API keys are configured
    if (autoIssueCert && process.env.LEARNHUB_SLIDES_CERT_TEMPLATE_ID) {
      const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      fetch(`${baseUrl}/api/learnhub/certificates/issue-by-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-learnhub-secret": process.env.LH_FORMS_WEBHOOK_SECRET!,
        },
        body: JSON.stringify({ certId, studentName: name, studentEmail: email }),
      }).catch((e) => console.warn("[LearnHub] Auto-issue cert pipeline error:", e));
    }

    // Notify the student if they have a LearnHub account
    try {
      const student = await convex.query(api.learnhub_users.getUserByEmail, { email });
      if (student) {
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        fetch(`${baseUrl}/api/learnhub/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-learnhub-secret": process.env.LH_FORMS_WEBHOOK_SECRET!,
          },
          body: JSON.stringify({
            userId: student._id,
            event: "certificate_issued",
            title: "🎓 Certificate Issued!",
            body: `Your ${courseTitle} certificate is ready. Click to view.`,
            targetRoute: `/learnhub/certificates`,
          }),
        }).catch(() => {});
      }
    } catch {
      // non-critical
    }

    return NextResponse.json({
      ok: true,
      certId,
      verificationId: cert?.verificationId,
      message: `Certificate issued for ${email}`,
    });
  } catch (err) {
    console.error("[LearnHub] Forms webhook error:", err);
    return NextResponse.json({ error: "Failed to issue certificate" }, { status: 500 });
  }
}

// GET — health check / test endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    description: "ILCDB LearnHub Forms Webhook",
    requiredFields: ["secret", "email", "name", "courseTitle", "programType"],
    optionalFields: ["certType", "mentorEmail", "autoIssueCert"],
  });
}
