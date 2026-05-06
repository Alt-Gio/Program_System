"use client";

/**
 * DTC Office locator modal — a lightweight, dependency-free version
 * of the public-landing DTCOffices section. Used by:
 *
 *   • The Right-Panel "DTC Offices" widget (browse all six)
 *   • The Meet/webinar post "Hosted by …" badge (focuses one office)
 *
 * The map itself is loaded lazily via `react-map-gl` only when the
 * modal opens, so the LearnHub feed bundle stays light. If
 * NEXT_PUBLIC_MAPBOX_TOKEN is missing we fall back to a list-only
 * view with Google-Maps deep links — no broken map state.
 */

import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, X } from "lucide-react";
import { DTC_OFFICES, type DtcOffice } from "@/lib/learnhub/dtc-offices";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface DtcOfficeModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional office id to focus on open. */
  initialOfficeId?: string | null;
}

export function DtcOfficeModal({ open, onClose, initialOfficeId }: DtcOfficeModalProps) {
  const [selected, setSelected] = useState<DtcOffice | null>(null);
  const [MapLib, setMapLib] = useState<typeof import("react-map-gl") | null>(null);
  const mapRef = useRef<unknown>(null);

  // Reset selection when the modal closes / reopens with a new initialOfficeId.
  useEffect(() => {
    if (!open) return;
    const initial = initialOfficeId
      ? DTC_OFFICES.find((o) => o.id === initialOfficeId) ?? DTC_OFFICES[0]
      : DTC_OFFICES[0];
    setSelected(initial);
  }, [open, initialOfficeId]);

  // Lazy-load Mapbox only when the modal first opens.
  useEffect(() => {
    if (!open || MapLib || !MAPBOX_TOKEN) return;
    let cancelled = false;
    import("react-map-gl").then((m) => { if (!cancelled) setMapLib(m); });
    return () => { cancelled = true; };
  }, [open, MapLib]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fly to the selected office when it changes.
  useEffect(() => {
    if (!selected) return;
    const ref = mapRef.current as { flyTo?: (opts: { center: [number, number]; zoom: number; duration: number }) => void } | null;
    ref?.flyTo?.({ center: selected.coords, zoom: 12, duration: 900 });
  }, [selected]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(5, 7, 18, 0.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lh-card"
        style={{
          width: "100%", maxWidth: 920, maxHeight: "88vh",
          background: "var(--lh-surface)",
          borderRadius: 16, padding: 0, margin: 0,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--lh-surface-3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.3em", color: "var(--lh-accent)", textTransform: "uppercase" }}>Find Us</p>
            <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--lh-text)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              DTC Offices in Bicol Region
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--lh-surface-2)", border: "1px solid var(--lh-surface-3)",
              color: "var(--lh-text-2)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", overflow: "hidden", minHeight: 420 }}>
          {/* Office list */}
          <div style={{ overflowY: "auto", padding: 12, borderRight: "1px solid var(--lh-surface-3)", display: "flex", flexDirection: "column", gap: 8 }}>
            {DTC_OFFICES.map((office) => {
              const isActive = selected?.id === office.id;
              return (
                <button
                  key={office.id}
                  onClick={() => setSelected(office)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: isActive ? "var(--lh-accent-soft)" : "var(--lh-surface-2)",
                    border: `1px solid ${isActive ? "var(--lh-accent)" : "var(--lh-surface-3)"}`,
                    color: "var(--lh-text)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <MapPin size={16} style={{ marginTop: 2, flexShrink: 0, color: office.isMain ? "var(--lh-accent)" : "var(--lh-accent-2)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--lh-text)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {office.city}, {office.province}
                      </span>
                      {office.isMain && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6, background: "var(--lh-accent)", color: "white", letterSpacing: 0.5, textTransform: "uppercase" }}>
                          Main Office
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--lh-text-3)", lineHeight: 1.4 }}>
                      {office.address}
                    </p>
                    {isActive && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--lh-accent)", fontFamily: "monospace" }}>
                        <span>{office.coords[1].toFixed(4)}, {office.coords[0].toFixed(4)}</span>
                        <a
                          href={office.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, color: "var(--lh-accent-2)", textDecoration: "none" }}
                        >
                          <ExternalLink size={11} /> Maps
                        </a>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map / fallback */}
          <div style={{ position: "relative", background: "var(--lh-surface-2)" }}>
            {MAPBOX_TOKEN && MapLib ? (
              <MapLib.Map
                ref={(r) => { mapRef.current = r; }}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                  longitude: selected?.coords[0] ?? 123.5,
                  latitude:  selected?.coords[1] ?? 13.0,
                  zoom: selected ? 12 : 7.4,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
              >
                <MapLib.NavigationControl position="top-right" />
                {DTC_OFFICES.map((o) => (
                  <MapLib.Marker key={o.id} longitude={o.coords[0]} latitude={o.coords[1]} anchor="bottom">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(o); }}
                      title={`${o.city}, ${o.province}`}
                      style={{
                        width: o.isMain ? 28 : 22,
                        height: o.isMain ? 28 : 22,
                        borderRadius: "50%",
                        background: o.isMain ? "var(--lh-accent)" : "var(--lh-accent-2)",
                        border: "3px solid white",
                        cursor: "pointer",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
                        transform: selected?.id === o.id ? "scale(1.2)" : "scale(1)",
                        transition: "transform 0.15s",
                      }}
                    />
                  </MapLib.Marker>
                ))}
              </MapLib.Map>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 10, color: "var(--lh-text-3)", textAlign: "center" }}>
                <MapPin size={32} />
                <p style={{ margin: 0, fontSize: 13 }}>
                  {MAPBOX_TOKEN ? "Loading map…" : "Map preview unavailable"}
                </p>
                {selected && (
                  <a
                    href={selected.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: 4, padding: "8px 14px", borderRadius: 10,
                      background: "var(--lh-accent)", color: "white",
                      fontSize: 12, fontWeight: 700, textDecoration: "none",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <ExternalLink size={13} /> Open {selected.city} in Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Selected info card */}
            {selected && MapLib && (
              <div style={{
                position: "absolute", left: 12, right: 12, bottom: 12,
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(13, 16, 32, 0.92)", backdropFilter: "blur(8px)",
                border: "1px solid var(--lh-accent)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--lh-text)" }}>
                    {selected.city}, {selected.province}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--lh-text-3)" }}>
                    {selected.address}
                  </p>
                </div>
                <a
                  href={selected.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 8,
                    background: "var(--lh-accent-soft)", color: "var(--lh-accent)",
                    border: "1px solid var(--lh-accent)",
                    fontSize: 11, fontWeight: 700, textDecoration: "none",
                  }}
                >
                  <ExternalLink size={12} /> Maps
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
