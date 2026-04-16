"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KeyRound, Plus, UserX, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials } from "../_utils";
import type { Id } from "@/convex/_generated/dataModel";

const EMPTY_FORM = { internId: "", email: "", password: "" };

export default function InternAccountsPage() {
  const accounts      = useQuery(api.internAuth.listAccounts);
  const interns       = useQuery(api.interns.list);
  const createAccount = useMutation(api.internAuth.createAccount);
  const deactivate    = useMutation(api.internAuth.deactivateAccount);
  const resetPwd      = useMutation(api.internAuth.resetPassword);

  const [open,      setOpen]      = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetId,   setResetId]   = useState<string>("");
  const [resetPw,   setResetPw]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);

  const accountInternIds = useMemo(
    () => new Set((accounts ?? []).map(a => a.internId as string)),
    [accounts]
  );

  const availableInterns = useMemo(
    () => (interns ?? []).filter(i => !accountInternIds.has(i.id as string)),
    [interns, accountInternIds]
  );

  async function handleCreate() {
    if (!form.internId || !form.email || !form.password) return;
    setSaving(true);
    try {
      await createAccount({
        internId: form.internId as Id<"interns">,
        email: form.email,
        password: form.password,
      });
      setOpen(false);
      setForm({ ...EMPTY_FORM });
    } catch (e: any) {
      alert(e.message ?? "Failed to create account");
    } finally { setSaving(false); }
  }

  async function handleReset() {
    if (!resetId || !resetPw) return;
    setSaving(true);
    try {
      await resetPwd({ loginId: resetId as Id<"internLogins">, newPassword: resetPw });
      setResetOpen(false);
      setResetPw("");
    } catch (e: any) {
      alert(e.message ?? "Failed to reset password");
    } finally { setSaving(false); }
  }

  const loading = accounts === undefined;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Intern Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage login credentials for interns. Share the login link:&nbsp;
            <span className="font-mono text-blue-600 text-[11px]">/intern-auth/login</span>
          </p>
        </div>
        <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow shrink-0"
          onClick={() => { setForm({ ...EMPTY_FORM }); setOpen(true); }}>
          <Plus className="w-4 h-4" />Create Account
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Accounts", val: accounts?.length ?? 0, color: "text-gray-900" },
          { label: "Active",  val: (accounts ?? []).filter(a => a.isActive).length, color: "text-green-600" },
          { label: "No Account Yet", val: availableInterns.length, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            {loading ? <Skeleton className="h-7 w-8 mx-auto mb-1" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <KeyRound className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-800">Account Registry</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (accounts ?? []).length === 0 ? (
          <div className="py-12 text-center">
            <KeyRound className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No intern accounts yet</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold">
                <th className="px-4 py-2.5 text-left">Intern</th>
                <th className="px-4 py-2.5 text-left">Login Email</th>
                <th className="px-4 py-2.5 text-left hidden sm:table-cell">School</th>
                <th className="px-4 py-2.5 text-left hidden md:table-cell">Last Login</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(accounts ?? []).map(acc => (
                <tr key={acc.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: avatarColor(acc.internName) }}>
                        {initials(acc.internName)}
                      </div>
                      <span className="font-semibold text-gray-800">{acc.internName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{acc.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{acc.school}</td>
                  <td className="px-4 py-3 text-gray-400 tabular-nums hidden md:table-cell">
                    {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      acc.isActive
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-600 border-red-200"
                    )}>{acc.isActive ? "Active" : "Disabled"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button title="Reset password"
                        onClick={() => { setResetId(acc.id as string); setResetPw(""); setResetOpen(true); }}
                        className="text-gray-300 hover:text-blue-500 transition-colors p-1 rounded">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {acc.isActive && (
                        <button title="Disable account"
                          onClick={() => { if (confirm("Disable this account?")) deactivate({ loginId: acc.id as Id<"internLogins"> }); }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Account Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Intern Account</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intern *</Label>
              <select value={form.internId} onChange={e => {
                const intern = (interns ?? []).find(i => i.id === e.target.value);
                setForm(f => ({ ...f, internId: e.target.value, email: intern?.email ?? "" }));
              }} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select intern…</option>
                {availableInterns.map(i => <option key={i.id} value={i.id}>{i.fullName}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Login Email *</Label>
              <Input type="email" placeholder="intern@school.edu" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Initial Password *</Label>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="pr-9" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving || !form.internId || !form.email || !form.password}
              className="bg-blue-600 hover:bg-blue-700 text-white">{saving ? "Creating…" : "Create Account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">New Password *</Label>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} placeholder="Min. 6 characters" value={resetPw}
                onChange={e => setResetPw(e.target.value)} className="pr-9" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleReset} disabled={saving || !resetPw}
              className="bg-blue-600 hover:bg-blue-700 text-white">{saving ? "Saving…" : "Reset Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
