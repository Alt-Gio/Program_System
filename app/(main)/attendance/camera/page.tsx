"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Camera, CameraOff, AlertCircle, CheckCircle, Loader2, ArrowLeft,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

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
  note?:          string;
};

type ServerMsg =
  | { type: "ready";  message?: string; threshold?: number }
  | { type: "result"; faces: FaceResult[]; faceCount: number; processedAt: string }
  | { type: "error";  message: string };

type ConnStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

// ─── Config ──────────────────────────────────────────────────────

/**
 * Full ws(s)://host:port URL for the face server. Set in .env.local:
 *   NEXT_PUBLIC_FACE_SERVER_WS=ws://192.168.1.10:8001/ws/camera
 * If unset, we fall back to ws(s)://<current host>:8001/ws/camera so
 * the default dev experience works when the face server runs on the
 * same box as the web app.
 */
function resolveWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_FACE_SERVER_WS;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "ws://localhost:8001/ws/camera";
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.hostname}:8001/ws/camera`;
}

const API_TOKEN = process.env.NEXT_PUBLIC_FACE_API_TOKEN ?? "";

const FRAME_INTERVAL_MS = 500;
const MAX_RECONNECT_DELAY_MS = 30_000;

// ─── Component ───────────────────────────────────────────────────

export default function CameraPage() {
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Initializing…");
  const [currentFaces, setCurrentFaces] = useState<FaceResult[]>([]);
  const [cameraId] = useState<string>("main");
  const [lastResultAt, setLastResultAt] = useState<string | null>(null);

  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // Single-flight frame pacing: avoid sending a new frame until the
  // last one has been acknowledged by a result/error.
  const inFlightRef = useRef(false);

  const wsUrl = resolveWsUrl();

  // ── WebSocket connect with exponential backoff ─────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return;
    }
    setStatus(reconnectAttemptsRef.current === 0 ? "connecting" : "reconnecting");
    setStatusMessage(
      reconnectAttemptsRef.current === 0
        ? "Connecting to recognition server…"
        : `Reconnecting… (attempt ${reconnectAttemptsRef.current + 1})`,
    );

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setStatus("error");
      setStatusMessage(`Invalid WebSocket URL: ${String(e)}`);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      ws.send(JSON.stringify({
        type:     "init",
        cameraId,
        apiToken: API_TOKEN || undefined,
      }));
    };

    ws.onmessage = (ev) => {
      inFlightRef.current = false;
      let data: ServerMsg;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (data.type === "ready") {
        setStatus("connected");
        setStatusMessage(data.message ?? "Recognition server ready.");
      } else if (data.type === "result") {
        setCurrentFaces(data.faces);
        setLastResultAt(data.processedAt);
        drawOverlay(data.faces);
      } else if (data.type === "error") {
        // Non-fatal — server will still process subsequent frames.
        console.warn("[face] server error:", data.message);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      inFlightRef.current = false;
      // Exponential backoff: 1s, 2s, 4s, … capped at 30s.
      const delay = Math.min(
        1000 * 2 ** reconnectAttemptsRef.current,
        MAX_RECONNECT_DELAY_MS,
      );
      reconnectAttemptsRef.current += 1;
      setStatus("reconnecting");
      setStatusMessage(`Disconnected. Retrying in ${Math.round(delay / 1000)}s…`);
      reconnectTimerRef.current = setTimeout(connectWS, delay);
    };

    ws.onerror = () => {
      // Informational only — onclose will drive the reconnect.
      // (Setting "error" status here would permanently sticky-fail
      // because we'd never transition back to "connecting".)
    };
  }, [wsUrl, cameraId]);

  // ── Camera stream + frame sender ──────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:       { ideal: 1280 },
          height:      { ideal: 720 },
          facingMode:  "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startFrameLoop();
    } catch (e) {
      setStatus("error");
      setStatusMessage(
        `Camera access denied: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startFrameLoop = () => {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    frameTimerRef.current = setInterval(() => {
      // Skip when:
      //   – socket not open
      //   – tab hidden (no point wasting GPU on a user who can't see)
      //   – last frame not yet acked (single-flight backpressure)
      if (
        !wsRef.current ||
        wsRef.current.readyState !== WebSocket.OPEN ||
        (typeof document !== "undefined" && document.visibilityState !== "visible") ||
        inFlightRef.current
      ) {
        return;
      }
      captureAndSendFrame();
    }, FRAME_INTERVAL_MS);
  };

  const captureAndSendFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ws     = wsRef.current;
    if (!video || !canvas || !ws || video.videoWidth === 0) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.7);
    const base64 = jpeg.split(",")[1] ?? "";
    if (!base64) return;

    inFlightRef.current = true;
    try {
      ws.send(JSON.stringify({ type: "frame", data: base64 }));
    } catch {
      inFlightRef.current = false;
    }
  };

  // Overlay is drawn on a secondary transparent canvas on top of the video.
  const drawOverlay = (faces: FaceResult[]) => {
    const overlay = document.getElementById("overlay-canvas") as HTMLCanvasElement | null;
    const video   = videoRef.current;
    if (!overlay || !video) return;

    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const face of faces) {
      const [x1, y1, x2, y2] = face.bbox;
      const recognized = face.recognized;
      const color = recognized
        ? face.onCooldown ? "#f59e0b" : "#10b981"
        : "#ef4444";

      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const label = recognized
        ? `${face.name} · ${((face.confidence ?? 0) * 100).toFixed(0)}%`
        : "Unknown";

      ctx.font = "16px sans-serif";
      const paddingX = 6;
      const textWidth = ctx.measureText(label).width + paddingX * 2;
      ctx.fillStyle = color;
      ctx.fillRect(x1, Math.max(0, y1 - 26), textWidth, 26);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x1 + paddingX, y1 - 8);
    }
  };

  // ── Mount / unmount ──────────────────────────────────────────
  useEffect(() => {
    startCamera();
    connectWS();

    return () => {
      // Stop frame loop
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      // Cancel pending reconnect
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Stop websocket
      if (wsRef.current) {
        wsRef.current.onclose = null; // avoid triggering another reconnect
        wsRef.current.close();
        wsRef.current = null;
      }
      // Stop camera
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── UI helpers ────────────────────────────────────────────────
  const statusBadge = (() => {
    switch (status) {
      case "connected":
        return { icon: <CheckCircle className="w-4 h-4" />, tone: "bg-green-100 text-green-700" };
      case "connecting":
      case "reconnecting":
        return { icon: <Loader2 className="w-4 h-4 animate-spin" />, tone: "bg-blue-100 text-blue-700" };
      case "error":
        return { icon: <AlertCircle className="w-4 h-4" />, tone: "bg-red-100 text-red-700" };
      default:
        return { icon: <CameraOff className="w-4 h-4" />, tone: "bg-gray-100 text-gray-700" };
    }
  })();

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
          <h1 className="text-2xl font-bold">Face Recognition Camera</h1>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusBadge.tone}`}>
          {statusBadge.icon}
          <span>{statusMessage}</span>
        </div>
      </div>

      {/* Video + overlay */}
      <div className="relative bg-black rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-auto"
        />
        <canvas
          id="overlay-canvas"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {/* Hidden capture canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer chip: camera + last result */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/60">
            <Camera className="w-3.5 h-3.5" />
            <span>{cameraId}</span>
          </div>
          {lastResultAt && (
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-black/60">
              <span>Last frame: {new Date(lastResultAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Current faces */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Live Recognitions</h2>
        </header>
        <div className="p-4">
          {currentFaces.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No faces in frame.
            </p>
          ) : (
            <ul className="space-y-2">
              {currentFaces.map((f, i) => (
                <li
                  key={i}
                  className={
                    "flex items-center justify-between px-3 py-2 rounded-lg border " +
                    (f.recognized
                      ? f.onCooldown
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50")
                  }
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {f.recognized ? f.name : "Unknown"}
                      {f.recognized && (
                        <span className="ml-2 text-xs text-gray-500">
                          {((f.confidence ?? 0) * 100).toFixed(1)}%
                          {f.action && ` · ${f.action === "time_in" ? "Time-In" : "Time-Out"}`}
                        </span>
                      )}
                    </p>
                    {f.recognized && f.role && (
                      <p className="text-xs text-gray-500">
                        {f.role}
                        {f.program ? ` · ${f.program}` : ""}
                      </p>
                    )}
                    {f.note === "already_timed_out_today" && (
                      <p className="text-xs text-amber-700 mt-0.5">
                        Already timed out today — no new event logged.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
