"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ShieldCheck, Plus, UserX, UserCheck, Copy, Check,
  Clock, Mail, ExternalLink, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { avatarColor, initials } from "../_utils";
import type { Id } from "@/convex/_generated/dataModel";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";

export default function SupervisorsPage() {
  const supervisors  = useQuery(api.supervisors.list);
  const invites      = useQuery(api.supervisors.listInvites);
  const interns      = useQuery(api.interns.list);
  const createInvite = useMutation(api.supervisors.createInvite);
  const deactivate   = useMutation(api.supervisors.deactivate);
  const activate     = useMutation(api.supervisors.activate);
  const assignIntern = useMutation(api.supervisors.assignIntern);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignInternId, setAssignInternId] = useState("");
  const [assignSupervisorId, setAssignSupervisorId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const internsBySupervisor = useMemo(() => {
    const map: Record<string, number> = {};
    (interns ?? []).forEach(i => {
      if (i.supervisorId) {
        map[i.supervisorId as string] = (map[i.supervisorId as string] ?? 0) + 1;
      }
    });
    return map;
  }, [interns]);

  const unassignedInterns = useMemo(
    () => (interns ?? []).filter(i => i.status === "ACTIVE" && !i.supervisorId),
    [interns]
  );

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await createInvite({ email: inviteEmail, createdBy: "Admin" });
      setInviteResult({ token: res.token });
    } catch (e: any) {
      alert(e.message ?? "Failed to create invite");
    } finally { setInviting(false); }
  }

  function copyLink() {
    if (!inviteResult) return;
    const link = `${BASE_URL}/supervisor-auth/register?token=${inviteResult.token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAssign() {
    if (!assignInternId || !assignSupervisorId) return;
    setAssigning(true);
    try {
      await assignIntern({
        internId: assignInternId as Id<"interns">,
        supervisorId: assignSupervisorId as Id<"supervisors">,
      });
      setAssignOpen(false);
      setAssignInternId(""); setAssignSupervisorId("");
    } catch (e: any) {
      alert(e.message ?? "Failed to assign");
    } finally { setAssigning(false); }
  }

  const loading = supervisors === undefined;
  const pendingInvites = (invites ?? []).filter(i => !i.used && i.expiresAt > Date.now());

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Supervisors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Invite supervisors and assign interns to them</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0 text-xs" onClick={() => setAssignOpen(true)}>
            <Users className="w-4 h-4" />Assign Intern
          </Button>
          <Button size="sm" className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow"
            onClick={() => { setInviteEmail(""); setInviteResult(null); setInviteOpen(true); }}>
            <Plus className="w-4 h-4" />Invite Supervisor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Supervisors", val: supervisors?.length ?? 0,                          color: "text-gray-900" },
          { label: "Active",            val: (supervisors ?? []).filter(s => s.status === "active").length, color: "text-green-600" },
          { label: "Pending Invites",   val: pendingInvites.length,                             color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            {loading ? <Skeleton className="h-7 w-8 mx-auto mb-1" /> : <p className={cn("text-2xl font-bold", s.color)}>{s.val}</p>}
            <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Supervisor list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-800">Supervisor Accounts</h3>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : (supervisors ?? []).length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="w-9 h-9 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No supervisors yet — send an invite to get started</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 text-gray-500 font-semibold">
              <th className="px-4 py-2.5 text-left">Supervisor</th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">Department</th>
              <th className="px-4 py-2.5 text-center">Interns</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(supervisors ?? []).map(s => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: avatarColor(s.fullName) }}>{initials(s.fullName)}</div>
                      <div>
                        <p className="font-semibold text-gray-900">{s.fullName}</p>
                        <p className="text-[11px] text-gray-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{s.department ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">{internsBySupervisor[s.id as string] ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      s.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                    )}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.status === "active"
                      ? <button onClick={() => deactivate({ supervisorId: s.id as Id<"supervisors"> })} title="Deactivate"
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"><UserX className="w-4 h-4" /></button>
                      : <button onClick={() => activate({ supervisorId: s.id as Id<"supervisors"> })} title="Activate"
                          className="text-gray-300 hover:text-green-500 transition-colors p-1"><UserCheck className="w-4 h-4" /></button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-50 bg-amber-50/50">
            <Mail className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-gray-800">Pending Invites</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingInvites.map(inv => {
              const link = `${BASE_URL}/supervisor-auth/register?token=${inv.token}`;
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{inv.email}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 p-1.5 rounded transition-colors" title="Open invite link">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => { navigator.clipboard.writeText(link); }}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded transition-colors" title="Copy invite link">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={o => { setInviteOpen(o); if (!o) { setInviteResult(null); setInviteEmail(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite Supervisor</DialogTitle></DialogHeader>
          {!inviteResult ? (
            <>
              <div className="py-2">
                <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Supervisor Email *</Label>
                <Input type="email" placeholder="supervisor@dtc.gov.ph" value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()} />
                <p className="text-[11px] text-gray-400 mt-2">An invite link will be generated. Share it with the supervisor so they can set up their account.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail}
                  className="bg-blue-600 hover:bg-blue-700 text-white">{inviting ? "Generating…" : "Generate Invite"}</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-2 space-y-3">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Check className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">Invite created! Share this link:</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-[11px] text-gray-500 font-mono break-all">
                  {BASE_URL}/supervisor-auth/register?token={inviteResult.token}
                </p>
              </div>
              <Button size="sm" className="w-full gap-2" variant="outline" onClick={copyLink}>
                {copied ? <><Check className="w-4 h-4 text-green-500" />Copied!</> : <><Copy className="w-4 h-4" />Copy Invite Link</>}
              </Button>
              <DialogFooter><Button size="sm" onClick={() => setInviteOpen(false)} className="bg-blue-600 hover:bg-blue-700 text-white">Done</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Intern Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Intern to Supervisor</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intern *</Label>
              <select value={assignInternId} onChange={e => setAssignInternId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select intern…</option>
                {(interns ?? []).filter(i => i.status === "ACTIVE").map(i => (
                  <option key={i.id} value={i.id}>{i.fullName} {i.supervisorId ? "(assigned)" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Supervisor *</Label>
              <select value={assignSupervisorId} onChange={e => setAssignSupervisorId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select supervisor…</option>
                {(supervisors ?? []).filter(s => s.status === "active").map(s => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.department ?? "No dept."})</option>
                ))}
              </select>
            </div>
            {unassignedInterns.length > 0 && (
              <p className="text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">
                {unassignedInterns.length} active intern{unassignedInterns.length !== 1 ? "s" : ""} not yet assigned
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAssign} disabled={assigning || !assignInternId || !assignSupervisorId}
              className="bg-blue-600 hover:bg-blue-700 text-white">{assigning ? "Assigning…" : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
