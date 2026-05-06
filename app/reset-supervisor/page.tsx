"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Shield, CheckCircle2, RefreshCw, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function ResetSupervisorPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const reset = useMutation(api.resetTestSupervisor.resetTestSupervisor);

  async function handleReset() {
    setLoading(true);
    try {
      const res = await reset({});
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-amber-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-amber-900/50">
            <RefreshCw className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-extrabold tracking-tight">Reset Test Supervisor</h1>
          <p className="text-white/40 text-sm mt-1">Delete and recreate the test supervisor account with correct settings</p>
        </div>

        {/* Reset Button */}
        {!result && (
          <button
            onClick={handleReset}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-4 text-lg flex items-center justify-center gap-3 transition-all shadow-2xl shadow-amber-900/50 mb-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-6 h-6" />
                Reset Supervisor Account
              </>
            )}
          </button>
        )}

        {/* Success Result */}
        {result && !result.error && (
          <div className="space-y-4">
            {/* Success Banner */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <p className="text-green-300 font-bold text-sm">Supervisor Account Reset!</p>
                <p className="text-green-400/60 text-xs mt-0.5">You can now log in with the credentials below</p>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Supervisor Account</p>
                  <p className="text-white/40 text-xs">Juan Dela Cruz</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Email */}
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Email</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-mono">
                      test.supervisor@example.com
                    </code>
                    <button
                      onClick={() => copyToClipboard("test.supervisor@example.com", "email")}
                      className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                    >
                      {copied === "email" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/40" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Password</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-mono">
                      supervisor123
                    </code>
                    <button
                      onClick={() => copyToClipboard("supervisor123", "password")}
                      className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                    >
                      {copied === "password" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-white/40" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Login Link */}
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.10] rounded-xl py-2.5 text-white text-sm font-semibold transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Go to Supervisor Login
                </Link>
              </div>
            </div>

            {/* Reset Again Button */}
            <button
              onClick={() => setResult(null)}
              className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 hover:text-white font-semibold rounded-xl py-3 text-sm transition-all"
            >
              Reset Again
            </button>
          </div>
        )}

        {/* Error */}
        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
            <p className="text-red-400 text-sm font-semibold">Error: {result.error}</p>
            <button
              onClick={() => setResult(null)}
              className="mt-3 text-red-400/60 hover:text-red-400 text-xs font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
          <p className="text-white/30 text-xs leading-relaxed">
            <strong className="text-white/50">Note:</strong> This will delete the existing test supervisor account
            and create a new one with the correct status field (lowercase "active") so you can log in successfully.
          </p>
        </div>
      </div>
    </div>
  );
}
