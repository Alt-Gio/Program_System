"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Mail, Building2, List, LayoutGrid, Camera, Loader2, X, Check,
} from "lucide-react";

// ─── Face server config (mirrors app/(main)/attendance/register/page.tsx) ──
const FACE_SERVER_BASE =
  process.env.NEXT_PUBLIC_FACE_SERVER_HTTP ?? "http://localhost:8001";
const FACE_API_TOKEN = process.env.NEXT_PUBLIC_FACE_API_TOKEN ?? "";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

const LAYOUT_KEY = "personnel-logbook-layout";

type Status = "present" | "traveling" | "absent";
type Layout = "vertical" | "horizontal";

type Person = {
  _id: Id<"personnel">;
  firstName: string;
  lastName: string;
  position: string;
  division: string;
  email?: string;
  isActive: boolean;
  status: Status;
  lastAction: "time_in" | "time_out" | null;
  lastEventAt: string | null;
  isOverridden: boolean;
  photoUrl: string | null;
};

// ─── Status → styling ──────────────────────────────────────────────
const STATUS_META: Record<Status, { label: string; ring: string; dot: string; badge: string }> = {
  present:   { label: "Present",        ring: "ring-green-500", dot: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-200" },
  traveling: { label: "Traveling / Out", ring: "ring-blue-500",  dot: "bg-blue-500",  badge: "bg-blue-100 text-blue-800 border-blue-200" },
  absent:    { label: "Absent",         ring: "ring-gray-300",  dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-600 border-gray-200" },
};

type Toast = { kind: "ok" | "err"; text: string } | null;

export function StaffDirectoryTab() {
  const personnel = useQuery(api.personnel.listWithStatus, { isActive: true }) as
    | Person[] | undefined;

  const [isAdmin, setIsAdmin] = useState(false);
  const [layout, setLayout] = useState<Layout>("vertical");
  const [toast, setToast] = useState<Toast>(null);

  // Resolve role (admin/manager get the management controls).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const role = data?.user?.role;
        if (!cancelled) setIsAdmin(role === "admin" || role === "manager");
      } catch {
        /* non-admin / signed out — controls stay hidden */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persisted layout preference.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(LAYOUT_KEY) : null;
    if (saved === "vertical" || saved === "horizontal") setLayout(saved);
  }, []);
  const changeLayout = (l: Layout) => {
    setLayout(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* ignore */ }
  };

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    const c = { present: 0, traveling: 0, absent: 0 };
    for (const p of personnel ?? []) c[p.status]++;
    return c;
  }, [personnel]);

  const loading = personnel === undefined;

  return (
    <div className="space-y-4">
      {/* Header: counts + legend + layout toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-500">{personnel?.length ?? 0} active personnel</span>
          <span className="h-4 w-px bg-gray-200" />
          <Legend status="present" count={counts.present} />
          <Legend status="traveling" count={counts.traveling} />
          <Legend status="absent" count={counts.absent} />
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <LayoutButton active={layout === "vertical"} onClick={() => changeLayout("vertical")} label="List view">
            <List className="h-4 w-4" />
          </LayoutButton>
          <LayoutButton active={layout === "horizontal"} onClick={() => changeLayout("horizontal")} label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </LayoutButton>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm " +
            (toast.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-900")
          }
        >
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : layout === "vertical" ? (
        <div className="space-y-2">
          {(personnel ?? []).map((p) => (
            <PersonRow key={p._id} person={p} isAdmin={isAdmin} setToast={setToast} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(personnel ?? []).map((p) => (
            <PersonCard key={p._id} person={p} isAdmin={isAdmin} setToast={setToast} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header helpers ────────────────────────────────────────────────
function Legend({ status, count }: { status: Status; count: number }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-600">
      <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
      {m.label}
      <span className="font-semibold text-gray-900">{count}</span>
    </span>
  );
}

function LayoutButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-7 w-8 items-center justify-center rounded-md transition " +
        (active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100")
      }
    >
      {children}
    </button>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────
function Avatar({ person, size }: { person: Person; size: "sm" | "lg" }) {
  const m = STATUS_META[person.status];
  const dim = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";
  return (
    <div className={`relative shrink-0 rounded-full ring-2 ${m.ring} ring-offset-2`}>
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt={`${person.firstName} ${person.lastName}`}
          className={`${dim} rounded-full object-cover`}
        />
      ) : (
        <div className={`${dim} flex items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700`}>
          {person.firstName[0]}{person.lastName[0]}
        </div>
      )}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${m.dot}`}
        title={m.label}
      />
    </div>
  );
}

function StatusBadge({ person }: { person: Person }) {
  const m = STATUS_META[person.status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${m.badge}`}>
      {m.label}{person.isOverridden ? " (manual)" : ""}
    </span>
  );
}

// ─── Vertical row ──────────────────────────────────────────────────
function PersonRow({ person, isAdmin, setToast }: PersonProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <Avatar person={person} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-gray-900">
            {person.firstName} {person.lastName}
          </p>
          <StatusBadge person={person} />
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">{person.position}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" />{person.division}
          </span>
          {person.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /><span className="truncate">{person.email}</span>
            </span>
          )}
        </div>
      </div>
      {isAdmin && <AdminControls person={person} setToast={setToast} />}
    </div>
  );
}

// ─── Horizontal card ───────────────────────────────────────────────
function PersonCard({ person, isAdmin, setToast }: PersonProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-4 text-center">
      <Avatar person={person} size="lg" />
      <p className="mt-2 truncate w-full font-semibold text-gray-900">
        {person.firstName} {person.lastName}
      </p>
      <p className="mt-0.5 truncate w-full text-xs text-gray-500">{person.position}</p>
      <div className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400">
        <Building2 className="h-3 w-3" />{person.division}
      </div>
      <div className="mt-2"><StatusBadge person={person} /></div>
      {isAdmin && <div className="mt-3 w-full"><AdminControls person={person} setToast={setToast} /></div>}
    </div>
  );
}

type PersonProps = { person: Person; isAdmin: boolean; setToast: (t: Toast) => void };

// ─── Admin controls: photo upload + status override ────────────────
function AdminControls({ person, setToast }: { person: Person; setToast: (t: Toast) => void }) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setPhoto = useMutation(api.personnel.setPhoto);
  const setStatus = useMutation(api.personnel.setStatus);
  const clearStatusOverride = useMutation(api.personnel.clearStatusOverride);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setToast({ kind: "err", text: "Only JPEG and PNG are supported." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ kind: "err", text: `File too large. Max is 8 MB.` });
      return;
    }

    setUploading(true);
    try {
      // 1) Store the display photo in Convex.
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
      const { storageId } = await res.json();
      await setPhoto({ id: person._id, storageId });

      // 2) Enroll the same image on the face server so they stay recognizable.
      //    Non-fatal: the photo is already saved regardless.
      let faceWarning = "";
      try {
        const form = new FormData();
        form.append("userId", person._id);
        form.append("name", `${person.firstName} ${person.lastName}`);
        form.append("role", "staff");
        form.append("program", person.division);
        form.append("file", file, "face.jpg");
        const headers: Record<string, string> = {};
        if (FACE_API_TOKEN) headers["X-Face-Api-Token"] = FACE_API_TOKEN;
        const fr = await fetch(`${FACE_SERVER_BASE}/api/register`, {
          method: "POST", headers, body: form,
        });
        if (!fr.ok) {
          const j = await fr.json().catch(() => ({}));
          faceWarning = ` Face enrollment skipped: ${j.detail ?? j.error ?? `HTTP ${fr.status}`}.`;
        }
      } catch {
        faceWarning = " Photo saved, but the face server was unreachable — enroll later from the Register page.";
      }

      setToast({
        kind: faceWarning ? "err" : "ok",
        text: `Photo updated for ${person.firstName}.${faceWarning}`,
      });
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setUploading(false);
    }
  };

  const onStatusChange = async (value: string) => {
    try {
      if (value === "auto") {
        await clearStatusOverride({ id: person._id });
      } else {
        await setStatus({ id: person._id, status: value as Status });
      }
    } catch (err) {
      setToast({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title="Upload photo (also enrolls for face recognition)"
        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        Photo
      </button>
      <select
        value={person.isOverridden ? person.status : "auto"}
        onChange={(e) => onStatusChange(e.target.value)}
        title="Override status for today"
        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="auto">Auto{person.isOverridden ? "" : " ✓"}</option>
        <option value="present">Present</option>
        <option value="traveling">Traveling</option>
        <option value="absent">Absent</option>
      </select>
      {person.isOverridden && <Check className="h-3.5 w-3.5 text-amber-500" />}
    </div>
  );
}
