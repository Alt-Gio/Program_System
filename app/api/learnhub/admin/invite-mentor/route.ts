export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const TUNNEL_DOMAIN = process.env.LEARNHUB_TUNNEL_DOMAIN ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function getGmailClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.LEARNHUB_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.LEARNHUB_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    clientOptions: {
      subject: process.env.LEARNHUB_IMPERSONATE_EMAIL,
    },
  });
  return google.gmail({ version: "v1", auth });
}

function buildInviteEmail({
  invitedName,
  invitedEmail,
  dictDesignation,
  programs,
  token,
  personalMessage,
}: {
  invitedName: string;
  invitedEmail: string;
  dictDesignation: string;
  programs: string[];
  token: string;
  personalMessage?: string;
}) {
  const inviteUrl = `${TUNNEL_DOMAIN}/learnhub/login/mentor/invite?token=${token}`;
  const programList = programs.map((p) => `<li>${p}</li>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', sans-serif; background: #0d1025; color: #c8caf0; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 40px auto; background: #131626; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
  .header { background: linear-gradient(135deg, #5b6cff 0%, #22d3a0 100%); padding: 32px 28px; text-align: center; }
  .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 800; }
  .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 13px; }
  .body { padding: 28px; }
  .btn { display: inline-block; background: #5b6cff; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 20px 0; }
  .detail { background: rgba(255,255,255,0.04); border-radius: 10px; padding: 14px 18px; margin: 16px 0; }
  .detail ul { margin: 8px 0 0; padding-left: 18px; }
  .detail li { margin-bottom: 4px; color: #a0acff; font-size: 13px; }
  .footer { text-align: center; padding: 20px 28px; color: #9ba3cc; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
  a { color: #7c8bff; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🎓 ILCDB LearnHub</h1>
    <p>DICT Region V · Bicol Region</p>
  </div>
  <div class="body">
    <p>Hi <strong>${invitedName}</strong>,</p>
    <p>You have been invited to join <strong>ILCDB LearnHub</strong> as a Mentor by the DICT Region V team.</p>
    <div class="detail">
      <p style="margin:0;font-weight:700;color:#e8eaff">Your profile has been pre-configured with:</p>
      <ul>
        <li>Role: <strong style="color:#e8eaff">${dictDesignation}</strong></li>
        <li>Programs: <strong style="color:#e8eaff">${programs.join(", ") || "To be assigned"}</strong></li>
        <li>Region: <strong style="color:#e8eaff">DICT Region V</strong></li>
      </ul>
    </div>
    ${personalMessage ? `<p style="font-style:italic;color:#c8caf0">"${personalMessage}"</p>` : ""}
    <p>Click the button below to connect your Google account and activate your Mentor profile:</p>
    <div style="text-align:center">
      <a href="${inviteUrl}" class="btn">Accept Invitation →</a>
    </div>
    <p style="font-size:12px;color:#9ba3cc">Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
    <p style="font-size:12px;color:#9ba3cc;margin-top:20px">⚠️ This invite expires in <strong>7 days</strong>. If you did not expect this invitation, you may safely ignore this email.</p>
  </div>
  <div class="footer">
    ILCDB LearnHub · DICT Region V · Bicol Region<br>
    <a href="${TUNNEL_DOMAIN}/learnhub">learnhub.dictregion5.gov.ph</a>
  </div>
</div>
</body></html>`;

  const subject = `You're invited to ILCDB LearnHub as a Mentor`;
  const raw = [
    `To: ${invitedName} <${invitedEmail}>`,
    `From: ILCDB LearnHub <${process.env.LEARNHUB_IMPERSONATE_EMAIL ?? "no-reply@dictregion5.gov.ph"}>`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  return Buffer.from(raw).toString("base64url");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, invitedName, invitedEmail, dictDesignation, programs, personalMessage } = body;

    if (!token || !invitedEmail || !invitedName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const gmail = await getGmailClient();
    const raw = buildInviteEmail({ invitedName, invitedEmail, dictDesignation, programs: programs ?? [], token, personalMessage });

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({ ok: true, message: `Invite sent to ${invitedEmail}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[invite-mentor]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
