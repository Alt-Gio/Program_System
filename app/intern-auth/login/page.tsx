"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      localStorage.setItem("intern_data", JSON.stringify(res.intern));
      router.push("/intern/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-white text-base font-bold leading-tight">Intern Sign In</h2>
        <p className="text-white/40 text-xs mt-1">Track your hours, tasks, and progress</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Email Address</Label>
          <Input
            type="email" placeholder="your@school.edu" value={email}
            onChange={e => setEmail(e.target.value)} required autoFocus
            className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-indigo-500 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Password</Label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} required
              className="bg-white/[0.08] border-white/[0.12] text-white placeholder:text-white/30 focus:border-indigo-500 focus:ring-indigo-500/20 pr-10"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={loading || !email || !password}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 h-10">
          {loading ? "Signing in…" : <><LogIn className="w-4 h-4" />Sign In</>}
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
        <p className="text-white/30 text-xs">
          Your account is set up by your supervisor or admin.<br />
          Contact them if you cannot log in.
        </p>
      </div>
    </div>
  );
}
