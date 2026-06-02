"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";

// ── Types ─────────────────────────────────────────────────────────
type FaceResult = {
  recognized:     boolean;
  userId?:        string;
  name:           string;
  role?:          string;
  program?:       string;
  confidence?:    number;
  action?:        "time_in" | "time_out";
  bbox:           [number, number, number, number];
  detectionScore: number;
  onCooldown?:    boolean;
};

type GreetingState = {
  visible:    boolean;
  userId:     string;
  name:       string;
  role:       string;
  program:    string;
  action:     "time_in" | "time_out";
  status:     "present" | "out";
  detail:     string;       // "Position · Division" (personnel) or program
  photoSaved: boolean;
  time:       string;
  initials:   string;
};

type Layout = "landscape" | "portrait";

type RoleConf = {
  label:  string;
  hex:    string;          // primary
  soft:   string;          // soft tint background
  border: string;          // border tint
  glow:   string;          // shadow glow
};

// ── Role config (softer palette than spec) ────────────────────────
const ROLES: Record<string, RoleConf> = {
  admin:       { label: "Administrator", hex: "#FFC857", soft: "rgba(255,200,87,0.10)", border: "rgba(255,200,87,0.40)", glow: "rgba(255,200,87,0.45)"  },
  supervisor:  { label: "Supervisor",    hex: "#B79CFF", soft: "rgba(183,156,255,0.10)", border: "rgba(183,156,255,0.40)", glow: "rgba(183,156,255,0.45)" },
  mentor:      { label: "Mentor",        hex: "#7BB7FF", soft: "rgba(123,183,255,0.10)", border: "rgba(123,183,255,0.40)", glow: "rgba(123,183,255,0.45)" },
  intern:      { label: "Intern",        hex: "#5DD3A8", soft: "rgba(93,211,168,0.10)",  border: "rgba(93,211,168,0.40)",  glow: "rgba(93,211,168,0.45)"  },
  student:     { label: "Student",       hex: "#5DD3A8", soft: "rgba(93,211,168,0.10)",  border: "rgba(93,211,168,0.40)",  glow: "rgba(93,211,168,0.45)"  },
  readonly:    { label: "Staff",         hex: "#9FB1CC", soft: "rgba(159,177,204,0.10)", border: "rgba(159,177,204,0.30)", glow: "rgba(159,177,204,0.30)" },
  org_partner: { label: "Partner",       hex: "#F49AC2", soft: "rgba(244,154,194,0.10)", border: "rgba(244,154,194,0.40)", glow: "rgba(244,154,194,0.45)" },
};

const DEFAULT_ROLE: RoleConf = ROLES.readonly;
const ACCENT = "#7BD0FF"; // Calm sky-blue brand accent.

// ── Helpers ───────────────────────────────────────────────────────
function tod(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function buildGreeting(
  name: string,
  status: "present" | "out" = "present",
): { title: string; subtitle: string } {
  const first = name.split(" ")[0] ?? name;
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const title = `${greeting}, ${first}!`;
  const subtitle = status === "out"
    ? "You're timed out for today. Thank you — see you next time!"
    : "You're marked present. Have a productive day ahead!";
  return { title, subtitle };
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang   = "en-PH";
  u.rate   = 0.95;
  u.pitch  = 1.05;
  u.volume = 1.0;
  const vs = window.speechSynthesis.getVoices();
  const best =
    vs.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ??
    vs.find((v) => v.lang.startsWith("en"));
  if (best) u.voice = best;
  window.speechSynthesis.speak(u);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("");
}

// ── Component ─────────────────────────────────────────────────────
export default function KioskPage() {
  // DOM refs
  const videoRef   = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // Connection / timer refs
  const wsRef          = useRef<WebSocket | null>(null);
  const frameRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnDelay    = useRef(1000);
  const reconnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGreetRef    = useRef<Record<string, number>>({});
  const lastPresenceRef = useRef<Record<string, number>>({});
  const recogRef       = useRef<{ stop: () => void; start: () => void } | null>(null);
  const voiceActiveRef = useRef(false);

  // State
  const [layout,       setLayout]       = useState<Layout>("landscape");
  const [wsStatus,     setWsStatus]     = useState<"connecting" | "ready" | "error">("connecting");
  const [faces,        setFaces]        = useState<FaceResult[]>([]);
  const [recentFaces,  setRecentFaces]  = useState<FaceResult[]>([]);
  const [greeting,     setGreeting]     = useState<GreetingState | null>(null);
  const [greetLeaving, setGreetLeaving] = useState(false);
  const [clock,        setClock]        = useState({ hh: "--", mm: "--", ss: "--" });
  const [dateStr,      setDateStr]      = useState("");
  const [voiceOn,      setVoiceOn]      = useState(false);
  const [voiceCaption, setVoiceCaption] = useState("");
  const [presentCount, setPresentCount] = useState(0);
  const [scanning,     setScanning]     = useState(false);

  // Convex client for imperative, event-driven reads/writes from the WS handler.
  const convex = useConvex();

  // ── WebSocket URL — picks ws/wss based on page scheme ───────────
  const WS_URL = (
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_FACE_SERVER_WS
          ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8001/ws/camera`)
      : "ws://localhost:8001/ws/camera"
  ).replace(/^http/, "ws");

  // ── Layout (landscape vs portrait) ──────────────────────────────
  useEffect(() => {
    const check = () =>
      setLayout(window.innerWidth >= window.innerHeight ? "landscape" : "portrait");
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Clock ───────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock({
        hh: String(now.getHours()).padStart(2, "0"),
        mm: String(now.getMinutes()).padStart(2, "0"),
        ss: String(now.getSeconds()).padStart(2, "0"),
      });
      setDateStr(now.toLocaleDateString("en-PH", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Wake lock ───────────────────────────────────────────────────
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      const wl = (navigator as unknown as {
        wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (!wl) return;
      try { lock = await wl.request("screen"); } catch { /* ignore */ }
    };
    acquire();
    const onVis = () => { if (!document.hidden) acquire(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  // ── Camera ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setWsStatus("error");
    }
  }, []);

  // ── Draw overlays on video ──────────────────────────────────────
  const drawFaces = useCallback((faceList: FaceResult[]) => {
    const v = videoRef.current;
    const c = overlayRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    c.width  = v.clientWidth;
    c.height = v.clientHeight;

    const sx = v.clientWidth  / (v.videoWidth  || 1280);
    const sy = v.clientHeight / (v.videoHeight || 720);

    ctx.clearRect(0, 0, c.width, c.height);

    for (const face of faceList) {
      const [rx1, ry1, rx2, ry2] = face.bbox;
      // Mirror x to match the CSS-mirrored video.
      const x1 = c.width - rx2 * sx;
      const y1 = ry1 * sy;
      const w  = (rx2 - rx1) * sx;
      const h  = (ry2 - ry1) * sy;

      const role  = ROLES[face.role ?? ""] ?? DEFAULT_ROLE;
      const color = face.recognized
        ? (face.onCooldown ? "#7B8AA0" : role.hex)
        : "#FF6B6B";
      const glow  = face.recognized
        ? (face.onCooldown ? "rgba(123,138,160,0.3)" : role.glow)
        : "rgba(255,107,107,0.4)";

      // Corner-bracket markers.
      const arm = Math.min(w, h) * 0.18;
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur  = 14;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = "round";
      const pts: [number, number, number, number, number, number][] = [
        [x1,           y1 + arm,     x1,     y1,     x1 + arm,     y1      ],
        [x1 + w - arm, y1,           x1 + w, y1,     x1 + w,       y1 + arm],
        [x1,           y1 + h - arm, x1,     y1 + h, x1 + arm,     y1 + h  ],
        [x1 + w - arm, y1 + h,       x1 + w, y1 + h, x1 + w,       y1 + h - arm],
      ];
      for (const [ax, ay, bx, by, cx, cy] of pts) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      ctx.restore();

      if (face.recognized) {
        // Confidence pill below bbox.
        const pct = Math.round((face.confidence ?? 0) * 100);
        const label = `${pct}% match`;
        ctx.save();
        ctx.font = "600 11px 'Sora', sans-serif";
        const lw = ctx.measureText(label).width + 16;
        const lh = 20;
        const lx = x1 + (w / 2) - (lw / 2);
        const ly = y1 + h + 8;
        ctx.fillStyle   = "rgba(10,16,36,0.85)";
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(label, lx + 8, ly + 14);
        ctx.restore();

        // Time in / time out badge above bbox.
        if (!face.onCooldown && face.action) {
          const badge = face.action === "time_in" ? "TIME IN" : "TIME OUT";
          const bc    = face.action === "time_in" ? "#5DD3A8" : "#7BB7FF";
          ctx.save();
          ctx.font = "700 10px 'Sora', sans-serif";
          const bw = ctx.measureText(badge).width + 16;
          const bh = 20;
          const bx = x1 + (w / 2) - (bw / 2);
          const by = y1 - bh - 6;
          ctx.fillStyle = `${bc}33`;
          ctx.strokeStyle = bc;
          ctx.lineWidth   = 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = bc;
          ctx.fillText(badge, bx + 8, by + 14);
          ctx.restore();
        }
      }
    }
  }, []);

  // ── Greeting ────────────────────────────────────────────────────
  const showGreeting = useCallback((face: FaceResult) => {
    if (!face.name) return;
    const time = new Date().toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const status: "present" | "out" = face.action === "time_out" ? "out" : "present";
    setGreetLeaving(false);
    setGreeting({
      visible:    true,
      userId:     face.userId ?? face.name,
      name:       face.name,
      role:       face.role ?? "readonly",
      program:    face.program ?? "",
      action:     face.action ?? "time_in",
      status,
      detail:     face.program ?? "",
      photoSaved: false,
      time,
      initials:   initials(face.name),
    });
    speak(buildGreeting(face.name, status).title);

    if (greetTimer.current)     clearTimeout(greetTimer.current);
    if (greetExitTimer.current) clearTimeout(greetExitTimer.current);
    // After 4.5 s, start the exit animation; remove from DOM 600 ms later.
    greetTimer.current = setTimeout(() => {
      setGreetLeaving(true);
      greetExitTimer.current = setTimeout(() => {
        setGreeting(null);
        setGreetLeaving(false);
      }, 600);
    }, 4500);
  }, []);

  // ── Capture a still JPEG from the live capture canvas (for photo upload) ──
  const captureStill = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const v = videoRef.current;
      const c = captureRef.current;
      if (!v || !c || !v.videoWidth) { resolve(null); return; }
      const ctx = c.getContext("2d");
      if (!ctx) { resolve(null); return; }
      c.width  = v.videoWidth;
      c.height = v.videoHeight;
      // Mirror to match the selfie-style display.
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(v, -c.width, 0);
      ctx.restore();
      c.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }, []);

  // ── Record presence in Convex + auto-fill personnel photo if missing ──
  //    Fired once per person per 30s (gated by the WS handler). All failures
  //    are swallowed so the live overlay is never affected.
  const recordPresence = useCallback(async (face: FaceResult) => {
    if (!face.userId) return;
    try {
      // 1) Mark present (idempotent). Reflect the real status in the greeting.
      const res = await convex.mutation(api.face_recognition.markPresence, {
        userId:     face.userId,
        name:       face.name,
        confidence: face.confidence,
        cameraId:   "kiosk",
        timestamp:  new Date().toISOString(),
      });
      const status: "present" | "out" = res.status;
      const action: "time_in" | "time_out" =
        res.action ?? (status === "out" ? "time_out" : "time_in");

      // 2) Is this a personnel record? Enrich greeting + maybe save a photo.
      const info = await convex.query(api.personnel.personnelPhotoStatus, {
        userId: face.userId,
      });

      let detail = face.program ?? "";
      let photoSaved = false;

      if (info.isPersonnel) {
        detail = info.position
          ? `${info.position}${info.division ? ` · ${info.division}` : ""}`
          : detail;

        if (!info.hasPhoto) {
          const blob = await captureStill();
          if (blob) {
            const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});
            const up = await fetch(uploadUrl, {
              method:  "POST",
              headers: { "Content-Type": blob.type || "image/jpeg" },
              body:    blob,
            });
            if (up.ok) {
              const { storageId } = await up.json();
              const saved = await convex.mutation(api.personnel.setPhotoIfMissing, {
                userId: face.userId, storageId,
              });
              photoSaved = saved.updated;
            }
          }
        }
      }

      // 3) Patch the greeting in place (only if it's still this person's).
      setGreeting((prev) =>
        prev && prev.userId === face.userId
          ? { ...prev, status, action, detail, photoSaved }
          : prev,
      );
    } catch {
      /* network / Convex hiccup — never break the kiosk display */
    }
  }, [convex, captureStill]);

  // ── WebSocket ───────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let ws: WebSocket;
    try { ws = new WebSocket(WS_URL); }
    catch { setWsStatus("error"); return; }

    ws.onopen = () => {
      reconnDelay.current = 1000;
      ws.send(JSON.stringify({ type: "init", cameraId: "kiosk" }));
    };

    ws.onmessage = (evt) => {
      let msg: { type: string; faces?: unknown };
      try { msg = JSON.parse(evt.data as string); }
      catch { return; }

      if (msg.type === "ready") setWsStatus("ready");

      if (msg.type === "result" && Array.isArray(msg.faces)) {
        const results = msg.faces as FaceResult[];
        setFaces(results);
        drawFaces(results);
        setScanning(results.length > 0 && !results.some((r) => r.recognized));

        // Maintain a small "recent" list — last 5 distinct recognized people.
        if (results.some((r) => r.recognized)) {
          setRecentFaces((prev) => {
            const next = [...results.filter((r) => r.recognized), ...prev];
            const seen = new Set<string>();
            const dedup: FaceResult[] = [];
            for (const f of next) {
              const key = f.userId ?? f.name;
              if (!seen.has(key)) { seen.add(key); dedup.push(f); }
              if (dedup.length >= 5) break;
            }
            return dedup;
          });
        }

        // Mark EVERY recognized person present in Convex — independent of the
        // greeting cooldown, so being seen at the kiosk always reflects on the
        // Personnel page even when the face server has them on greet-cooldown.
        // Throttled to once per person per 60s; markPresence is idempotent.
        for (const f of results) {
          if (!f.recognized || !f.userId) continue;
          const now   = Date.now();
          const lastP = lastPresenceRef.current[f.userId] ?? 0;
          if (now - lastP > 60_000) {
            lastPresenceRef.current[f.userId] = now;
            void recordPresence(f); // mark present in Convex + auto-photo
          }
        }

        // Trigger the on-screen greeting for the first recognized,
        // non-cooldown face (separate from presence recording above).
        for (const f of results) {
          if (f.recognized && !f.onCooldown && f.userId) {
            const now  = Date.now();
            const last = lastGreetRef.current[f.userId] ?? 0;
            if (now - last > 30_000) {
              lastGreetRef.current[f.userId] = now;
              showGreeting(f);
              break;
            }
          }
        }
      }
    };

    ws.onclose = () => {
      setWsStatus("connecting");
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      reconnTimer.current = setTimeout(() => {
        reconnDelay.current = Math.min(reconnDelay.current * 2, 30_000);
        connectWS();
      }, reconnDelay.current);
    };

    ws.onerror = () => setWsStatus("error");
    wsRef.current = ws;
  }, [WS_URL, drawFaces, showGreeting, recordPresence]);

  // ── Frame capture ───────────────────────────────────────────────
  const sendFrame = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (document.visibilityState === "hidden") return;
    const v = videoRef.current;
    const c = captureRef.current;
    if (!v || !c || !v.videoWidth) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width  = v.videoWidth;
    c.height = v.videoHeight;
    // Mirror the capture so server-side bboxes match the visible mirrored feed.
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(v, -c.width, 0);
    ctx.restore();
    const b64 = c.toDataURL("image/jpeg", 0.72).split(",")[1];
    if (b64) {
      try { wsRef.current.send(JSON.stringify({ type: "frame", data: b64 })); }
      catch { /* socket may have closed */ }
    }
  }, []);

  // ── Voice commands ──────────────────────────────────────────────
  const handleCmd = useCallback((cmd: string) => {
    setVoiceCaption(`"${cmd}"`);
    setTimeout(() => setVoiceCaption(""), 3000);

    if (cmd.includes("time") || cmd.includes("oras")) {
      speak(`It is ${new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true })}.`);
    } else if (cmd.includes("how many") || cmd.includes("ilan")) {
      speak(`${presentCount} people are present today.`);
    } else if (cmd.includes("who") || cmd.includes("sino")) {
      const n = faces.filter((f) => f.recognized).map((f) => f.name);
      speak(n.length ? `I see: ${n.join(", ")}.` : "No one recognized in frame.");
    } else if (cmd.includes("hello") || cmd.includes("hi") || cmd.includes("kumusta")) {
      speak("Hello! Welcome to DICT Region V.");
    } else if (cmd.includes("good morning") || cmd.includes("magandang umaga")) {
      speak("Good morning! Have a productive day.");
    } else if (cmd.includes("good afternoon") || cmd.includes("magandang hapon")) {
      speak("Good afternoon! Welcome.");
    }
  }, [faces, presentCount]);

  const startVoice = useCallback(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;

    const recog = new (SR as unknown as new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
      onend:    () => void;
      start:    () => void;
      stop:     () => void;
    })();

    recog.lang           = "en-PH";
    recog.continuous     = true;
    recog.interimResults = false;
    recog.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      handleCmd(last[0].transcript.toLowerCase().trim());
    };
    recog.onend = () => {
      if (voiceActiveRef.current) {
        try { recog.start(); } catch { /* ignore */ }
      }
    };

    try { recog.start(); } catch { /* ignore */ }
    recogRef.current       = recog;
    voiceActiveRef.current = true;
    setVoiceOn(true);
  }, [handleCmd]);

  const stopVoice = useCallback(() => {
    voiceActiveRef.current = false;
    recogRef.current?.stop();
    recogRef.current = null;
    setVoiceOn(false);
  }, []);

  // ── Present count (polls face server) ──────────────────────────
  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_FACE_SERVER_HTTP ??
      process.env.NEXT_PUBLIC_FACE_SERVER_URL ??
      (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:8001`
        : "http://localhost:8001");
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${base}/api/attendance/today`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Array<{ action: string }>;
        if (cancelled) return;
        setPresentCount(d.filter((x) => x.action === "time_in").length);
      } catch { /* server down */ }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ── Mount / unmount ─────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    connectWS();
    frameRef.current = setInterval(sendFrame, 500);
    return () => {
      if (frameRef.current)     clearInterval(frameRef.current);
      if (greetTimer.current)   clearTimeout(greetTimer.current);
      if (greetExitTimer.current) clearTimeout(greetExitTimer.current);
      if (reconnTimer.current)  clearTimeout(reconnTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      voiceActiveRef.current = false;
      recogRef.current?.stop();
      recogRef.current = null;
      const s = videoRef.current?.srcObject as MediaStream | null;
      s?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  const detectedNow      = faces.filter((f) => f.recognized);
  const recognizedActive = detectedNow[0];
  const greetRole        = greeting ? (ROLES[greeting.role] ?? DEFAULT_ROLE) : DEFAULT_ROLE;
  const liveRole         = recognizedActive
    ? (ROLES[recognizedActive.role ?? ""] ?? DEFAULT_ROLE)
    : null;

  const isLandscape = layout === "landscape";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        :root {
          --k-bg:       #050810;
          --k-bg-2:     #090d1a;
          --k-panel:    rgba(10,16,36,0.72);
          --k-border:   rgba(80,140,255,0.14);
          --k-text:     #e8eeff;
          --k-muted:    rgba(180,200,255,0.55);
          --k-muted-2:  rgba(150,170,220,0.40);
          --k-accent:   ${ACCENT};
        }

        @keyframes k-pulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(1.7); opacity: 0;   }
          100% { transform: scale(1.7); opacity: 0;   }
        }
        @keyframes k-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.25; }
        }
        @keyframes k-slide-up {
          from { transform: translateY(40px) scale(0.96); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes k-greet-in {
          from { transform: translateY(60px) scale(0.94); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes k-greet-out {
          from { transform: translateY(0)    scale(1);    opacity: 1; }
          to   { transform: translateY(-30px) scale(0.97); opacity: 0; }
        }
        @keyframes k-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes k-fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes k-scan {
          0%   { top: 5%;  opacity: 0; }
          10%  { opacity: 0.9; }
          50%  { top: 90%; opacity: 0.9; }
          60%  { opacity: 0; }
          100% { top: 5%;  opacity: 0; }
        }
        @keyframes k-bracket-pulse {
          0%, 100% { opacity: 1;   }
          50%      { opacity: 0.5; }
        }

        .k-scanlines::after {
          /* Extremely subtle scanline hint — near-invisible unless you look
             for it. Keeps the screen from feeling totally sterile without
             being irritating. */
          content: '';
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(123, 208, 255, 0.010) 3px,
            rgba(123, 208, 255, 0.010) 5px
          );
        }

        /* Floating mic widget — caption pill hides until hover. */
        .k-mic-widget {
          position: fixed;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 0;
        }
        .k-mic-caption {
          max-width: 0;
          overflow: hidden;
          opacity: 0;
          margin-right: -8px;
          padding: 0;
          background: rgba(10, 16, 36, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--k-border);
          border-right: none;
          border-radius: 24px 0 0 24px;
          font-family: 'Sora', sans-serif;
          font-size: 12px;
          color: var(--k-text);
          white-space: nowrap;
          transition:
            max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
            opacity   0.25s ease,
            padding   0.35s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }
        .k-mic-widget:hover .k-mic-caption,
        .k-mic-widget.k-mic-widget--active .k-mic-caption,
        .k-mic-widget.k-mic-widget--caption .k-mic-caption {
          max-width: 280px;
          opacity: 1;
          padding: 10px 20px 10px 18px;
          margin-right: -12px;
          pointer-events: auto;
        }

        .k-vignette::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.55) 100%);
        }

        .k-greet-card  { animation: k-greet-in  0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .k-greet-card-out { animation: k-greet-out 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .k-greet-bg-in  { animation: k-fade-in  0.3s ease forwards; }
        .k-greet-bg-out { animation: k-fade-out 0.5s ease forwards; }

        .k-pulse-ring {
          position: relative;
          flex-shrink: 0;
        }
        .k-pulse-ring::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: currentColor;
          opacity: 0;
          animation: k-pulse 1.6s ease-out infinite;
        }

        .k-frosted {
          background: var(--k-panel);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--k-border);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,10,0.55), inset 0 1px 0 rgba(255,255,255,0.04);
        }
      `}</style>

      <div
        className="k-scanlines"
        style={{
          position:   "fixed",
          inset:      0,
          zIndex:     9999,
          overflow:   "hidden",
          background: "radial-gradient(ellipse at top left, #0d1428 0%, var(--k-bg) 55%)",
          color:      "var(--k-text)",
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {/* ── PAGE GRID ──────────────────────────────────────── */}
        <div
          style={{
            // Portrait gets a `1fr` row so the camera panel claims all
            // leftover height instead of collapsing to content size.
            display:             "grid",
            gridTemplateRows:    isLandscape ? "auto 1fr auto" : "auto 1fr auto auto",
            gridTemplateColumns: isLandscape ? "1fr 320px"     : "1fr",
            gap:                 isLandscape ? 16 : 10,
            padding:             isLandscape ? 20 : 12,
            height:              "100%",
            width:               "100%",
            minHeight:           0,
          }}
        >
          {/* ── HEADER ──────────────────────────────────────── */}
          <header
            style={{
              gridColumn:     isLandscape ? "1 / -1" : "1",
              gridRow:        "1",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              gap:            16,
              flexWrap:       "wrap",
            }}
          >
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <div
                style={{
                  width:          44,
                  height:         44,
                  borderRadius:   12,
                  border:         `1.5px solid ${ACCENT}55`,
                  background:     `linear-gradient(135deg, ${ACCENT}26, transparent)`,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  boxShadow:      `0 0 22px ${ACCENT}33`,
                  flexShrink:     0,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      isLandscape ? 16 : 14,
                    fontWeight:    700,
                    color:         "#fff",
                    letterSpacing: "0.04em",
                    whiteSpace:    "nowrap",
                  }}
                >
                  DICT Region V
                </div>
                <div style={{ fontSize: 11, color: "var(--k-muted)", marginTop: 2 }}>
                  Bicol Region · Attendance Kiosk
                </div>
              </div>
            </div>

            {/* Clock */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize:   isLandscape ? 38 : 28,
                  fontWeight: 800,
                  background: `linear-gradient(135deg, #fff 60%, ${ACCENT})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor:  "transparent",
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                }}
              >
                {clock.hh}
                <span style={{
                  display: "inline-block",
                  WebkitTextFillColor: ACCENT,
                  animation: "k-blink 1s step-start infinite",
                }}>:</span>
                {clock.mm}
                <span style={{
                  fontSize: isLandscape ? 22 : 16,
                  verticalAlign: "super",
                  opacity: 0.45,
                  marginLeft: 4,
                }}>:{clock.ss}</span>
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--k-muted)",
                marginTop: 4,
                letterSpacing: "0.02em",
              }}>
                {dateStr}
              </div>
            </div>

            {/* Status */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              flexShrink: 0,
            }}>
              <StatusRow
                label={
                  wsStatus === "ready"      ? "Live Sync" :
                  wsStatus === "connecting" ? "Connecting…"
                                            : "Connection Error"
                }
                color={
                  wsStatus === "ready"      ? "#5DD3A8" :
                  wsStatus === "connecting" ? "#FFC857"
                                            : "#FF6B6B"
                }
                active={wsStatus === "ready"}
              />
              {recognizedActive && liveRole && (
                <StatusRow
                  label={recognizedActive.name}
                  color={liveRole.hex}
                  active
                  small
                />
              )}
            </div>
          </header>

          {/* ── MAIN (camera + detection bar) ───────────────── */}
          <main
            style={{
              minHeight:      0,
              minWidth:       0,
              display:        "flex",
              flexDirection:  "column",
              gap:            isLandscape ? 12 : 10,
              gridColumn:     "1",
              gridRow:        "2",
            }}
          >
            <div
              className="k-frosted k-vignette"
              style={{
                flex:      1,
                padding:   isLandscape ? 16 : 12,
                display:   "flex",
                flexDirection: "column",
                gap:       10,
                // Floor so the camera never collapses below something usable
                // even on stubby short popups; in portrait we want it tall.
                minHeight: isLandscape ? 0 : 320,
                position:  "relative",
                ...(liveRole && {
                  borderColor: liveRole.border,
                  boxShadow:   `0 0 30px ${liveRole.glow}33, inset 0 1px 0 rgba(255,255,255,0.04)`,
                }),
              }}
            >

              {/* Camera viewport */}
              <div
                style={{
                  position:     "relative",
                  flex:         1,
                  minHeight:    0,
                  borderRadius: 12,
                  overflow:     "hidden",
                  background:   "#020409",
                  border:       "1px solid rgba(80,140,255,0.10)",
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width:     "100%",
                    height:    "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    display:   "block",
                  }}
                />
                <canvas
                  ref={overlayRef}
                  style={{
                    position:      "absolute",
                    inset:         0,
                    width:         "100%",
                    height:        "100%",
                    pointerEvents: "none",
                  }}
                />

                {/* Unobtrusive subtle status dot in the top-left of the camera —
                    replaces the old verbose "MONITORING / SCANNING…" label row. */}
                <div
                  style={{
                    position:     "absolute",
                    top:          12,
                    left:         12,
                    display:      "flex",
                    alignItems:   "center",
                    gap:          6,
                    padding:      "4px 10px",
                    background:   "rgba(5, 8, 16, 0.55)",
                    backdropFilter:"blur(8px)",
                    border:       "1px solid rgba(80,140,255,0.18)",
                    borderRadius: 999,
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: "50%",
                      background:   recognizedActive
                                      ? (liveRole?.hex ?? ACCENT)
                                      : (scanning ? "#FFC857" : "#5DD3A8"),
                      boxShadow:    `0 0 6px ${recognizedActive
                                      ? (liveRole?.hex ?? ACCENT)
                                      : (scanning ? "#FFC857" : "#5DD3A8")}`,
                    }}
                  />
                  <span style={{
                    fontSize:      9,
                    fontWeight:    600,
                    color:         "var(--k-muted)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}>
                    {recognizedActive ? "Confirmed" : scanning ? "Scanning" : "Live"}
                  </span>
                </div>
              </div>

              {/* Detection status bar */}
              <DetectionBar face={recognizedActive} role={liveRole} scanning={scanning} />
            </div>

            {/* Stats — compact in portrait so the camera dominates. */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: isLandscape ? 12 : 8,
              flexShrink: 0,
            }}>
              <StatCard label="Present today" value={presentCount}       color="#5DD3A8" icon="✓" compact={!isLandscape} />
              <StatCard label="In frame"      value={detectedNow.length} color={ACCENT}  icon="◉" compact={!isLandscape} />
            </div>
          </main>

          {/* ── SIDEBAR ──────────────────────────────────────────
              Landscape: vertical column on the right (Recent fills, Voice pinned bottom).
              Portrait : compact horizontal strip below the camera so the camera
                         stays the hero — Recent becomes a horizontally-scrolling
                         pill rail, Voice is a tight inline button. */}
          <aside
            style={{
              minHeight:     0,
              minWidth:      0,
              display:       "flex",
              flexDirection: isLandscape ? "column" : "row",
              gap:           isLandscape ? 12 : 10,
              gridColumn:    isLandscape ? "2" : "1",
              gridRow:       isLandscape ? "2" : "3",
              alignItems:    isLandscape ? "stretch" : "stretch",
            }}
          >
            {/* Recent detections */}
            <div
              className="k-frosted"
              style={{
                padding:       isLandscape ? 16 : "10px 12px",
                display:       "flex",
                flexDirection: "column",
                gap:           isLandscape ? 10 : 6,
                flex:          1,
                minHeight:     0,
                minWidth:      0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pulse color={ACCENT} small />
                <span style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      10,
                  color:         "var(--k-muted)",
                  fontWeight:    700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}>
                  Recent
                </span>
              </div>

              {/* In landscape: vertical scrolling list of full-width PersonCards.
                  In portrait : horizontal scroll of compact pills. */}
              {isLandscape ? (
                <div style={{
                  display:       "flex",
                  flexDirection: "column",
                  gap:           8,
                  overflowY:     "auto",
                  flex:          1,
                  minHeight:     0,
                }}>
                  {recentFaces.length === 0 ? (
                    <EmptyRecent />
                  ) : (
                    recentFaces.map((f, i) => (
                      <PersonCard key={(f.userId ?? f.name) + i} face={f} delay={i * 60} />
                    ))
                  )}
                </div>
              ) : (
                <div style={{
                  display:    "flex",
                  flexDirection: "row",
                  gap:        8,
                  overflowX:  "auto",
                  overflowY:  "hidden",
                  alignItems: "center",
                  minHeight:  46,
                }}>
                  {recentFaces.length === 0 ? (
                    <EmptyRecent compact />
                  ) : (
                    recentFaces.map((f, i) => (
                      <PersonPill key={(f.userId ?? f.name) + i} face={f} delay={i * 50} />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Voice control moved out of the sidebar — see <MicWidget /> below.
                Keeping the sidebar focused purely on "who was here recently"
                makes the whole right column read as a single clean idea. */}
          </aside>

          {/* ── FOOTER ──────────────────────────────────────── */}
          <footer
            style={{
              gridColumn:     isLandscape ? "1 / -1" : "1",
              gridRow:        isLandscape ? "3" : "4",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              gap:            12,
              flexWrap:       "wrap",
              fontSize:       10,
              color:          "var(--k-muted-2)",
              letterSpacing:  "0.04em",
            }}
          >
            <span>DICT Region V · Bicol · Kiosk-01</span>
            <span>Privacy compliant · Data encrypted</span>
          </footer>
        </div>

        {/* ── GREETING OVERLAY ──────────────────────────────── */}
        {greeting?.visible && (
          <div
            className={greetLeaving ? "k-greet-bg-out" : "k-greet-bg-in"}
            style={{
              position:       "fixed",
              inset:          0,
              zIndex:         50,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "rgba(2,4,12,0.86)",
              backdropFilter: "blur(14px)",
              padding:        20,
            }}
          >
            <div
              className={greetLeaving ? "k-greet-card-out" : "k-greet-card"}
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                gap:            isLandscape ? 22 : 16,
                padding:        isLandscape ? "44px 56px" : "32px 28px",
                background:     "rgba(11,15,28,0.95)",
                border:         `1px solid ${greetRole.border}`,
                borderRadius:   24,
                boxShadow:      `0 0 60px ${greetRole.glow}, 0 0 160px ${greetRole.glow}`,
                maxWidth:       540,
                width:          "100%",
                textAlign:      "center",
              }}
            >
              {/* Avatar with pulse ring */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position:     "absolute",
                    inset:        -12,
                    borderRadius: "50%",
                    border:       `2px solid ${greetRole.hex}`,
                    boxShadow:    `0 0 40px ${greetRole.glow}, 0 0 80px ${greetRole.glow}`,
                    animation:    "k-pulse 2s ease-out infinite",
                  }}
                />
                <div
                  style={{
                    width:          isLandscape ? 110 : 88,
                    height:         isLandscape ? 110 : 88,
                    borderRadius:   "50%",
                    background:     `linear-gradient(135deg, ${greetRole.hex}33, ${greetRole.hex}11)`,
                    border:         `3px solid ${greetRole.border}`,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    boxShadow:      `0 0 30px ${greetRole.glow}`,
                    fontFamily:     "'Sora', sans-serif",
                    fontSize:       isLandscape ? 32 : 26,
                    fontWeight:     700,
                    color:          greetRole.hex,
                  }}
                >
                  {greeting.initials}
                </div>
              </div>

              {/* Role chip */}
              <div
                style={{
                  background:    greetRole.soft,
                  border:        `1px solid ${greetRole.border}`,
                  borderRadius:  20,
                  padding:       "5px 16px",
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      11,
                  fontWeight:    700,
                  color:         greetRole.hex,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                {greetRole.label}{greeting.detail ? ` · ${greeting.detail}` : ""}
              </div>

              {/* Greeting text */}
              <div>
                <div style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize:   isLandscape ? 38 : 28,
                  fontWeight: 700,
                  color:      "#fff",
                  textShadow: `0 0 40px ${greetRole.glow}`,
                  lineHeight: 1.1,
                  marginBottom: 10,
                }}>
                  {buildGreeting(greeting.name, greeting.status).title}
                </div>
                <div style={{
                  fontFamily: "'Sora', sans-serif",
                  fontSize:   isLandscape ? 15 : 13,
                  color:      "var(--k-muted)",
                  fontWeight: 300,
                  lineHeight: 1.5,
                  maxWidth:   400,
                }}>
                  {buildGreeting(greeting.name, greeting.status).subtitle}
                </div>
                {greeting.photoSaved && (
                  <div style={{
                    marginTop:     10,
                    display:       "inline-flex",
                    alignItems:    "center",
                    gap:           6,
                    fontFamily:    "'Sora', sans-serif",
                    fontSize:      11,
                    fontWeight:    600,
                    color:         "#5DD3A8",
                    letterSpacing: "0.08em",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M20 6L9 17l-5-5" stroke="#5DD3A8" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Profile photo saved
                  </div>
                )}
              </div>

              {/* Confirmed pill */}
              <div style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                background:   greeting.action === "time_in" ? "rgba(93,211,168,0.10)" : "rgba(123,183,255,0.10)",
                border:       `1px solid ${greeting.action === "time_in" ? "rgba(93,211,168,0.4)" : "rgba(123,183,255,0.4)"}`,
                borderRadius: 12,
                padding:      "10px 20px",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke={greeting.action === "time_in" ? "#5DD3A8" : "#7BB7FF"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span style={{
                  fontFamily:    "'Sora', sans-serif",
                  fontSize:      11,
                  fontWeight:    700,
                  color:         greeting.action === "time_in" ? "#5DD3A8" : "#7BB7FF",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}>
                  {greeting.action === "time_in" ? "Time-in recorded" : "Time-out recorded"}
                </span>
                <span style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize:   12,
                  color:      "var(--k-muted)",
                  marginLeft: 6,
                }}>
                  {greeting.time}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hidden capture canvas */}
        <canvas ref={captureRef} style={{ display: "none" }} />

        {/* Floating mic widget — hover-only caption, always-accessible button.
            Positioned clear of the greeting overlay (which uses zIndex 50). */}
        <MicWidget
          voiceOn={voiceOn}
          voiceCaption={voiceCaption}
          onToggle={() => (voiceOn ? stopVoice() : startVoice())}
          isLandscape={isLandscape}
        />
      </div>
    </>
  );
}

function MicWidget({
  voiceOn, voiceCaption, onToggle, isLandscape,
}: {
  voiceOn:      boolean;
  voiceCaption: string;
  onToggle:     () => void;
  isLandscape:  boolean;
}) {
  // Keep the caption "peeking" briefly whenever there's fresh transcript or
  // listening just started, so the user has feedback even without hovering.
  const hasCaption = !!voiceCaption;
  const cls =
    "k-mic-widget" +
    (voiceOn     ? " k-mic-widget--active"  : "") +
    (hasCaption  ? " k-mic-widget--caption" : "");

  const captionText =
    voiceCaption
      ? voiceCaption
      : voiceOn
          ? "Listening… tap to stop"
          : "Tap to enable voice";

  return (
    <div
      className={cls}
      style={{
        bottom: isLandscape ? 24 : 16,
        right:  isLandscape ? 24 : 16,
      }}
    >
      <div className="k-mic-caption">{captionText}</div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={voiceOn ? "Stop voice control" : "Start voice control"}
        style={{
          width:          48,
          height:         48,
          borderRadius:   "50%",
          flexShrink:     0,
          background:     voiceOn ? `${ACCENT}33` : "rgba(10,16,36,0.88)",
          backdropFilter: "blur(12px)",
          border:         `1px solid ${voiceOn ? ACCENT : "rgba(123,208,255,0.3)"}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          cursor:         "pointer",
          boxShadow:      voiceOn
                            ? `0 0 24px ${ACCENT}66, 0 4px 16px rgba(0,0,20,0.4)`
                            : "0 4px 16px rgba(0,0,20,0.5)",
          transition:     "all 0.25s ease",
          position:       "relative",
          zIndex:         1,
        }}
      >
        {voiceOn && (
          <span
            aria-hidden
            style={{
              position:     "absolute",
              inset:        -2,
              borderRadius: "50%",
              border:       `2px solid ${ACCENT}`,
              animation:    "k-pulse 1.8s ease-out infinite",
              pointerEvents: "none",
            }}
          />
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke={voiceOn ? "#fff" : ACCENT} strokeWidth="2" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke={voiceOn ? "#fff" : ACCENT} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Pulse({ color, small }: { color: string; small?: boolean }) {
  const size = small ? 8 : 10;
  return (
    <span
      className="k-pulse-ring"
      style={{
        display:      "inline-block",
        width:        size,
        height:       size,
        borderRadius: "50%",
        background:   color,
        color, // for ::before currentColor
        boxShadow:    `0 0 8px ${color}`,
      }}
    />
  );
}

function StatusRow({
  label, color, active, small,
}: {
  label:  string;
  color:  string;
  active: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        className={active ? "k-pulse-ring" : ""}
        style={{
          display:      "inline-block",
          width:        small ? 8 : 10,
          height:       small ? 8 : 10,
          borderRadius: "50%",
          background:   color,
          color,
          boxShadow:    active ? `0 0 8px ${color}` : "none",
        }}
      />
      <span style={{
        fontFamily:    "'Sora', sans-serif",
        fontSize:      small ? 10 : 11,
        fontWeight:    600,
        color,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
    </div>
  );
}

function StatCard({
  label, value, color, icon, compact,
}: {
  label: string; value: number; color: string; icon: string; compact?: boolean;
}) {
  const iconBox = compact ? 28 : 36;
  return (
    <div
      className="k-frosted"
      style={{
        padding:    compact ? "8px 12px" : "14px 18px",
        display:    "flex",
        alignItems: "center",
        gap:        compact ? 10 : 14,
      }}
    >
      <div style={{
        width:          iconBox,
        height:         iconBox,
        borderRadius:   compact ? 8 : 10,
        background:     `linear-gradient(135deg, ${color}26, transparent)`,
        border:         `1px solid ${color}44`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        fontSize:       compact ? 13 : 16,
        color,
        boxShadow:      `0 0 12px ${color}33`,
        flexShrink:     0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize:   compact ? 18 : 24,
          fontWeight: 800,
          color:      "#fff",
          lineHeight: 1,
        }}>
          {value}
        </div>
        <div style={{
          fontFamily:    "'Sora', sans-serif",
          fontSize:      compact ? 8 : 9,
          color:         "var(--k-muted-2)",
          letterSpacing: "0.14em",
          marginTop:     compact ? 3 : 4,
          fontWeight:    700,
          textTransform: "uppercase",
          whiteSpace:    "nowrap",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function EmptyRecent({ compact }: { compact?: boolean }) {
  return (
    <div style={{
      textAlign:     "center",
      padding:       compact ? "8px 12px" : "30px 0",
      width:         compact ? "auto" : "100%",
      fontFamily:    "'Sora', sans-serif",
      fontSize:      compact ? 10 : 11,
      color:         "var(--k-muted-2)",
      letterSpacing: "0.08em",
      whiteSpace:    "nowrap",
    }}>
      No faces detected
    </div>
  );
}

/**
 * Compact role-coloured pill used on the portrait kiosk's horizontal
 * "Recent" rail. Avatar + first name only, so 5 of them fit comfortably
 * across a phone-width viewport.
 */
function PersonPill({ face, delay = 0 }: { face: FaceResult; delay?: number }) {
  const role = ROLES[face.role ?? ""] ?? DEFAULT_ROLE;
  const first = face.name.split(" ")[0] ?? face.name;
  return (
    <div
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           8,
        padding:       "5px 10px 5px 5px",
        background:    role.soft,
        border:        `1px solid ${role.border}`,
        borderRadius:  999,
        flexShrink:    0,
        animation:     `k-slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
      }}
    >
      <div
        style={{
          width:          28,
          height:         28,
          borderRadius:   "50%",
          background:     `linear-gradient(135deg, ${role.hex}44, ${role.hex}11)`,
          border:         `1.5px solid ${role.border}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "'Sora', sans-serif",
          fontSize:       11,
          fontWeight:     700,
          color:          role.hex,
          flexShrink:     0,
        }}
      >
        {initials(face.name)}
      </div>
      <div style={{
        display:       "flex",
        flexDirection: "column",
        gap:           1,
        minWidth:      0,
      }}>
        <span style={{
          fontFamily:   "'Sora', sans-serif",
          fontSize:     12,
          fontWeight:   600,
          color:        "#fff",
          whiteSpace:   "nowrap",
          lineHeight:   1.1,
        }}>
          {first}
        </span>
        <span style={{
          fontFamily:    "'Orbitron', monospace",
          fontSize:      8,
          color:         role.hex,
          opacity:       0.85,
          letterSpacing: "0.04em",
          lineHeight:    1,
        }}>
          {Math.round((face.confidence ?? 0) * 100)}%
        </span>
      </div>
    </div>
  );
}

function DetectionBar({
  face, role, scanning,
}: {
  face: FaceResult | undefined;
  role: RoleConf | null;
  scanning: boolean;
}) {
  return (
    <div
      style={{
        padding:       "10px 16px",
        background:    face && role ? role.soft : "rgba(0,0,20,0.4)",
        border:        `1px solid ${face && role ? role.border : "rgba(80,140,255,0.10)"}`,
        borderRadius:  10,
        display:       "flex",
        alignItems:    "center",
        gap:           12,
        transition:    "all 0.4s ease",
        zIndex:        3,
      }}
    >
      {face && role ? (
        <>
          <div style={{
            width:          36,
            height:         36,
            borderRadius:   "50%",
            background:     `linear-gradient(135deg, ${role.hex}44, ${role.hex}11)`,
            border:         `2px solid ${role.hex}`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontFamily:     "'Sora', sans-serif",
            fontSize:       12,
            fontWeight:     700,
            color:          role.hex,
            boxShadow:      `0 0 16px ${role.glow}`,
            flexShrink:     0,
          }}>
            {initials(face.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily:   "'Sora', sans-serif",
              fontSize:     16,
              fontWeight:   700,
              color:        "#fff",
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}>
              {face.name}
            </div>
            <div style={{
              fontFamily: "'Sora', sans-serif",
              fontSize:   11,
              color:      role.hex,
            }}>
              {face.program || role.label}
            </div>
          </div>
          {!face.onCooldown && face.action && (
            <div
              style={{
                fontFamily:    "'Sora', sans-serif",
                fontSize:      11,
                fontWeight:    700,
                padding:       "4px 12px",
                background:    face.action === "time_in" ? "rgba(93,211,168,0.18)" : "rgba(123,183,255,0.18)",
                border:        `1px solid ${face.action === "time_in" ? "rgba(93,211,168,0.5)" : "rgba(123,183,255,0.5)"}`,
                borderRadius:  10,
                color:         face.action === "time_in" ? "#5DD3A8" : "#7BB7FF",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace:    "nowrap",
              }}
            >
              {face.action === "time_in" ? "Time in" : "Time out"}
            </div>
          )}
        </>
      ) : (
        <div style={{
          width:         "100%",
          textAlign:     "center",
          fontFamily:    "'Sora', sans-serif",
          fontSize:      11,
          color:         "var(--k-muted-2)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}>
          {scanning ? "Processing biometric data…" : "Awaiting detection"}
        </div>
      )}
    </div>
  );
}

function PersonCard({ face, delay = 0 }: { face: FaceResult; delay?: number }) {
  const role = ROLES[face.role ?? ""] ?? DEFAULT_ROLE;
  return (
    <div
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           12,
        padding:       "10px 14px",
        background:    role.soft,
        border:        `1px solid ${role.border}`,
        borderRadius:  12,
        boxShadow:     `0 4px 20px ${role.glow}22`,
        animation:     `k-slide-up 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
      }}
    >
      <div
        style={{
          width:          36,
          height:         36,
          borderRadius:   "50%",
          background:     `linear-gradient(135deg, ${role.hex}44, ${role.hex}11)`,
          border:         `2px solid ${role.border}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "'Sora', sans-serif",
          fontSize:       12,
          fontWeight:     700,
          color:          role.hex,
          flexShrink:     0,
          boxShadow:      `0 0 12px ${role.glow}`,
        }}
      >
        {initials(face.name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily:   "'Sora', sans-serif",
          fontSize:     13,
          fontWeight:   600,
          color:        "#fff",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {face.name}
        </div>
        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize:   10,
          color:      role.hex,
          opacity:    0.85,
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
        }}>
          {face.program || role.label}
        </div>
      </div>

      <div style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           4,
        flexShrink:    0,
      }}>
        <div style={{
          fontFamily:    "'Sora', sans-serif",
          fontSize:      9,
          padding:       "2px 8px",
          background:    role.soft,
          border:        `1px solid ${role.border}`,
          borderRadius:  10,
          color:         role.hex,
          letterSpacing: "0.08em",
          fontWeight:    700,
          textTransform: "uppercase",
        }}>
          {role.label}
        </div>
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize:   9,
          color:      "var(--k-muted-2)",
        }}>
          {Math.round((face.confidence ?? 0) * 100)}%
        </div>
      </div>
    </div>
  );
}
