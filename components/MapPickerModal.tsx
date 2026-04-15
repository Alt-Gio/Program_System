"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Loader2, CheckCircle2, Navigation, X } from "lucide-react";

// ── Config ──────────────────────────────────────────────────────
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER: [number, number] = [123.75, 13.45]; // Bicol Region
const DEFAULT_ZOOM = 9;

// Debug: Log token status on module load
if (typeof window !== "undefined") {
  console.log("MapPickerModal: Token configured:", TOKEN ? `Yes (${TOKEN.substring(0, 15)}...)` : "No");
}

// Start loading mapbox-gl the moment this module is first imported —
// by the time the user clicks "Pick on Map" it will already be cached.
let _mapboxPromise: Promise<any> | null = null;
function getMapboxgl(): Promise<any> {
  if (!_mapboxPromise && typeof window !== "undefined" && TOKEN) {
    _mapboxPromise = import("mapbox-gl").then(m => m.default);
  }
  return _mapboxPromise ?? Promise.resolve(null);
}
if (typeof window !== "undefined") getMapboxgl();

export interface PickedLocation {
  lng: number;
  lat: number;
  placeName: string;
}

interface MapPickerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (loc: PickedLocation) => void;
  initialVenue?: string;
  imageUrl?: string;
}

export function MapPickerModal({
  open, onOpenChange, onConfirm, initialVenue, imageUrl,
}: MapPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const popupRef     = useRef<any>(null);
  const mapboxRef    = useRef<any>(null);
  const sugWrapRef   = useRef<HTMLDivElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR guard — portal needs document.body
  const [domReady,   setDomReady]   = useState(false);
  const [mapReady,   setMapReady]   = useState(false);
  const [mapStyle,   setMapStyle]   = useState<"outdoors"|"satellite">("outdoors");
  const [picked,     setPicked]     = useState<PickedLocation | null>(null);
  const [geocoding,  setGeocoding]  = useState(false);
  const [searchQ,    setSearchQ]    = useState("");
  const [searching,  setSearching]  = useState(false);
  const [suggestions,setSuggestions]= useState<any[]>([]);
  const [showSug,    setShowSug]    = useState(false);

  useEffect(() => { setDomReady(true); }, []);

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (sugWrapRef.current && !sugWrapRef.current.contains(e.target as Node))
        setShowSug(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ── Build popup HTML ──
  const buildPopupHtml = useCallback((name: string, lat: number, lng: number, img?: string) => {
    const imgHtml = img
      ? `<img src="${img}" style="width:100%;height:85px;object-fit:cover;border-radius:6px;margin-bottom:5px;display:block;" />`
      : "";
    return `<div style="font-family:sans-serif;max-width:220px;padding:2px;">
      ${imgHtml}
      <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111;line-height:1.3;">${name}</p>
      <p style="font-size:10px;margin:0;color:#9ca3af;font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
    </div>`;
  }, []);

  // ── Place marker + popup ──
  const placeMarker = useCallback((gl: any, map: any, lng: number, lat: number, name?: string) => {
    if (markerRef.current) markerRef.current.remove();
    if (popupRef.current)  popupRef.current.remove();
    const el = document.createElement("div");
    el.style.cssText = `width:36px;height:44px;cursor:pointer;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 30'%3E%3Cellipse cx='12' cy='28' rx='5' ry='2' fill='rgba(0,0,0,0.25)'/%3E%3Cpath d='M12 0C7.58 0 4 3.58 4 8c0 5.25 8 18 8 18s8-12.75 8-18c0-4.42-3.58-8-8-8z' fill='%237c3aed'/%3E%3Ccircle cx='12' cy='8' r='3.5' fill='white'/%3E%3C/svg%3E") center/contain no-repeat;`;
    const popup = new gl.Popup({ offset: 38, closeButton: false, maxWidth: "240px" })
      .setHTML(buildPopupHtml(name ?? "Pinned location", lat, lng, imageUrl));
    popupRef.current = popup;
    const marker = new gl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat]).setPopup(popup).addTo(map);
    marker.togglePopup();
    markerRef.current = marker;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, buildPopupHtml]);

  // ── Reverse geocode ──
  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    setGeocoding(true);
    try {
      if (!TOKEN) { setPicked({ lng, lat, placeName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }); return; }
      const r   = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&limit=1`);
      const d   = await r.json();
      const name = d.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setPicked({ lng, lat, placeName: name });
      popupRef.current?.setHTML(buildPopupHtml(name, lat, lng, imageUrl));
    } catch {
      setPicked({ lng, lat, placeName: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    } finally { setGeocoding(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, buildPopupHtml]);

  // ── INIT MAP ONCE on component mount (not on open/close) ──
  // The portal div is always in the DOM so containerRef is always valid.
  useEffect(() => {
    if (!domReady) return;
    let active = true;
    (async () => {
      if (!TOKEN) { 
        console.warn("MapPickerModal: No NEXT_PUBLIC_MAPBOX_TOKEN found");
        setMapReady(true); 
        return; 
      }
      const gl = await getMapboxgl();
      if (!active || !gl || !containerRef.current || mapRef.current) return;
      
      // Ensure CSS is loaded
      if (!document.getElementById("mapbox-gl-css")) {
        const link = document.createElement("link");
        link.id = "mapbox-gl-css"; 
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.5.1/mapbox-gl.css";
        document.head.appendChild(link);
        // Wait a bit for CSS to load
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      gl.accessToken = TOKEN;
      mapboxRef.current = gl;
      
      const map = new gl.Map({
        container: containerRef.current!, 
        style: "mapbox://styles/mapbox/outdoors-v12",
        center: DEFAULT_CENTER, 
        zoom: DEFAULT_ZOOM, 
        attributionControl: false,
      });
      
      map.addControl(new gl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => { 
        if (active) {
          console.log("MapPickerModal: Map loaded successfully");
          setMapReady(true); 
        }
      });
      map.on("error", (e: any) => {
        console.error("MapPickerModal: Map error", e);
      });
      map.on("click", async (e: any) => {
        const { lng, lat } = e.lngLat;
        placeMarker(gl, map, lng, lat);
        await reverseGeocode(lng, lat);
      });
      map.getCanvas().style.cursor = "crosshair";
      mapRef.current = map;
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domReady]);

  // ── Destroy on unmount only ──
  useEffect(() => () => {
    markerRef.current?.remove();
    popupRef.current?.remove();
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
  }, []);

  // ── On open: resize map. On close: reset state ──
  useEffect(() => {
    if (open && mapRef.current) {
      // Use multiple resize attempts to ensure map renders
      const resizeMap = () => {
        if (mapRef.current) {
          mapRef.current.resize();
          console.log("MapPickerModal: Map resized");
        }
      };
      
      requestAnimationFrame(resizeMap);
      setTimeout(resizeMap, 100);
      setTimeout(resizeMap, 300);
    } else if (!open) {
      markerRef.current?.remove(); markerRef.current = null;
      popupRef.current?.remove();  popupRef.current  = null;
      setPicked(null); setSearchQ(""); setSuggestions([]); setShowSug(false);
    }
  }, [open]);

  // ── Style toggle ──
  function toggleStyle() {
    const next = mapStyle === "outdoors" ? "satellite" : "outdoors";
    setMapStyle(next);
    mapRef.current?.setStyle(
      next === "satellite" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/outdoors-v12"
    );
  }

  // ── Search ──
  function handleSearch(v: string) {
    setSearchQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim() || v.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      if (!TOKEN) return;
      setSearching(true);
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v)}.json?access_token=${TOKEN}&country=PH&limit=6&proximity=123.75,13.45`);
        const d = await r.json();
        setSuggestions(d.features ?? []); setShowSug(true);
      } catch {} finally { setSearching(false); }
    }, 350);
  }

  function pickSuggestion(f: any) {
    const [lng, lat] = f.center; const name = f.place_name;
    setSearchQ(name); setShowSug(false); setSuggestions([]);
    if (mapRef.current && mapboxRef.current) {
      placeMarker(mapboxRef.current, mapRef.current, lng, lat, name);
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
    }
    setPicked({ lng, lat, placeName: name });
  }

  function handleConfirm() {
    if (!picked) return;
    onConfirm(picked);
    onOpenChange(false);
  }

  // ── Portal-based render — ALWAYS in DOM, toggled via CSS ──
  if (!domReady) return null;

  return createPortal(
    <>
      {/* Backdrop - higher z-index and semi-transparent to show dialog behind */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        style={{ transition: "opacity 0.2s" }}
        className={`fixed inset-0 z-[999] bg-black/40 backdrop-blur-[2px] ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Modal panel - even higher z-index */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transition: "opacity 0.2s, transform 0.2s", transform: open ? "translate(-50%,-50%) scale(1)" : "translate(-50%,-50%) scale(0.97)" }}
        className={`fixed left-1/2 top-1/2 z-[1000] w-[92vw] max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0 flex items-start justify-between" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              Pin the Exact Venue Location
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Click the map to drop a pin, or search for a place.</p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenChange(false); }} className="text-gray-400 hover:text-gray-700 ml-4 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b shrink-0" onClick={(e) => e.stopPropagation()}>
          <div ref={sugWrapRef} className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input value={searchQ} onChange={e => handleSearch(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSug(true)}
              placeholder={TOKEN ? "Search for a barangay, building, or landmark…" : "No Mapbox token — search unavailable"}
              disabled={!TOKEN} className="pl-9 pr-8 h-9 text-sm" />
            {searching
              ? <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-gray-400" />
              : searchQ && <button type="button" onClick={() => { setSearchQ(""); setSuggestions([]); setShowSug(false); }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
            {showSug && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                {suggestions.map((f: any) => (
                  <button key={f.id} type="button" onMouseDown={() => pickSuggestion(f)}
                    className="w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-start gap-2.5 border-b border-gray-100 last:border-0 transition-colors">
                    <MapPin className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">{f.text}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{f.place_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative shrink-0" style={{ height: 360 }} onClick={(e) => e.stopPropagation()}>
          {/* The container is ALWAYS in the DOM — map renders here once and stays */}
          <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: 360 }} />

          {!mapReady && (
            <div className="absolute inset-0 bg-gray-100 z-10 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <p className="text-xs text-gray-500">Loading map…</p>
            </div>
          )}
          {!TOKEN && mapReady && (
            <div className="absolute inset-0 bg-gray-50 z-10 flex flex-col items-center justify-center gap-3 p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Map Unavailable</p>
                <p className="text-xs text-gray-500 mt-1">NEXT_PUBLIC_MAPBOX_TOKEN is not configured</p>
              </div>
            </div>
          )}
          {mapReady && TOKEN && (
            <button type="button" onClick={toggleStyle}
              className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm border border-white/60 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md hover:bg-white transition-all">
              {mapStyle === "outdoors" ? "🛰 Satellite" : "🗺 Streets"}
            </button>
          )}
          {mapReady && !picked && !geocoding && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none flex items-center gap-1.5 whitespace-nowrap">
              <Navigation className="w-3.5 h-3.5" />
              Click anywhere to drop a pin
            </div>
          )}
          {geocoding && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 text-gray-700 text-xs px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
              Getting location name…
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-white flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex-1 min-w-0">
            {picked ? (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug break-words">{picked.placeName}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No location pinned yet</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}>Cancel</Button>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleConfirm(); }} disabled={!picked || geocoding}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Use This Location
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
