"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserPlus, Shield, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function TestAccountsPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const createBoth = useMutation(api.seedTestAccounts.createBothTestAccounts);

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await createBoth({});
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-900/50">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-extrabold tracking-tight">Create Test Accounts</h1>
          <p className="text-white/40 text-sm mt-1">Generate demo accounts for testing the intern portal</p>
        </div>

        {/* Create Button */}
        {!result && (
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-4 text-lg flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-900/50 mb-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-6 h-6" />
                Create Test Accounts
              </>
            )}
          </button>
        )}

        {/* Results */}
        {result && !result.error && (
          <div className="space-y-4">
            {/* Success Banner */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
              <div>
                <p className="text-green-300 font-bold text-sm">Accounts Created Successfully!</p>
                <p className="text-green-400/60 text-xs mt-0.5">Use the credentials below to log in</p>
              </div>
            </div>

            {/* Account Cards */}
            {result.summary?.accounts.map((account: any) => (
              <div key={account.type} className="bg-white/[0.05] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  {account.type === "Intern" ? (
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-indigo-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-amber-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-base">{account.type} Account</p>
                    <p className="text-white/40 text-xs">{account.name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Email */}
                  <div>
                    <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-mono">
                        {account.email}
                      </code>
                      <button
                        onClick={() => copyToClipboard(account.email, `${account.type}-email`)}
                        className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                      >
                        {copied === `${account.type}-email` ? (
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
                        {account.password}
                      </code>
                      <button
                        onClick={() => copyToClipboard(account.password, `${account.type}-password`)}
                        className="w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] flex items-center justify-center transition-all"
                      >
                        {copied === `${account.type}-password` ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-white/40" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Login Link */}
                  <Link
                    href={account.loginUrl}
                    className="flex items-center justify-center gap-2 w-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.10] rounded-xl py-2.5 text-white text-sm font-semibold transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Go to {account.type} Login
                  </Link>
                </div>
              </div>
            ))}

            {/* Reset Button */}
            <button
              onClick={() => setResult(null)}
              className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 hover:text-white font-semibold rounded-xl py-3 text-sm transition-all"
            >
              Create New Accounts
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
            <strong className="text-white/50">Note:</strong> These test accounts include sample data:
            attendance records, tasks, habits, journal entries, and goals. Perfect for testing all features
            of the intern portal.
          </p>
        </div>
      </div>
    </div>
  );
}
