"use client";

import { useEffect, useState } from "react";
import { openKioskPopup } from "@/lib/kiosk/openKioskPopup";

type VisibleFace = {
  recognized:  boolean;
  name:        string;
  role?:       string;
  confidence?: number;
  bbox:        number[];
};

type VisiblePayload = {
  faces:     VisibleFace[];
  updatedAt: string | null;
  cameraId?: string;
};

// Tailwind colour classes keyed by user role.
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin:      { label: "Admin",      color: "text-yellow-500" },
  supervisor: { label: "Supervisor", color: "text-purple-500" },
  mentor:     { label: "Mentor",     color: "text-blue-500"   },
  intern:     { label: "Intern",     color: "text-green-500"  },
  student:    { label: "Student",    color: "text-green-500"  },
  readonly:   { label: "Staff",      color: "text-gray-500"   },
};

/**
 * Shows the faces that the kiosk camera is seeing **right now** by polling
 * the Python server's /api/visible endpoint every 2 seconds.
 *
 * This panel does not open a camera of its own — it just reads the snapshot
 * written by the kiosk page in another tab. When the kiosk isn't running
 * the panel shows a "camera not active" placeholder with a link to open it.
 */
export function LiveDetectionPanel() {
  const [faces, setFaces]           = useState<VisibleFace[]>([]);
  const [active, setActive]         = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const SERVER_URL =
    process.env.NEXT_PUBLIC_FACE_SERVER_HTTP ??
    process.env.NEXT_PUBLIC_FACE_SERVER_URL ??
    "http://localhost:8001";

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/visible`, { cache: "no-store" });
        if (!res.ok) {
          if (mounted) setActive(false);
          return;
        }
        const data = (await res.json()) as VisiblePayload;

        if (!mounted) return;
        setFaces(data.faces ?? []);

        if (data.updatedAt) {
          const d = new Date(data.updatedAt);
          const ageMs = Date.now() - d.getTime();
          // Snapshot older than 10 s → kiosk tab is likely closed/minimised.
          setActive(ageMs <= 10_000);
          setLastUpdate(d.toLocaleTimeString("en-PH"));
        } else {
          setActive(false);
        }
      } catch {
        if (mounted) setActive(false);
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [SERVER_URL]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <span
            className={
              "h-2 w-2 rounded-full " +
              (active ? "animate-pulse bg-green-500" : "bg-gray-400")
            }
          />
          <h2 className="font-semibold text-gray-800">Live Camera</h2>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && active && (
            <span className="text-xs text-gray-500">Updated {lastUpdate}</span>
          )}
          <button
            type="button"
            onClick={openKioskPopup}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Open Kiosk
          </button>
        </div>
      </div>

      <div className="p-4">
        {!active ? (
          <div className="flex h-20 items-center justify-center text-sm text-gray-500">
            Kiosk camera not active.
            <button
              type="button"
              onClick={openKioskPopup}
              className="ml-1 text-blue-600 hover:underline"
            >
              Open it →
            </button>
          </div>
        ) : faces.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-sm text-gray-500">
            Camera is active — no faces detected
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {faces.map((face, i) => {
              const rc = ROLE_CONFIG[face.role ?? ""] ?? ROLE_CONFIG.readonly;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5"
                >
                  <div
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white " +
                      (face.recognized ? "bg-blue-600" : "bg-gray-500")
                    }
                  >
                    {face.recognized && face.name
                      ? face.name.charAt(0).toUpperCase()
                      : "?"}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">
                      {face.recognized ? face.name : "Unknown"}
                    </span>
                    {face.role && (
                      <span className={`ml-1.5 text-xs font-medium ${rc.color}`}>
                        {rc.label}
                      </span>
                    )}
                    {typeof face.confidence === "number" && face.recognized && (
                      <span className="ml-1.5 text-xs text-gray-500">
                        {Math.round(face.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
