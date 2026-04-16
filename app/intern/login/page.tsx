"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function InternLoginPage() {
  const router   = useRouter();
  const loginMut = useMutation(api.internAuth.login);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginMut({ email, password });
      localStorage.setItem("intern_token", res.token);
      localStorage.setItem("intern_data",  JSON.stringify(res.intern));
      router.push("/intern/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-900/50">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <h1 className="text-white text-lg font-extrabold tracking-widest">DTC REGION V</h1>
        <p className="text-white/40 text-xs tracking-widest mt-0.5">INTERN PORTAL</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/[0.05] border border-white/[0.08] rounded-3xl p-7 shadow-2xl">
        <h2 className="text-white text-base font-bold mb-1">Welcome back!</h2>
        <p className="text-white/40 text-xs mb-6">Sign in to track your internship progress</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Email Address</label>
            <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-indigo-500 focus:bg-white/[0.10] transition-all" />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-white/[0.07] border border-white/[0.12] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-indigo-500 focus:bg-white/[0.10] transition-all pr-12" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading || !email || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-all mt-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-4 h-4" />Sign In</>}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-white/[0.07] text-center space-y-2">
          <p className="text-white/30 text-xs">
            First time?{" "}
            <Link href="/intern/register" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Create your account
            </Link>
          </p>
          <p className="text-white/20 text-[11px]">Your account is linked to your intern email on file.</p>
        </div>
      </div>
    </div>
  );
}
