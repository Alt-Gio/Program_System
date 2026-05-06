"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Mail, ShieldCheck, ArrowRight } from "lucide-react";

type Step = "verify" | "otp" | "password" | "done";

function landingForRole(role: string): string {
  if (role === "intern" || role === "supervisor") return "/intern-portal";
  if (role === "manager" || role === "admin") return "/dashboard";
  return "/";
}

function AcceptInvitePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const invite = useQuery(api.invites.getByToken, token ? { token } : "skip");

  const [step, setStep] = useState<Step>("verify");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const inviteState = useMemo(() => {
    if (invite === undefined) return "loading" as const;
    if (invite === null) return "invalid" as const;
    if (invite.used) return "used" as const;
    if (invite.expired) return "expired" as const;
    return "ok" as const;
  }, [invite]);

  useEffect(() => {
    if (inviteState === "ok" && step === "verify") setStep("otp");
  }, [inviteState, step]);

  async function sendOtp() {
    if (!invite || inviteState !== "ok") return;
    if (resendCooldown > 0) return;
    setLoading(true);
    setErrorDetail(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          purpose: "invite_accept",
          inviteToken: token,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const msg = data.error || `Failed to send code (HTTP ${res.status})`;
        setErrorDetail(msg);
        throw new Error(msg);
      }
      setOtpSent(true);
      setResendCooldown(30);
      toast.success(`Code sent to ${invite.email}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    setErrorDetail(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          purpose: "invite_accept",
          code: otp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        const msg = data.error || "Invalid code";
        setErrorDetail(msg);
        throw new Error(msg);
      }
      setStep("password");
    } catch (e: any) {
      toast.error(e.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Enter your full name");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");

    setLoading(true);
    setErrorDetail(null);
    try {
      const res = await fetch("/api/auth/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken: token,
          fullName: fullName.trim(),
          password,
          otpCode: otp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || `Signup failed (HTTP ${res.status})`;
        setErrorDetail(msg);
        // If the OTP window lapsed, send the user back to the OTP step
        if (/otp|code|verify/i.test(msg)) {
          setStep("otp");
          setOtp("");
        }
        throw new Error(msg);
      }
      toast.success("Account created — welcome!");
      setStep("done");
      setTimeout(() => {
        router.push(landingForRole(data.user.role));
        router.refresh();
      }, 800);
    } catch (e: any) {
      toast.error(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white mb-4 shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Accept your invite</h1>
          <p className="text-sm text-gray-500 mt-1">DICT Region V</p>
        </div>

        <Card className="shadow-xl border-0">
          {!token && (
            <CardContent className="p-6">
              <p className="text-sm text-gray-700">
                This page needs an invite link. Ask your admin to resend it.
              </p>
              <Link href="/" className="text-blue-600 text-sm mt-4 inline-block">
                ← Back to home
              </Link>
            </CardContent>
          )}

          {token && inviteState === "loading" && (
            <CardContent className="p-6 text-sm text-gray-500">Checking invite…</CardContent>
          )}

          {token && inviteState === "invalid" && (
            <CardContent className="p-6">
              <h3 className="font-semibold text-red-700">Invalid invite</h3>
              <p className="text-sm text-gray-700 mt-2">
                This link isn't recognized. Ask an admin to send a new one.
              </p>
            </CardContent>
          )}

          {token && inviteState === "used" && (
            <CardContent className="p-6">
              <h3 className="font-semibold text-amber-700">Invite already used</h3>
              <p className="text-sm text-gray-700 mt-2">
                This invite has already been redeemed. Try{" "}
                <Link href="/login" className="text-blue-600 underline">signing in</Link>.
              </p>
            </CardContent>
          )}

          {token && inviteState === "expired" && (
            <CardContent className="p-6">
              <h3 className="font-semibold text-amber-700">Invite expired</h3>
              <p className="text-sm text-gray-700 mt-2">
                This invite has expired. Ask an admin to send a new one.
              </p>
            </CardContent>
          )}

          {token && inviteState === "ok" && invite && step === "otp" && (
            <>
              <CardHeader>
                <CardTitle>Verify your email</CardTitle>
                <CardDescription>
                  You've been invited as <b>{invite.role}</b> using <b>{invite.email}</b>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errorDetail && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {errorDetail}
                  </div>
                )}
                {!otpSent ? (
                  <Button
                    onClick={sendOtp}
                    disabled={loading}
                    className="w-full h-11"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {loading ? "Sending…" : "Send verification code"}
                  </Button>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">6-digit code</label>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        className="h-11 text-center tracking-[0.5em] font-mono text-lg"
                        inputMode="numeric"
                        autoFocus
                      />
                      <p className="text-xs text-gray-500">
                        Sent to {invite.email}.{" "}
                        <button
                          type="button"
                          onClick={sendOtp}
                          disabled={resendCooldown > 0 || loading}
                          className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                        </button>
                      </p>
                    </div>
                    <Button type="submit" disabled={loading || otp.length !== 6} className="w-full h-11">
                      {loading ? "Verifying…" : (<>Verify code <ArrowRight className="w-4 h-4 ml-2" /></>)}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}

          {token && inviteState === "ok" && invite && step === "password" && (
            <>
              <CardHeader>
                <CardTitle>Set your password</CardTitle>
                <CardDescription>Finish creating your DICT account.</CardDescription>
              </CardHeader>
              <CardContent>
                {errorDetail && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    {errorDetail}
                  </div>
                )}
                <form onSubmit={completeSignup} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Full name</label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="h-11"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="h-11"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Confirm password</label>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="h-11"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-11">
                    {loading ? "Creating account…" : (<>Create account <ArrowRight className="w-4 h-4 ml-2" /></>)}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {step === "done" && (
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold">Welcome to DICT Region V</h3>
              <p className="text-sm text-gray-600 mt-2">Redirecting…</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <AcceptInvitePageInner />
    </Suspense>
  )
}
