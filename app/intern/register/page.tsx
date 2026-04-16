"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, Info } from "lucide-react";

export default function InternRegisterPage() {
  const router   = useRouter();
  const regMut   = useMutation(api.internAuth.selfRegister);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await regMut({ email, password });
      localStorage.setItem("intern_token", res.token);
      localStorage.setItem("intern_data",  JSON.stringify(res.intern));
      router.push("/intern/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-900/50">
          <UserPlus className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-white text-lg font-extrabold tracking-widest">CREATE ACCOUNT</h1>
        <p className="text-white/40 text-xs tracking-widest mt-0.5">INTERN PORTAL</p>
      </div>

      {/* Info banner */}
      <div className="w-full max-w-sm mb-4 flex items-start gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-4 py-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-indigo-300 text-xs leading-relaxed">
          Use the email your admin registered you with. Your account will be linked automatically.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/[0.05] border border-white/[0.08] rounded-3xl p-7 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Registered Email *</label>
            <input type="email" placeholder="your.name@school.edu" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-indigo-500 focus:bg-white/[0.10] transition-all" />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Set Password *</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={password}
                onChange={e => setPassword(e.target.value)} required
                className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-indigo-500 focus:bg-white/[0.10] transition-all pr-12" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Confirm Password *</label>
            <input type={showPw ? "text" : "password"} placeholder="Re-enter password" value={confirm}
              onChange={e => setConfirm(e.target.value)} required
              className={`w-full bg-white/[0.07] border rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none transition-all ${
                confirm && password !== confirm ? "border-red-500/60" : "border-white/[0.12] focus:border-indigo-500 focus:bg-white/[0.10]"
              }`} />
            {confirm && password !== confirm && (
              <p className="text-red-400 text-[11px] mt-1 ml-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password || !confirm}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-all mt-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <><UserPlus className="w-4 h-4" />Create Account</>
            }
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-white/[0.07] text-center">
          <p className="text-white/30 text-xs">
            Already have an account?{" "}
            <Link href="/intern/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
