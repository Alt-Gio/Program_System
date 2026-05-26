// NOTE: intentionally NOT marked `"use node"`. Resend only needs `fetch`,
// which Convex's default V8 action runtime supports natively. Running on V8
// also avoids a Windows-specific Node ESM bundler error on `npx convex dev`
// ("Received protocol 'c:'"), which happened here when this file was bundled
// for the Node runtime.

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api } from "./_generated/api";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "DICT <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[emails] RESEND_API_KEY not set — dropping email", opts.to);
    return { ok: false, error: "RESEND_API_KEY is not configured on the Convex deployment. Run: npx convex env set RESEND_API_KEY re_xxx" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[emails] Resend error", res.status, text);
      // Surface the Resend error body directly — it usually explains the issue
      // (e.g. "You can only send testing emails to your own email address").
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = (await res.json()) as { id?: string };
    console.log("[emails] sent to", opts.to, "id=", data.id);
    return { ok: true, id: data.id };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    console.error("[emails] fetch failed:", msg);
    return { ok: false, error: `Network error calling Resend: ${msg}` };
  }
}

/** Issue an OTP for a purpose, then email it via Resend. */
export const sendOtp = action({
  args: {
    email: v.string(),
    purpose: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const { code }: { code: string } = await ctx.runMutation(api.otp.issue, {
      contact: args.email,
      purpose: args.purpose,
    });

    const subject =
      args.purpose === "invite_accept"
        ? "Your DICT account verification code"
        : "Your DICT verification code";

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;color:#0a2540;">DICT Region V</h2>
        <p style="font-size:14px;color:#333;">Use this code to continue:</p>
        <div style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f4f6fb;padding:16px 24px;border-radius:8px;display:inline-block;margin:12px 0;">${code}</div>
        <p style="font-size:13px;color:#555;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `;

    const result = await sendMail({ to: args.email, subject, html });
    return { ok: result.ok, error: result.error };
  },
});

/** Send an invite email with the accept-invite link. */
export const sendInvite = action({
  args: {
    email: v.string(),
    role: v.string(),
    token: v.string(),
    appUrl: v.string(),
    inviterName: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const link = `${args.appUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(args.token)}`;
    const inviter = args.inviterName || "a DICT admin";
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 16px;color:#0a2540;">You're invited to DICT Region V</h2>
        <p style="font-size:14px;color:#333;">${inviter} has invited you to join as <b>${args.role}</b>.</p>
        <p style="margin:20px 0;">
          <a href="${link}" style="background:#0a4bd4;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Accept invite</a>
        </p>
        <p style="font-size:12px;color:#666;">Or paste this link into your browser:<br/>${link}</p>
        <p style="font-size:12px;color:#999;margin-top:24px;">This invite expires in 7 days.</p>
      </div>
    `;

    return await sendMail({
      to: args.email,
      subject: "Your DICT invitation",
      html,
    });
  },
});

// Rec #8 — LearnHub digest email.
//
// Shared sender for both the daily and weekly digest cron handlers in
// learnhub_notifications.ts. Caller decides the cadence label, the headline
// counters, and the deep-link path; this action only handles formatting +
// delivery. Stays a no-op (returns ok:false) when RESEND_API_KEY isn't set
// so dev environments don't fail noisily.
export const sendLearnHubDigest = internalAction({
  args: {
    to: v.string(),
    learnerName: v.string(),
    cadence: v.union(v.literal("daily"), v.literal("weekly")),
    headline: v.string(),
    summary: v.string(),
    streakLine: v.string(),
    targetUrl: v.string(),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ ok: boolean; error?: string }> => {
    const cadenceLabel = args.cadence === "daily" ? "Today on LearnHub" : "Your week on LearnHub";
    const subject =
      args.cadence === "daily"
        ? `Today on LearnHub — ${args.headline}`
        : `Your LearnHub week — ${args.headline}`;
    const firstName = args.learnerName.split(" ")[0] || args.learnerName || "there";

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0d1a;color:#e8eaf4;">
        <div style="background:linear-gradient(135deg,#5b6cff,#7c5cff);padding:18px 22px;border-radius:14px;margin-bottom:18px;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.78);">${cadenceLabel}</p>
          <h2 style="margin:6px 0 0;font-size:22px;color:#fff;">${args.headline}</h2>
        </div>
        <p style="font-size:15px;margin:0 0 12px;">Hi ${firstName},</p>
        <p style="font-size:14px;line-height:1.55;margin:0 0 14px;color:#cfd3eb;">${args.summary}</p>
        <p style="font-size:13px;line-height:1.5;margin:0 0 22px;color:#9ba3cc;">${args.streakLine}</p>
        <p style="margin:0 0 28px;">
          <a href="${args.targetUrl}" style="background:#5b6cff;color:#fff;padding:11px 20px;border-radius:99px;text-decoration:none;font-weight:600;font-size:13px;">Open LearnHub →</a>
        </p>
        <p style="font-size:11px;color:#6f76a0;margin:0;">
          You're receiving this because your LearnHub email digest is set to <b>${args.cadence}</b>.
          Switch cadence or turn it off in <a href="${args.targetUrl.replace(/\/learnhub\/.*$/, "/learnhub/settings")}" style="color:#9ba9ff;">Settings → Email Digest</a>.
        </p>
      </div>
    `;

    return await sendMail({ to: args.to, subject, html });
  },
});
