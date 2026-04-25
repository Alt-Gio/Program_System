"use client";

import { memo, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Search,
  Copy,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Clock,
} from "lucide-react";
import { relativeTime } from "@/lib/relativeTime";
import { PROGRAM_LIST } from "@/lib/import/programSchemas";
import type { Id } from "@/convex/_generated/dataModel";

type Role = "admin" | "supervisor" | "mentor" | "intern" | "readonly";
type Status = "active" | "inactive" | "pending";

const ROLES: Role[] = ["admin", "supervisor", "mentor", "intern", "readonly"];

type User = {
  _id: Id<"user_accounts">;
  name: string;
  email: string;
  role: Role;
  program?: string;
  status: Status;
  lastLoginAt?: number;
  invitedAt: number;
  invitedBy?: string;
  inviteToken?: string;
};

export function UserAccountsTab() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const users = useQuery(api.user_accounts.listUserAccounts, {
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  }) as User[] | undefined;
  const counts = useQuery(api.user_accounts.countsByStatus, {}) as
    | { total: number; active: number; inactive: number; pending: number }
    | undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="h-3.5 w-3.5" /> Invite User
        </Button>
      </div>

      {/* Counts strip */}
      {counts && (
        <div className="grid grid-cols-4 gap-2">
          <Count label="Total" value={counts.total} color="gray" />
          <Count label="Active" value={counts.active} color="emerald" />
          <Count label="Pending" value={counts.pending} color="amber" />
          <Count label="Inactive" value={counts.inactive} color="slate" />
        </div>
      )}

      {users === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <UserPlus className="mb-2 h-8 w-8 text-gray-300" />
          <div className="text-sm font-medium text-gray-700">No users yet</div>
          <div className="text-xs text-gray-500">
            Invite a teammate to get started.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u._id} user={u} />
          ))}
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

// Memoized row — avoids re-rendering every other row when one user changes
const UserRow = memo(
  function UserRow({ user }: { user: User }) {
    const setRole = useMutation(api.user_accounts.setRole);
    const setStatus = useMutation(api.user_accounts.setStatus);
    const deleteUser = useMutation(api.user_accounts.deleteUserAccount);
    const [editing, setEditing] = useState(false);
    const [newRole, setNewRole] = useState<Role>(user.role);
    const [newProgram, setNewProgram] = useState(user.program ?? "");

    const initials = user.name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const saveRole = async () => {
      try {
        await setRole({
          id: user._id,
          role: newRole,
          program: newProgram || undefined,
        });
        toast.success(`Role updated for ${user.name}`);
        setEditing(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to save");
      }
    };

    return (
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-gray-900">
                {user.name}
              </div>
              <RoleBadge role={user.role} />
              <StatusDot status={user.status} />
            </div>
            <div className="truncate text-xs text-gray-500">
              {user.email}
              {user.program ? ` · ${user.program}` : ""}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" />
              {user.lastLoginAt ? (
                <>Last login {relativeTime(user.lastLoginAt)}</>
              ) : user.status === "pending" ? (
                <>Invited {relativeTime(user.invitedAt)} — not accepted yet</>
              ) : (
                <>Never signed in</>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {user.status === "pending" && user.inviteToken && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  const link = `${window.location.origin}/accept-invite?token=${user.inviteToken}`;
                  navigator.clipboard.writeText(link);
                  toast.success("Invite link copied");
                }}
              >
                <Copy className="h-3 w-3" /> Copy invite link
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setEditing((v) => !v)}
            >
              <ShieldCheck className="h-3 w-3" /> {editing ? "Cancel" : "Edit role"}
            </Button>
            {user.status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 border-amber-200 text-xs text-amber-700 hover:bg-amber-50"
                onClick={() =>
                  setStatus({ id: user._id, status: "inactive" }).then(() =>
                    toast.success(`${user.name} deactivated`),
                  )
                }
              >
                <ShieldOff className="h-3 w-3" /> Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50"
                onClick={() =>
                  setStatus({ id: user._id, status: "active" }).then(() =>
                    toast.success(`${user.name} reactivated`),
                  )
                }
              >
                <ShieldCheck className="h-3 w-3" /> Reactivate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
              title="Remove"
              onClick={async () => {
                if (!confirm(`Remove ${user.name}?`)) return;
                await deleteUser({ id: user._id });
                toast.success(`${user.name} removed`);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {editing && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-gray-500">Role</span>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            {(newRole === "intern" || newRole === "mentor") && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-gray-500">Program</span>
                <select
                  value={newProgram}
                  onChange={(e) => setNewProgram(e.target.value)}
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm"
                >
                  <option value="">(none)</option>
                  {PROGRAM_LIST.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button size="sm" className="ml-auto h-8 text-xs" onClick={saveRole}>
              Save
            </Button>
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.user._id === next.user._id &&
    prev.user.role === next.user.role &&
    prev.user.status === next.user.status &&
    prev.user.program === next.user.program &&
    prev.user.lastLoginAt === next.user.lastLoginAt,
);

function RoleBadge({ role }: { role: Role }) {
  const style: Record<Role, string> = {
    admin: "bg-red-50 text-red-700 border-red-200",
    supervisor: "bg-blue-50 text-blue-700 border-blue-200",
    mentor: "bg-violet-50 text-violet-700 border-violet-200",
    intern: "bg-emerald-50 text-emerald-700 border-emerald-200",
    readonly: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${style[role]}`}
    >
      {role}
    </span>
  );
}

function StatusDot({ status }: { status: Status }) {
  const color =
    status === "active"
      ? "bg-emerald-500"
      : status === "pending"
        ? "bg-amber-500"
        : "bg-gray-300";
  return (
    <span
      title={status}
      className={`inline-block h-2 w-2 rounded-full ${color}`}
    />
  );
}

function Count({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "slate" | "gray";
}) {
  const c = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-600",
    gray: "bg-gray-50 text-gray-700",
  }[color];
  return (
    <div className={`rounded-xl border border-gray-200 p-2 text-center ${c}`}>
      <div className="text-xl font-bold leading-tight">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </div>
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const invite = useMutation(api.user_accounts.inviteUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("intern");
  const [program, setProgram] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setRole("intern");
    setProgram("");
    setInviteLink(null);
  };

  const handleSend = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!email.trim()) return toast.error("Email is required");
    setSubmitting(true);
    try {
      const res = await invite({
        name: name.trim(),
        email: email.trim(),
        role,
        program: program || undefined,
        invitedBy: "admin",
      });
      const link = `${window.location.origin}/accept-invite?token=${res.token}`;
      setInviteLink(link);
      toast.success(`Invite created for ${name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create invite");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Creates a pending account. The user becomes active the first time
            they sign in through the invite link.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              ✓ Invite created. Share the link below (or let the Gmail
              integration email it).
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="h-8 flex-1 rounded-md border border-gray-200 bg-gray-50 px-2 font-mono text-[11px] text-gray-600"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  reset();
                }}
              >
                Invite another
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                placeholder="Juan Dela Cruz"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                placeholder="name@dict.gov.ph"
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            {(role === "intern" || role === "mentor") && (
              <Field label="Program">
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                >
                  <option value="">(none)</option>
                  {PROGRAM_LIST.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSend} disabled={submitting}>
                {submitting ? "Sending…" : "Send Invite"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
