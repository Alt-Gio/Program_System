"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ACCENTS,
  DEFAULT_TWEAKS,
  isAdminUnlocked,
  readTweaks,
  setAdminUnlocked as persistAdminUnlocked,
  writeTweaks,
  type LoginTweaks,
} from "@/lib/login/tweaks";
import { ROLES, SLIDES, type RoleKey } from "./roles";
import { RolePanel } from "./RolePanel";
import { LoginOverlay } from "./LoginOverlay";
import { DictSeal } from "./DictSeal";
import { TweaksPanel } from "./TweaksPanel";

const TYPE_SEQUENCE = "admin";

export function CarouselStage() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl");

  const [tweaks, setTweaks] = useState<LoginTweaks>(DEFAULT_TWEAKS);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [sealPing, setSealPing] = useState(false);

  const typeBufRef = useRef<string>("");
  const typeTimerRef = useRef<number | null>(null);

  // Mount: load persisted state
  useEffect(() => {
    setTweaks(readTweaks());
    setAdminUnlocked(isAdminUnlocked());
  }, []);

  // Persist tweaks on change
  useEffect(() => {
    writeTweaks(tweaks);
  }, [tweaks]);

  const visibleSlides = useMemo(
    () => SLIDES.filter((s) => !s.classified || adminUnlocked),
    [adminUnlocked],
  );

  // Clamp slide index when classified slide is locked away
  useEffect(() => {
    if (slideIdx >= visibleSlides.length) setSlideIdx(0);
  }, [slideIdx, visibleSlides.length]);

  const unlockAdmin = useCallback(() => {
    setAdminUnlocked(true);
    persistAdminUnlocked(true);
    setSealPing(true);
    setTimeout(() => setSealPing(false), 1200);
  }, []);

  const lockAdmin = useCallback(() => {
    setAdminUnlocked(false);
    persistAdminUnlocked(false);
    // If currently on the system slide, slide back to 0
    setSlideIdx((i) => {
      const cur = SLIDES.findIndex((s, idx) =>
        idx === Math.min(i, visibleSlides.length - 1) ? true : false,
      );
      return cur === -1 ? 0 : Math.min(i, 1);
    });
  }, [visibleSlides.length]);

  // Global admin-unlock listener: type sequence + Ctrl+Shift+L
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // shortcut
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        if (adminUnlocked) lockAdmin();
        else unlockAdmin();
        return;
      }

      // type sequence: only plain printable keys
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      // Skip when typing into an input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      typeBufRef.current = (typeBufRef.current + e.key.toLowerCase()).slice(-TYPE_SEQUENCE.length);
      if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
      typeTimerRef.current = window.setTimeout(() => {
        typeBufRef.current = "";
      }, 1500);
      if (typeBufRef.current === TYPE_SEQUENCE && !adminUnlocked) {
        unlockAdmin();
        typeBufRef.current = "";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
    };
  }, [adminUnlocked, lockAdmin, unlockAdmin]);

  // Carousel navigation: keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedRole) return; // overlay handles its own keys
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, visibleSlides.length]);

  // Touch swipe
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
  }

  function next() {
    setSlideIdx((i) => (i + 1) % visibleSlides.length);
  }
  function prev() {
    setSlideIdx((i) => (i - 1 + visibleSlides.length) % visibleSlides.length);
  }

  const accentHex = ACCENTS[tweaks.accent].hex;
  const currentSlide = visibleSlides[Math.min(slideIdx, visibleSlides.length - 1)] ?? visibleSlides[0];
  const selectedRoleMeta = selectedRole ? ROLES[selectedRole] : null;

  return (
    <main
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        ["--login-accent" as any]: accentHex,
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(60, 40, 100, 0.35) 0%, transparent 55%)," +
          "radial-gradient(ellipse 80% 50% at 50% 110%, rgba(40, 20, 60, 0.25) 0%, transparent 55%)," +
          "#05060f",
        color: "#e8eaf4",
      }}
    >
      <Starfield />

      {/* ── Top status bar ── */}
      {tweaks.showBranding && (
        <header
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "22px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <MiniSeal onTripleClick={unlockAdmin} />
            <div>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1 }}>
                <strong>DICT</strong> <em style={{ color: accentHex }}>Region V</em>
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                DEPARTMENT OF INFORMATION &amp; COMMUNICATIONS TECHNOLOGY
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 11 }}>
            <div className="mono" style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", animation: "pulseDot 2s ease-in-out infinite" }} />
              SYSTEMS NOMINAL
            </div>
            <span className="mono" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>v3.2.0</span>
            {adminUnlocked && (
              <button
                type="button"
                onClick={lockAdmin}
                className="mono"
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(244, 63, 94, 0.08)",
                  border: "1px solid rgba(244, 63, 94, 0.4)",
                  color: "#fca5a5",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                LOCK ADMIN
              </button>
            )}
          </div>
        </header>
      )}

      {/* ── Slide label above center ── */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          zIndex: 30,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.24em",
            color: currentSlide?.classified ? "#f43f5e" : accentHex,
            marginBottom: 4,
          }}
        >
          {currentSlide?.label}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{currentSlide?.subLabel}</div>
        {currentSlide?.classified && (
          <div
            className="mono"
            style={{
              marginTop: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.35)",
              color: "#fca5a5",
              fontSize: 10,
              letterSpacing: "0.18em",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            CLASSIFIED ACCESS
          </div>
        )}
      </div>

      {/* ── Split panel stage ── */}
      <div
        key={currentSlide?.id}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          paddingTop: 100,
          paddingBottom: 110,
        }}
      >
        {currentSlide && (
          <>
            <RolePanel
              role={ROLES[currentSlide.left]}
              side="left"
              onSelect={() => setSelectedRole(currentSlide.left)}
              classified={currentSlide.classified}
            />
            <div style={{ width: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 -60px", zIndex: 10 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: 1,
                  left: "50%",
                  background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0.15) 80%, transparent)",
                  animation: "seamGlow 3s ease-in-out infinite",
                }}
              />
              <div style={{ position: "relative", zIndex: 2 }}>
                <DictSeal
                  size={120}
                  onTripleClick={unlockAdmin}
                  glow={!sealPing}
                />
                {sealPing && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -20,
                      borderRadius: "50%",
                      border: "2px solid rgba(244, 63, 94, 0.6)",
                      animation: "fadeIn 0.6s ease, pulseDot 1.2s ease-in-out",
                      pointerEvents: "none",
                    }}
                  />
                )}
              </div>
            </div>
            <RolePanel
              role={ROLES[currentSlide.right]}
              side="right"
              onSelect={() => setSelectedRole(currentSlide.right)}
              classified={currentSlide.classified}
            />
          </>
        )}
      </div>

      {/* ── Navigation arrows ── */}
      {visibleSlides.length > 1 && (
        <>
          <ArrowBtn direction="left" onClick={prev} />
          <ArrowBtn direction="right" onClick={next} />
        </>
      )}

      {/* ── Slide indicator / tab pills ── */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 32,
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 30,
        }}
      >
        <div
          className="mono"
          style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", marginRight: 8 }}
        >
          {String(Math.min(slideIdx + 1, visibleSlides.length)).padStart(2, "0")} / {String(visibleSlides.length).padStart(2, "0")} · USE ← → OR SWIPE
        </div>
        {visibleSlides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSlideIdx(i)}
            className="mono"
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              background: i === slideIdx ? "rgba(249, 115, 22, 0.12)" : "rgba(255, 255, 255, 0.03)",
              border: `1px solid ${i === slideIdx ? accentHex + "66" : "rgba(255,255,255,0.08)"}`,
              color: i === slideIdx ? accentHex : "rgba(255,255,255,0.55)",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: i === slideIdx ? accentHex : "rgba(255,255,255,0.3)",
              }}
            />
            {pillLabel(s.label)}
          </button>
        ))}
      </div>

      {/* ── Footer links ── */}
      <footer
        style={{
          position: "absolute",
          bottom: 28,
          right: 32,
          display: "flex",
          gap: 22,
          fontSize: 12,
          color: "rgba(255,255,255,0.45)",
          zIndex: 30,
        }}
      >
        <a href="#" style={footLinkStyle}>Help Center</a>
        <a href="#" style={footLinkStyle}>Contact Support</a>
        <a href="#" style={footLinkStyle}>Status</a>
        <a href="#" style={footLinkStyle}>Privacy &amp; Terms</a>
      </footer>

      {/* ── Authorized-personnel micro-hint ── */}
      {!adminUnlocked && (
        <div
          className="mono"
          style={{
            position: "absolute",
            bottom: 6,
            left: 32,
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.2)",
            zIndex: 30,
          }}
        >
          ◌ AUTHORIZED PERSONNEL: TYPE "ADMIN" OR ⌃⇧L
        </div>
      )}

      {/* ── Tweaks panel ── */}
      <TweaksPanel tweaks={tweaks} onChange={setTweaks} />

      {/* ── Overlay ── */}
      {selectedRoleMeta && (
        <LoginOverlay
          role={selectedRoleMeta}
          callbackUrl={callbackUrl}
          oauthError={oauthError}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </main>
  );
}

function ArrowBtn({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous" : "Next"}
      style={{
        position: "absolute",
        top: "50%",
        [direction]: 20,
        transform: "translateY(-50%)",
        width: 46,
        height: 70,
        borderRadius: 14,
        background: "rgba(15, 17, 30, 0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.75)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        transition: "background 0.15s, border-color 0.15s",
        zIndex: 30,
      } as React.CSSProperties}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function MiniSeal({ onTripleClick }: { onTripleClick: () => void }) {
  const clicksRef = useRef<number[]>([]);
  function handleClick() {
    const now = Date.now();
    const recent = clicksRef.current.filter((t) => now - t < 800);
    recent.push(now);
    clicksRef.current = recent;
    if (recent.length >= 3) {
      clicksRef.current = [];
      onTripleClick();
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="DICT seal"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "radial-gradient(circle, #0a0d1e, #05060f 70%)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" strokeDasharray="2 3" />
        <circle cx="22" cy="22" r="10" fill="rgba(249, 115, 22, 0.12)" stroke="var(--login-accent, #f97316)" strokeWidth="1" />
        <text x="22" y="27" textAnchor="middle" fontFamily="'DM Serif Display', serif" fontSize="13" fontStyle="italic" fill="var(--login-accent, #f97316)">D</text>
      </svg>
    </button>
  );
}

function Starfield() {
  // Pre-computed random positions so the stars don't reshuffle on each render.
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }).map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 1.4 + 0.4,
        delay: Math.random() * 4,
      })),
    [],
  );
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      {stars.map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: s.top + "%",
            left: s.left + "%",
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#fff",
            opacity: 0.3,
            animation: `twinkle 5s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

const footLinkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
};

function pillLabel(label: string): string {
  // "PUBLIC PORTALS" -> "Public Portals"
  return label
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
