"use client";
import { Suspense } from "react";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function SupervisorRegisterPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const inviteInfo = useQuery(api.supervisors.verifyInvite, { token });
  const registerMut = useMutation(api.supervisors.register);

  const [form, setForm] = useState({ fullName: "", password: "", confirm: "", phone: "", department: "" });
  const [showPw,  setShowPw]  = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await registerMut({
        token,
        fullName: form.fullName,
        password: form.password,
        phone: form.phone || undefined,
        department: form.department || undefined,
      });
      localStorage.setItem("supervisor_token", res.token);
      router.push("/supervisor/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  if (!token) {
    return (
      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-bold mb-1">No Invite Token</h2>
        <p className="text-white/40 text-sm">Please use the invite link sent by your admin.</p>
      </div>
    );
  }

  if (inviteInfo === undefined) {
    return (
      <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl p-8 space-y-3">
        <Skeleton className="h-6 w-48 bg-white/10" />
        <Skeleton className="h-10 w-full bg-white/10" />
        <Skeleton className="h-10 w-full bg-white/10" />
      </div>
    );
  }

  if (!inviteInfo.valid) {
    return (
      <div className="bg-white/[0.06] border border-red-500/20 rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-bold mb-1">Invalid Invite</h2>
        <p className="text-white/40 text-sm">{inviteInfo.error}</p>
        <p className="text-white/30 text-xs mt-3">Contact your admin for a new invite link.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <h2 className="text-white text-base font-bold">Create Your Account</h2>
          <p className="text-white/40 text-xs">Invited as <span className="text-blue-400 font-medium">{inviteInfo.email}</span></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-5">
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4">
          <p className="text-blue-300 text-xs">Your email: <strong>{inviteInfo.email}</strong></p>
        </div>

        <div>
          <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Full Name *</Label>
          <Input placeholder="Your full name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required
            className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Department</Label>
            <Input placeholder="e.g. DICT R5" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-blue-500" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Phone</Label>
            <Input placeholder="09XX XXX XXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-blue-500" />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Password *</Label>
          <div className="relative">
            <Input type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
              className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-blue-500 pr-10" />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Confirm Password *</Label>
          <Input type={showPw ? "text" : "password"} placeholder="Re-enter password" value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required
            className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-blue-500" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading || !form.fullName || !form.password || !form.confirm}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 h-10 mt-1">
          {loading ? "Creating account…" : <><UserPlus className="w-4 h-4" />Create Account</>}
        </Button>
      </form>

      <p className="text-white/30 text-xs text-center mt-4">
        Already have an account?{" "}
        <a href="/supervisor-auth/login" className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</a>
      </p>
    </div>
  );
}

export default function SupervisorRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <SupervisorRegisterPageInner />
    </Suspense>
  )
}
