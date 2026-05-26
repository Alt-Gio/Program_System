"use client";

import { useEffect, useState } from "react";

// Cross-platform install CTA.
//
// Chrome / Edge / Android: listens for `beforeinstallprompt`, stashes the
// event, and surfaces a one-tap install button. Once accepted, the prompt
// won't fire again, so we just hide the button.
//
// iOS Safari does not fire beforeinstallprompt at all — Apple makes you
// install via Share → "Add to Home Screen". When we detect iOS without an
// install event, we surface a small how-to overlay instead.

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS-specific flag
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

interface InstallAppButtonProps {
  label?: string;
  // Visual variant — primary is the indigo gradient CTA, ghost is a
  // less-prominent outline used inside settings panes.
  variant?: "primary" | "ghost";
}

export default function InstallAppButton({
  label = "Install app",
  variant = "primary",
}: InstallAppButtonProps) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [iosCapable, setIosCapable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIosCapable(isIOS());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: "#22d3a0" }}
      >
        ✓ Installed
      </span>
    );
  }

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const result = await deferred.userChoice;
        if (result.outcome === "accepted") setInstalled(true);
      } finally {
        setDeferred(null);
      }
      return;
    }
    // iOS or any browser that didn't fire beforeinstallprompt: show the
    // manual how-to. We still show this button on those browsers so users
    // know the install pathway exists.
    setShowIosHelp(true);
  };

  // If neither install event nor iOS, we don't really know if the browser
  // supports installs — leave the button rendered so users can at least
  // attempt the Add-to-Home-Screen flow via their browser menu.

  const primaryStyle = {
    background: "linear-gradient(135deg, #5b6cff, #7c5cff)",
    color: "#fff",
    border: "none",
    padding: "10px 18px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
  const ghostStyle = {
    background: "rgba(91,108,255,0.12)",
    color: "#a8b4ff",
    border: "1px solid rgba(91,108,255,0.32)",
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={variant === "primary" ? primaryStyle : ghostStyle}
        title={iosCapable ? "Install via Share → Add to Home Screen" : "Install this app to your home screen"}
      >
        {iosCapable && !deferred ? `📲 ${label}` : `⬇️ ${label}`}
      </button>

      {showIosHelp && (
        <div
          onClick={() => setShowIosHelp(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,6,15,0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111323",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px 16px 0 0",
              maxWidth: 460,
              width: "100%",
              padding: 24,
              color: "#e8eaf4",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <p
              style={{
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#9ba3cc",
                margin: "0 0 8px",
              }}
            >
              {iosCapable ? "iOS / Safari" : "Browser install"}
            </p>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Add to Home Screen
            </h3>
            <ol
              style={{
                marginTop: 14,
                paddingLeft: 18,
                fontSize: 14,
                lineHeight: 1.65,
                color: "#cfd3eb",
              }}
            >
              <li>
                Tap the <strong>Share</strong> button{" "}
                <span aria-hidden>{iosCapable ? "↗️" : "⋮"}</span> in your browser's toolbar.
              </li>
              <li>
                Scroll and tap <strong>{iosCapable ? "Add to Home Screen" : "Install app"}</strong>.
              </li>
              <li>Confirm — the app icon appears on your home screen.</li>
            </ol>
            <p style={{ fontSize: 12, color: "#9ba3cc", marginTop: 14 }}>
              Installed apps work offline, sync submissions when you reconnect, and open without browser chrome.
            </p>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                background: "#5b6cff",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
