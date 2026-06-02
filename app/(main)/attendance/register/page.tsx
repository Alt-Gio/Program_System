"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Camera as CameraIcon, UserPlus, CheckCircle, Loader2, X, ArrowLeft, AlertCircle,
  ServerCrash, Sparkles, ChevronDown, ChevronRight, Clock, LogIn, LogOut,
} from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────

const FACE_SERVER_BASE =
  process.env.NEXT_PUBLIC_FACE_SERVER_HTTP ?? "http://localhost:8001";
const API_TOKEN = process.env.NEXT_PUBLIC_FACE_API_TOKEN ?? "";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/** How many training frames to capture in one burst. The face server
 *  weight-averages samples into a single embedding per userId, so 5 good
 *  shots at slightly different angles/expressions gives a materially better
 *  recognition model than a single snapshot. */
const BURST_SHOTS = 5;
/** Gap between shots. Long enough for natural micro-movements to vary the
 *  sample, short enough that the whole burst feels "instant" (~2 seconds). */
const BURST_INTERVAL_MS = 420;

// ─── Types ───────────────────────────────────────────────────────

type RegisteredFace = {
  user_id:       string;
  name:          string;
  role:          string;
  program:       string | null;
  registered_at: string;
  sample_count:  number;
};

type UserAccount = {
  _id:     Id<"user_accounts">;
  name:    string;
  email:   string;
  role:    "admin" | "supervisor" | "mentor" | "intern" | "readonly";
  program?: string;
};

type AuthUser = {
  id:    Id<"users">;
  name:  string;
  email: string;
  role:  string;
};

/** Merged row shown in the picker — unifies both tables + manual entries. */
type EnrollableOption = {
  key:        string;
  userId:     string;
  name:       string;
  email:      string;
  role:       string;
  program:    string;
  source:     "account" | "auth" | "manual";
  registered: boolean;
};

const MANUAL_OPTION_KEY = "__manual__";
const ROLE_OPTIONS = [
  { value: "intern",     label: "Intern"     },
  { value: "mentor",     label: "Mentor"     },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager",    label: "Manager"    },
  { value: "admin",      label: "Admin"      },
  { value: "readonly",   label: "Staff"      },
  { value: "guest",      label: "Guest"      },
];

// ─── Component ───────────────────────────────────────────────────

export default function RegisterFacePage() {
  // Two separate sources. Either (or both) may be empty — the manual-entry
  // option still lets staff enroll someone without an account.
  const accountUsers = useQuery(api.user_accounts.listUserAccounts, {}) as
    | UserAccount[] | undefined;
  const authUsers    = useQuery(api.auth.listEnrollableAuthUsers, {}) as
    | AuthUser[] | undefined;
  const positions    = useQuery(api.personnel.listPositions, {}) as
    | string[] | undefined;

  // Upserts a personnel row when registering a Staff member, returning its id
  // so the face is enrolled under it (and shows up in the Personnel logbook).
  const upsertStaff = useMutation(api.personnel.upsertStaff);

  const [registered,    setRegistered]    = useState<RegisteredFace[] | null>(null);
  const [selectedKey,   setSelectedKey]   = useState<string>("");
  const [manualName,    setManualName]    = useState("");
  const [manualRole,    setManualRole]    = useState("intern");
  const [manualProgram, setManualProgram] = useState("");
  const [manualPosition, setManualPosition] = useState("");
  // Only used for the file-upload path. Camera burst never touches this.
  const [photoBlob,     setPhotoBlob]     = useState<Blob | null>(null);
  const [photoName,     setPhotoName]     = useState<string>("");
  const [useCamera,     setUseCamera]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [capturing,     setCapturing]     = useState(false);
  const [captureStep,   setCaptureStep]   = useState(0); // 1..BURST_SHOTS
  const [serverStatus,  setServerStatus]  = useState<"checking" | "online" | "offline">("checking");
  const [message,       setMessage]       = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Load registered faces list — also doubles as a health check ───────
  const loadRegistered = useCallback(async () => {
    try {
      const resp = await fetch(`${FACE_SERVER_BASE}/api/registered`, {
        // CORS: server must allow our origin in CORS_ORIGINS
        cache: "no-store",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setRegistered(await resp.json());
      setServerStatus("online");
    } catch (e) {
      console.warn("[face] Could not load registered list:", e);
      setRegistered([]);
      setServerStatus("offline");
    }
  }, []);

  useEffect(() => {
    loadRegistered();
  }, [loadRegistered]);

  // ── Camera start / stop ────────────────────────────────────────
  useEffect(() => {
    if (!useCamera) return;

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        setMessage({
          kind: "err",
          text: `Camera access denied: ${e instanceof Error ? e.message : String(e)}`,
        });
        setUseCamera(false);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [useCamera]);

  // Also stop on unmount regardless of tab state.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ── Grab one frame from the live camera as a JPEG Blob. ────────────
  //    Used by the burst-capture flow; never mutates state so it's safe to
  //    call several times in rapid succession.
  const captureBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        resolve(null);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, []);

  // ── Upload from file ───────────────────────────────────────────
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setMessage({ kind: "err", text: "Only JPEG and PNG are supported." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({
        kind: "err",
        text: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 8 MB.`,
      });
      return;
    }

    setPhotoBlob(file);
    setPhotoName(file.name);
  };

  // ── Resolve who we're registering — shared by burst + single-file paths ─
  //    Async because the Staff path upserts a personnel record first so the
  //    face is enrolled under that personnel id (and appears in the logbook).
  //    Throws so callers can surface the error in the toast.
  const resolveTarget = async (): Promise<{
    userId: string; name: string; role: string; program: string;
  }> => {
    if (selectedKey === MANUAL_OPTION_KEY) {
      const name = manualName.trim();
      if (!name) throw new Error("Enter a name for the person first.");

      // Staff → create/update a Personnel row, enroll under its id.
      if (manualRole === "readonly") {
        const position = manualPosition.trim();
        if (!position) {
          throw new Error("Pick or type a Position for this staff member.");
        }
        const tokens    = name.split(/\s+/);
        const firstName = tokens.length > 1 ? tokens.slice(0, -1).join(" ") : tokens[0];
        const lastName  = tokens.length > 1 ? tokens[tokens.length - 1] : "";
        const personnelId = await upsertStaff({
          firstName,
          lastName,
          position,
          division: manualProgram.trim(),
        });
        return {
          userId:  personnelId,
          name,
          role:    "staff",
          program: manualProgram.trim(),
        };
      }

      const slug =
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
        "person";
      return {
        userId:  `manual-${Date.now().toString(36)}-${slug}`,
        name,
        role:    manualRole || "guest",
        program: manualProgram.trim(),
      };
    }
    const picked = options.find((o) => o.key === selectedKey);
    if (!picked) throw new Error("Pick a person first.");
    return {
      userId:  picked.userId,
      name:    picked.name,
      role:    picked.role,
      program: picked.program,
    };
  };

  // ── POST a single sample to the face server ───────────────────────
  const registerOneShot = async (
    target: { userId: string; name: string; role: string; program: string },
    blob:   Blob,
  ): Promise<{ sampleCount: number }> => {
    const form = new FormData();
    form.append("userId",  target.userId);
    form.append("name",    target.name);
    form.append("role",    target.role);
    form.append("program", target.program);
    form.append("file",    blob, "face.jpg");

    const headers: Record<string, string> = {};
    if (API_TOKEN) headers["X-Face-Api-Token"] = API_TOKEN;

    let resp: Response;
    try {
      resp = await fetch(`${FACE_SERVER_BASE}/api/register`, {
        method: "POST",
        headers,
        body:   form,
      });
    } catch (e) {
      // Browser "Failed to fetch" — almost always means the server is off or
      // CORS rejected the origin. Bubble up a more actionable message.
      setServerStatus("offline");
      throw new Error(
        `Cannot reach face server at ${FACE_SERVER_BASE}. ` +
        `Start it with "uvicorn app.main:app --port 8001" and make sure ` +
        `this origin is in its CORS_ORIGINS.` +
        (e instanceof Error ? ` (${e.message})` : ""),
      );
    }
    setServerStatus("online");
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(json.detail ?? json.error ?? `HTTP ${resp.status}`);
    }
    return { sampleCount: json.sampleCount ?? 1 };
  };

  // ── Burst capture: 5 quick training shots, one userId ────────────────
  //    All shots share the same userId so the face server refines a single
  //    embedding rather than creating 5 separate identities.
  const burstCapture = async () => {
    if (capturing || submitting) return;

    let target;
    try {
      target = await resolveTarget();
    } catch (e) {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    setCapturing(true);
    setMessage(null);

    let successes = 0;
    let lastCount = 0;
    let lastError: string | null = null;

    for (let i = 0; i < BURST_SHOTS; i++) {
      setCaptureStep(i + 1);
      const blob = await captureBlob();
      if (!blob) {
        lastError = "Camera frame was blank — retrying.";
      } else {
        try {
          const { sampleCount } = await registerOneShot(target, blob);
          successes++;
          lastCount = sampleCount;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      if (i < BURST_SHOTS - 1) {
        await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
      }
    }

    setCapturing(false);
    setCaptureStep(0);

    if (successes === 0) {
      setMessage({
        kind: "err",
        text: lastError ?? "Registration failed. See console for details.",
      });
      return;
    }

    setMessage({
      kind: "ok",
      text:
        `✓ ${target.name} registered — ${lastCount} sample(s) on file ` +
        `(${successes}/${BURST_SHOTS} shots accepted). ` +
        `The kiosk will recognize this person within seconds.`,
    });
    await loadRegistered();
  };

  // ── Single-shot submit (file upload path only) ────────────────────
  const submit = async () => {
    if (!photoBlob || submitting) return;

    let target;
    try {
      target = await resolveTarget();
    } catch (e) {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const { sampleCount } = await registerOneShot(target, photoBlob);
      setMessage({
        kind: "ok",
        text:
          `✓ ${target.name} registered — ${sampleCount} sample(s) on file. ` +
          `The kiosk will recognize this person within seconds.`,
      });
      setPhotoBlob(null);
      setPhotoName("");
      await loadRegistered();
    } catch (e) {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────
  const registeredMap = useMemo(() => {
    const m = new Map<string, RegisteredFace>();
    (registered ?? []).forEach((r) => m.set(r.user_id, r));
    return m;
  }, [registered]);

  /**
   * Merge auth users + user_accounts. Dedupe by email (case-insensitive);
   * user_accounts entries win when both tables contain the same person
   * because they carry the extra `program` field. Unregistered people are
   * sorted first — that's usually the reason someone landed on this page.
   */
  const options = useMemo<EnrollableOption[]>(() => {
    const seenEmails = new Set<string>();
    const out: EnrollableOption[] = [];

    for (const a of accountUsers ?? []) {
      const emailKey = a.email.toLowerCase();
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);
      out.push({
        key:        a._id,
        userId:     a._id,
        name:       a.name,
        email:      a.email,
        role:       a.role,
        program:    a.program ?? "",
        source:     "account",
        registered: registeredMap.has(a._id),
      });
    }
    for (const u of authUsers ?? []) {
      const emailKey = u.email.toLowerCase();
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);
      out.push({
        key:        u.id,
        userId:     u.id,
        name:       u.name,
        email:      u.email,
        role:       u.role,
        program:    "",
        source:     "auth",
        registered: registeredMap.has(u.id),
      });
    }

    out.sort((x, y) => {
      if (x.registered !== y.registered) return x.registered ? 1 : -1;
      return x.name.localeCompare(y.name);
    });
    return out;
  }, [accountUsers, authUsers, registeredMap]);

  const selected     = options.find((o) => o.key === selectedKey);
  const isManual     = selectedKey === MANUAL_OPTION_KEY;
  const selectedReg  = selected ? registeredMap.get(selected.userId) : undefined;
  const loadingUsers = accountUsers === undefined && authUsers === undefined;

  // ─── UI ────────────────────────────────────────────────────────
  return (
    <div className="page-content space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/attendance"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold">Register Face</h1>
        </div>
      </div>

      {/* Server offline banner — replaces the opaque "Failed to fetch" toast
          with something actionable. Polled implicitly every time we hit the
          server, so it flips back to hidden the moment connectivity returns. */}
      {serverStatus === "offline" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <ServerCrash className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Face server is unreachable</p>
            <p className="text-xs opacity-80">
              Tried <code className="bg-amber-100 px-1 rounded">{FACE_SERVER_BASE}</code>.
              Start the Python service and make sure this origin is listed in its CORS_ORIGINS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setServerStatus("checking"); void loadRegistered(); }}
            className="text-xs font-medium px-2 py-1 bg-amber-100 rounded hover:bg-amber-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Result toast */}
      {message && (
        <div
          className={
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm " +
            (message.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          {message.kind === "ok" ? (
            <CheckCircle className="w-4 h-4 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5" />
          )}
          <span>{message.text}</span>
          <button
            type="button"
            className="ml-auto opacity-60 hover:opacity-100"
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: form */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">Enroll a person</h2>

          {/* Person picker — grouped by source, with a manual-entry escape
              hatch for walk-ins who don't have an account yet. */}
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Person</span>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              disabled={submitting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">
                {loadingUsers
                  ? "Loading people…"
                  : options.length === 0
                      ? "No accounts found — use manual entry below"
                      : "Select a person…"}
              </option>

              <option value={MANUAL_OPTION_KEY}>
                + Enter manually (guest / walk-in)
              </option>

              {options.some((o) => o.source === "account") && (
                <optgroup label="Personnel accounts">
                  {options
                    .filter((o) => o.source === "account")
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.name} · {o.role}
                        {o.program ? ` · ${o.program}` : ""}
                        {o.registered ? "  ✓" : ""}
                      </option>
                    ))}
                </optgroup>
              )}

              {options.some((o) => o.source === "auth") && (
                <optgroup label="System users">
                  {options
                    .filter((o) => o.source === "auth")
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.name} · {o.role} · {o.email}
                        {o.registered ? "  ✓" : ""}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>

          {/* Manual-entry form appears inline. */}
          {isManual && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-700">Full name</span>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Maria Santos"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-700">Role</span>
                <select
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  disabled={submitting}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>

              {/* Staff get a Position — pick an existing one from the datalist
                  or type a new one. On register this upserts a Personnel row. */}
              {manualRole === "readonly" && (
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-gray-700">
                    Position <span className="text-gray-400">(pick or type)</span>
                  </span>
                  <input
                    type="text"
                    list="staff-positions"
                    value={manualPosition}
                    onChange={(e) => setManualPosition(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Information Systems Analyst II"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <datalist id="staff-positions">
                    {(positions ?? []).map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <span className="block text-[11px] text-gray-400">
                    This staff member will appear in the Personnel logbook after registering.
                  </span>
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-700">
                  Program / Division <span className="text-gray-400">(optional)</span>
                </span>
                <input
                  type="text"
                  value={manualProgram}
                  onChange={(e) => setManualProgram(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. ICT Division"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
            </div>
          )}

          {selected && selectedReg && (
            <p className="text-xs text-gray-600">
              Already has {selectedReg.sample_count} sample(s) on record. Adding
              a new photo will refine the embedding (weighted average).
            </p>
          )}

          {selected && !selectedReg && (
            <p className="text-xs text-gray-500">
              {selected.source === "account" ? "Personnel record" : "System user"}
              {" · first enrollment."}
            </p>
          )}

          {/* Photo capture / upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseCamera((v) => !v)}
                disabled={submitting || capturing}
                className={
                  "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors " +
                  (useCamera
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 hover:bg-gray-50")
                }
              >
                <CameraIcon className="w-4 h-4" />
                {useCamera ? "Hide Camera" : "Use Camera"}
              </button>
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={submitting || capturing}
                  onChange={onFileSelected}
                />
                Upload File
              </label>
              {/* Small chip replaces the old big thumbnail preview. */}
              {photoBlob && !useCamera && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded-full max-w-[14rem] truncate">
                  <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                  <span className="truncate">{photoName || "Photo attached"}</span>
                  <button
                    type="button"
                    onClick={() => { setPhotoBlob(null); setPhotoName(""); }}
                    className="opacity-60 hover:opacity-100 ml-0.5"
                    aria-label="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            {/* Camera viewport — training-mode burst capture. No preview is
                shown of the individual frames because the server combines
                them into one averaged embedding; showing 5 thumbnails would
                imply they're separate records, which isn't true. */}
            {useCamera && (
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Idle state: big centered "I'm ready" button. */}
                {!capturing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/10 via-transparent to-black/40">
                    <button
                      type="button"
                      onClick={burstCapture}
                      disabled={submitting || serverStatus === "offline"}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-900/30 ring-4 ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition-transform hover:scale-105"
                    >
                      <Sparkles className="w-5 h-5" />
                      I&apos;m Ready — Capture {BURST_SHOTS} Training Shots
                    </button>
                    <p className="mt-3 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-xs text-white/90 text-center">
                      Look at the camera. Slight head movements between shots help.
                    </p>
                  </div>
                )}

                {/* Burst state: progress overlay + flashing indicator. */}
                {capturing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]">
                    <Loader2 className="w-10 h-10 animate-spin text-white mb-3" />
                    <p className="text-white font-semibold text-lg">
                      Capturing {captureStep} of {BURST_SHOTS}
                    </p>
                    <p className="text-white/80 text-xs mt-1">Hold still — training the model…</p>
                    <div className="flex gap-1.5 mt-3">
                      {Array.from({ length: BURST_SHOTS }).map((_, i) => (
                        <span
                          key={i}
                          className={
                            "w-2 h-2 rounded-full " +
                            (i < captureStep
                              ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]"
                              : "bg-white/30")
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File-upload submit button. Hidden entirely in camera mode because
              the burst flow handles submission from inside the viewport. */}
          {!useCamera && (
            <button
              type="button"
              disabled={
                !photoBlob ||
                submitting ||
                (!isManual && !selected) ||
                (isManual && manualName.trim().length === 0) ||
                (isManual && manualRole === "readonly" && manualPosition.trim().length === 0)
              }
              onClick={submit}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Register Face
                </>
              )}
            </button>
          )}

          <p className="text-xs text-gray-500">
            {useCamera
              ? `The burst captures ${BURST_SHOTS} frames and trains one averaged embedding per person. The kiosk picks up new faces on its next recognition poll — usually within a second.`
              : "Photos should be well-lit, with one face centred and looking toward the camera. Multiple photos of the same person refine the model."}
          </p>
        </section>

        {/* Right: registered list */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Registered Faces</h2>
            <span className="text-xs text-gray-500">
              {registered === null
                ? "Loading…"
                : `${registered.length} on file`}
            </span>
          </header>
          <div className="p-4">
            {registered === null ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : registered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No faces registered yet. Enroll the first person on the left.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {registered.map((r) => (
                  <li
                    key={r.user_id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.role}
                        {r.program ? ` · ${r.program}` : ""}
                        {" · "}
                        {r.sample_count} sample{r.sample_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Staff attendance follow-ups — registered staff with their live status
          today; expand a row to see their recent time-in / time-out history. */}
      <StaffFollowUps />
    </div>
  );
}

// ─── Staff follow-ups (attendance history) ───────────────────────────
type StaffPerson = {
  _id: Id<"personnel">;
  firstName: string;
  lastName: string;
  position: string;
  division: string;
  status: "present" | "traveling" | "absent";
  lastEventAt: string | null;
};

const STATUS_PILL: Record<StaffPerson["status"], string> = {
  present:   "bg-green-100 text-green-800 border-green-200",
  traveling: "bg-blue-100 text-blue-800 border-blue-200",
  absent:    "bg-gray-100 text-gray-600 border-gray-200",
};
const STATUS_LABEL: Record<StaffPerson["status"], string> = {
  present: "Present", traveling: "Traveling / Out", absent: "Absent",
};

function StaffFollowUps() {
  const staff = useQuery(api.personnel.listWithStatus, { isActive: true }) as
    | StaffPerson[] | undefined;
  const [openId, setOpenId] = useState<Id<"personnel"> | null>(null);

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Staff Attendance Follow-ups</h2>
        <span className="text-xs text-gray-500">
          {staff === undefined ? "Loading…" : `${staff.length} staff`}
        </span>
      </header>
      <div className="p-2 sm:p-3">
        {staff === undefined ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            No staff yet. Register one on the left with Role = Staff.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {staff.map((p) => (
              <StaffFollowUpRow
                key={p._id}
                person={p}
                open={openId === p._id}
                onToggle={() => setOpenId(openId === p._id ? null : p._id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type HistoryEvent = {
  _id: string;
  action: "time_in" | "time_out";
  timestamp: string;
  date: string;
  confidence: number;
  cameraId: string;
};

function StaffFollowUpRow({
  person, open, onToggle,
}: { person: StaffPerson; open: boolean; onToggle: () => void }) {
  // Only fetch history when this row is expanded.
  const history = useQuery(
    api.personnel.attendanceHistory,
    open ? { id: person._id, limit: 20 } : "skip",
  ) as HistoryEvent[] | undefined;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-2 px-1 text-left hover:bg-gray-50 rounded-lg"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {person.firstName} {person.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">{person.position} · {person.division}</p>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_PILL[person.status]}`}>
          {STATUS_LABEL[person.status]}
        </span>
      </button>

      {open && (
        <div className="ml-6 mb-2 mr-1 rounded-lg border border-gray-100 bg-gray-50/60 p-2">
          {history === undefined ? (
            <p className="text-xs text-gray-400 px-1 py-2">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 px-1 py-2">No recognized events in the last 60 days.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((e) => (
                <li key={e._id} className="flex items-center gap-2 text-xs text-gray-600">
                  {e.action === "time_in"
                    ? <LogIn className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    : <LogOut className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  <span className="font-medium text-gray-800">
                    {e.action === "time_in" ? "Time in" : "Time out"}
                  </span>
                  <Clock className="w-3 h-3 text-gray-300" />
                  <span>{formatEventTime(e.timestamp)}</span>
                  <span className="ml-auto text-gray-400">{Math.round(e.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
