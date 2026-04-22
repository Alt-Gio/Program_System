"use client";

import { useEffect, useRef, useState } from "react";
import {
  countQueued,
  drainLocalQueue,
  enqueueBooking,
  generateClientId,
  type BookingPayload,
} from "@/lib/meeting-hall-offline";

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
.dtc-hall-root {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #06060f;
  color: #e8e8f0;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  position: relative;
}

/* Noise overlay */
.dtc-hall-root::before {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 0;
}

/* Header */
.mh-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 16px 48px;
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(to bottom, rgba(6,6,15,0.92), rgba(6,6,15,0.4) 70%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.mh-logo { display: flex; align-items: center; gap: 12px; }
.mh-logo-mark {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(99,82,255,0.2), rgba(0,56,168,0.15));
  border: 1px solid rgba(99,82,255,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
}
.mh-logo-name { font-size: 13px; font-weight: 700; color: #fff; letter-spacing: 0.02em; }
.mh-logo-sub { font-size: 10px; color: rgba(255,255,255,0.38); margin-top: 2px; letter-spacing: 0.04em; }
.mh-nav { display: flex; align-items: center; gap: 32px; }
.mh-nav a {
  font-size: 12.5px; font-weight: 500;
  color: rgba(255,255,255,0.55); text-decoration: none;
  transition: color 0.2s;
}
.mh-nav a:hover { color: #fff; }
.mh-btn-book {
  background: #fff; color: #06060f;
  font-size: 12.5px; font-weight: 700;
  padding: 9px 22px; border-radius: 22px;
  border: none; cursor: pointer; transition: all 0.2s;
  letter-spacing: 0.01em;
}
.mh-btn-book:hover { background: #e8e8f0; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,255,255,0.08); }

/* Hero */
.mh-hero {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 120px 24px 64px;
  position: relative; z-index: 1;
}
.mh-glow-1 {
  position: absolute; width: 720px; height: 720px; border-radius: 50%;
  background: radial-gradient(circle, rgba(99,82,255,0.14) 0%, transparent 70%);
  top: 8%; left: 50%; transform: translateX(-50%);
  pointer-events: none; filter: blur(20px);
}
.mh-glow-2 {
  position: absolute; width: 440px; height: 440px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,56,168,0.12) 0%, transparent 70%);
  bottom: 18%; right: 8%;
  pointer-events: none; filter: blur(24px);
}

.mh-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 20px;
  background: rgba(99,82,255,0.08);
  border: 1px solid rgba(99,82,255,0.2);
  font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.75); margin-bottom: 24px;
}
.mh-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: #6352FF; box-shadow: 0 0 10px #6352FF; }

.mh-hero-title {
  font-size: clamp(38px, 5.5vw, 76px);
  font-weight: 900; line-height: 1.02;
  text-align: center; letter-spacing: -0.035em;
  color: #fff; margin-bottom: 22px;
  max-width: 880px;
}
.mh-hero-title .grad {
  background: linear-gradient(135deg, #6352FF 0%, #a78bfa 50%, #4f7bff 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.mh-hero-sub {
  font-size: 15.5px; color: rgba(255,255,255,0.5); text-align: center;
  max-width: 540px; line-height: 1.7; margin-bottom: 52px; font-weight: 400;
}

/* 3D Card */
.mh-scene {
  perspective: 1600px;
  width: min(980px, 94vw);
  margin: 0 auto;
}
.mh-hall-card {
  position: relative;
  border-radius: 28px;
  transform-style: preserve-3d;
  transition: box-shadow 0.35s ease;
  cursor: pointer;
  will-change: transform;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.07),
    0 40px 100px rgba(0,0,0,0.7),
    0 0 180px rgba(99,82,255,0.14),
    0 0 60px rgba(0,56,168,0.08);
}
.mh-hall-card:hover {
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.14),
    0 60px 140px rgba(0,0,0,0.8),
    0 0 260px rgba(99,82,255,0.26),
    0 0 90px rgba(0,56,168,0.14);
}

.mh-hall-visual {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 28px;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, #08081a 0%, #0b0b20 40%, #07070f 100%);
}
.mh-ceiling { position: absolute; top: 0; left: 0; right: 0; height: 38%; background: linear-gradient(180deg, #0c0c22 0%, #0a0a1c 100%); }
.mh-ceiling::after {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(90deg, rgba(99,82,255,0.04) 0px, rgba(99,82,255,0.04) 1px, transparent 1px, transparent 80px);
}
.mh-floor { position: absolute; bottom: 0; left: 0; right: 0; height: 42%; background: linear-gradient(0deg, #050508 0%, #0c0c1e 100%); }
.mh-floor::before {
  content: ''; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(99,82,255,0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,82,255,0.09) 1px, transparent 1px);
  background-size: 56px 56px;
  transform: perspective(300px) rotateX(55deg) scaleX(1.4);
  transform-origin: top center;
}
.mh-floor::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 40%;
  background: linear-gradient(180deg, rgba(99,82,255,0.06) 0%, transparent 100%);
}
.mh-wall-l { position: absolute; top: 0; bottom: 0; left: 0; width: 12%; background: linear-gradient(90deg, #060612 0%, rgba(10,10,26,0.3) 100%); }
.mh-wall-r { position: absolute; top: 0; bottom: 0; right: 0; width: 12%; background: linear-gradient(270deg, #060612 0%, rgba(10,10,26,0.3) 100%); }
.mh-wall-l::after, .mh-wall-r::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 1px;
  background: linear-gradient(180deg, transparent, rgba(99,82,255,0.22), transparent);
}
.mh-wall-l::after { right: 0; }
.mh-wall-r::after { left: 0; }

.mh-screen {
  position: absolute; top: 5%; left: 50%; transform: translateX(-50%);
  width: 60%; height: 36%;
  background: linear-gradient(160deg, #12123a 0%, #0c0c28 60%, #0a0a20 100%);
  border: 1.5px solid rgba(99,82,255,0.38);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  box-shadow:
    0 0 40px rgba(99,82,255,0.22),
    0 0 80px rgba(99,82,255,0.08),
    inset 0 0 40px rgba(99,82,255,0.06);
}
.mh-screen::before {
  content: ''; position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(99,82,255,0.2) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(0,56,168,0.16) 0%, transparent 60%);
  animation: mhScreenPulse 4s ease-in-out infinite;
}
@keyframes mhScreenPulse { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
.mh-screen-content { position: relative; z-index: 1; text-align: center; padding: 0 20px; }
.mh-screen-logo {
  font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.8);
  letter-spacing: 0.3em;
  text-shadow: 0 0 20px rgba(99,82,255,0.8);
}
.mh-screen-bar {
  width: 80px; height: 2px; margin: 10px auto;
  background: linear-gradient(90deg, #6352FF, #a78bfa, #4f7bff);
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(99,82,255,0.7);
  animation: mhBarGlow 2s ease-in-out infinite alternate;
}
@keyframes mhBarGlow {
  from { box-shadow: 0 0 6px rgba(99,82,255,0.4); }
  to   { box-shadow: 0 0 20px rgba(99,82,255,1); }
}
.mh-screen-lines { display: flex; flex-direction: column; gap: 5px; align-items: center; }
.mh-screen-line { height: 1.5px; background: rgba(255,255,255,0.14); border-radius: 1px; }

.mh-screen-mount {
  position: absolute; top: 41%; left: 50%; transform: translateX(-50%);
  width: 2px; height: 6%;
  background: linear-gradient(180deg, rgba(99,82,255,0.35), transparent);
}

.mh-lights {
  position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  display: flex; gap: 80px; width: 70%; justify-content: center;
}
.mh-light {
  width: 6px; height: 6px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 8px 3px rgba(255,255,255,0.6), 0 0 20px 6px rgba(255,255,255,0.2);
  position: relative; margin-top: 4px;
}
.mh-light::before {
  content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  width: 110px; height: 200px;
  background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.01) 60%, transparent 100%);
  clip-path: polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%);
}
.mh-light::after {
  content: ''; position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  width: 14px; height: 14px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.15);
}

.mh-table {
  position: absolute; bottom: 21%; left: 50%; transform: translateX(-50%);
  width: 54%; height: 11%;
  background: linear-gradient(175deg, #1e1e40 0%, #141430 50%, #0f0f28 100%);
  border-radius: 6px;
  border: 1px solid rgba(99,82,255,0.3);
  display: flex; align-items: center; justify-content: center; gap: 12px;
  box-shadow:
    0 6px 30px rgba(0,0,0,0.6),
    0 0 0 1px rgba(99,82,255,0.1),
    inset 0 1px 0 rgba(255,255,255,0.05);
}
.mh-table::before {
  content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99,82,255,0.45), rgba(255,255,255,0.12), rgba(99,82,255,0.45), transparent);
}
.mh-table::after {
  content: ''; position: absolute; top: 100%; left: 5%; right: 5%; height: 80%;
  background: linear-gradient(180deg, rgba(30,30,64,0.35) 0%, transparent 100%);
  border-radius: 0 0 6px 6px;
  filter: blur(2px);
}
.mh-chair-row { position: absolute; display: flex; gap: 14px; }
.mh-chair {
  width: 14px; height: 12px; border-radius: 3px;
  background: linear-gradient(180deg, #252550, #18183a);
  border: 1px solid rgba(99,82,255,0.4);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  position: relative;
}
.mh-chair::after {
  content: ''; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
  width: 10px; height: 8px;
  background: linear-gradient(180deg, #2a2a58, #1e1e46);
  border-radius: 2px 2px 0 0;
  border: 1px solid rgba(99,82,255,0.3);
  border-bottom: none;
}
.mh-ambient {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 80%; height: 50%;
  background:
    radial-gradient(ellipse at 30% 100%, rgba(99,82,255,0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 100%, rgba(0,56,168,0.08) 0%, transparent 50%);
}
.mh-screen-glow {
  position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 50%; height: 60%;
  background: radial-gradient(ellipse at 50% 0%, rgba(99,82,255,0.07) 0%, transparent 70%);
  pointer-events: none;
}
.mh-silhouette { position: absolute; bottom: 32%; width: 16px; display: flex; flex-direction: column; align-items: center; }
.mh-sil-head { width: 8px; height: 8px; border-radius: 50%; background: rgba(99,82,255,0.28); border: 1px solid rgba(99,82,255,0.45); }
.mh-sil-body { width: 12px; height: 10px; background: linear-gradient(180deg, rgba(99,82,255,0.22), rgba(99,82,255,0.1)); border-radius: 3px 3px 0 0; }

.mh-shine {
  position: absolute; inset: 0; border-radius: 28px; pointer-events: none;
  background: radial-gradient(circle at var(--mx, 50%) var(--my, 30%), rgba(255,255,255,0.08) 0%, transparent 60%);
  opacity: 0; transition: opacity 0.3s;
  z-index: 5;
}
.mh-hall-card:hover .mh-shine { opacity: 1; }

.mh-depth {
  position: absolute; inset: -2px; border-radius: 30px; background: transparent;
  border: 1px solid rgba(99,82,255,0.15);
  transform: translateZ(-20px);
  pointer-events: none;
}

.mh-badge {
  position: absolute; top: 20px; left: 20px; z-index: 10;
  display: flex; align-items: center; gap: 6px;
  background: rgba(6,6,15,0.72); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 22px; padding: 7px 14px;
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.78);
}
.mh-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: mhPulse 2s infinite; }
@keyframes mhPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.75)} }
.mh-cap {
  position: absolute; top: 20px; right: 20px; z-index: 10;
  background: rgba(99,82,255,0.2); backdrop-filter: blur(12px);
  border: 1px solid rgba(99,82,255,0.34);
  border-radius: 22px; padding: 7px 14px;
  font-size: 11px; font-weight: 700; color: #c4b5fd;
}

/* Stats row */
.mh-stats {
  display: flex; gap: 0; margin-top: 44px;
  width: min(980px, 94vw);
  background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px; overflow: hidden;
  backdrop-filter: blur(10px);
}
.mh-stat { flex: 1; padding: 22px 20px; text-align: center; border-right: 1px solid rgba(255,255,255,0.05); }
.mh-stat:last-child { border-right: none; }
.mh-stat-val { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
.mh-stat-lbl { font-size: 10.5px; color: rgba(255,255,255,0.35); margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }

/* Sections */
.mh-section { padding: 110px 48px; max-width: 1160px; margin: 0 auto; position: relative; z-index: 1; }
.mh-section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #a78bfa; margin-bottom: 14px;
}
.mh-section-title {
  font-size: clamp(30px, 3.8vw, 52px); font-weight: 800; color: #fff;
  letter-spacing: -0.028em; line-height: 1.1; max-width: 620px;
}
.mh-section-sub { font-size: 14.5px; color: rgba(255,255,255,0.44); margin-top: 16px; max-width: 480px; line-height: 1.7; }

.mh-amenity-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 52px;
}
.mh-amenity {
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 18px; padding: 26px;
  transition: all 0.25s;
  cursor: default;
}
.mh-amenity:hover {
  background: linear-gradient(180deg, rgba(99,82,255,0.08), rgba(99,82,255,0.03));
  border-color: rgba(99,82,255,0.25);
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(99,82,255,0.08);
}
.mh-amenity-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(99,82,255,0.14);
  border: 1px solid rgba(99,82,255,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; margin-bottom: 16px;
}
.mh-amenity-name { font-size: 14.5px; font-weight: 700; color: #e8e8f0; margin-bottom: 6px; }
.mh-amenity-desc { font-size: 12.5px; color: rgba(255,255,255,0.42); line-height: 1.65; }

/* Info grid (no pricing) */
.mh-info {
  padding: 0 48px 60px; max-width: 1160px; margin: 0 auto;
  position: relative; z-index: 1;
}
.mh-info-grid {
  display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 18px;
}
.mh-info-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px; padding: 28px;
}
.mh-info-card.accent {
  background: linear-gradient(160deg, rgba(99,82,255,0.12), rgba(0,56,168,0.05));
  border-color: rgba(99,82,255,0.24);
}
.mh-info-label {
  font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,0.42);
  letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 16px;
}
.mh-info-title { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 8px; letter-spacing: -0.01em; }
.mh-info-body { font-size: 13px; color: rgba(255,255,255,0.58); line-height: 1.7; }
.mh-info-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.65); margin-bottom: 10px; line-height: 1.55; }
.mh-info-row .check { color: #a78bfa; font-weight: 700; flex-shrink: 0; }
.mh-info-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 18px 0; }

/* Submit button (hero + sticky) */
.mh-cta-wrap { margin-top: 44px; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.mh-btn-primary {
  padding: 14px 28px;
  background: linear-gradient(135deg, #6352FF, #4f7bff);
  color: #fff; border: none; border-radius: 14px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.25s; letter-spacing: 0.01em;
  display: inline-flex; align-items: center; gap: 8px;
  box-shadow: 0 10px 40px rgba(99,82,255,0.25);
}
.mh-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 50px rgba(99,82,255,0.4); }
.mh-btn-ghost {
  padding: 14px 26px;
  background: rgba(255,255,255,0.04);
  color: #fff; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.mh-btn-ghost:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }

/* Modal */
.mh-modal-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(3,3,9,0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s ease;
  padding: 24px;
}
.mh-modal-overlay.visible { opacity: 1; pointer-events: all; }
.mh-modal {
  background: #0c0c22;
  border: 1px solid rgba(99,82,255,0.26);
  border-radius: 24px;
  max-width: 640px; width: 100%;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  box-shadow: 0 40px 120px rgba(0,0,0,0.7), 0 0 90px rgba(99,82,255,0.2);
  transform: scale(0.94) translateY(18px);
  transition: transform 0.28s ease;
  display: flex; flex-direction: column;
}
.mh-modal-overlay.visible .mh-modal { transform: scale(1) translateY(0); }
.mh-modal-head {
  padding: 26px 32px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
}
.mh-modal-head h2 { font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.02em; }
.mh-modal-head p { font-size: 12.5px; color: rgba(255,255,255,0.45); margin-top: 4px; line-height: 1.5; }
.mh-modal-close {
  width: 32px; height: 32px; border-radius: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.6); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: all 0.15s;
  flex-shrink: 0;
}
.mh-modal-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
.mh-modal-body { padding: 26px 32px 12px; overflow-y: auto; flex: 1; }
.mh-modal-foot {
  padding: 18px 32px 26px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.15);
}

.mh-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.mh-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.mh-field label {
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.5); letter-spacing: 0.06em; text-transform: uppercase;
}
.mh-field input, .mh-field select, .mh-field textarea {
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 11px 14px;
  font-size: 13.5px; color: #e8e8f0; font-family: inherit;
  outline: none; transition: all 0.15s;
  width: 100%;
}
.mh-field input::placeholder, .mh-field textarea::placeholder { color: rgba(255,255,255,0.22); }
.mh-field input:focus, .mh-field select:focus, .mh-field textarea:focus {
  border-color: rgba(99,82,255,0.55);
  background: rgba(99,82,255,0.06);
  box-shadow: 0 0 0 3px rgba(99,82,255,0.12);
}
.mh-field select option { background: #12122a; color: #e8e8f0; }
.mh-field textarea { resize: vertical; min-height: 84px; }

.mh-btn-submit {
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, #6352FF, #4f7bff);
  color: #fff; border: none; border-radius: 12px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.01em;
}
.mh-btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 32px rgba(99,82,255,0.35); }
.mh-btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

.mh-success { padding: 42px 32px; text-align: center; }
.mh-success-icon {
  width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 18px;
  background: rgba(34,197,94,0.14); border: 1.5px solid rgba(34,197,94,0.38);
  display: flex; align-items: center; justify-content: center;
  font-size: 32px;
}
.mh-success h3 { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 10px; }
.mh-success p { font-size: 13px; color: rgba(255,255,255,0.48); line-height: 1.7; max-width: 380px; margin: 0 auto 24px; }

/* Footer */
.mh-footer {
  padding: 40px 48px; border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
  position: relative; z-index: 1;
}
.mh-footer-left { font-size: 12px; color: rgba(255,255,255,0.3); }
.mh-footer-flag { display: flex; height: 3px; width: 48px; border-radius: 2px; overflow: hidden; margin-top: 10px; }

/* Divider */
.mh-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); margin: 0 48px; }

/* Connectivity banner */
.mh-net-banner {
  position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
  z-index: 250;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 10px 18px; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; letter-spacing: 0.01em;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  max-width: calc(100vw - 32px);
}
.mh-net-banner.offline {
  background: rgba(244,63,94,0.16);
  border: 1px solid rgba(244,63,94,0.35);
  color: #fecdd3;
}
.mh-net-banner.queued {
  background: rgba(245,158,11,0.14);
  border: 1px solid rgba(245,158,11,0.35);
  color: #fde68a;
}
.mh-net-banner.online {
  background: rgba(34,197,94,0.14);
  border: 1px solid rgba(34,197,94,0.35);
  color: #bbf7d0;
}
.mh-net-dot { width: 7px; height: 7px; border-radius: 50%; }
.mh-net-banner.offline .mh-net-dot { background: #f43f5e; }
.mh-net-banner.queued .mh-net-dot { background: #f59e0b; animation: mhPulse 1.6s infinite; }
.mh-net-banner.online .mh-net-dot { background: #22c55e; }
.mh-net-btn {
  background: rgba(255,255,255,0.1); color: inherit;
  border: 1px solid rgba(255,255,255,0.15);
  padding: 5px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
  cursor: pointer; transition: background 0.15s;
}
.mh-net-btn:hover { background: rgba(255,255,255,0.18); }

/* Responsive */
@media (max-width: 860px) {
  .mh-info-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .mh-header { padding: 12px 16px; }
  .mh-nav { display: none; }
  .mh-logo-sub { display: none; }
  .mh-logo-name { font-size: 12px; }
  .mh-btn-book { padding: 8px 16px; font-size: 12px; }
  .mh-amenity-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .mh-amenity { padding: 20px; }
  .mh-section { padding: 70px 18px; }
  .mh-info { padding: 0 18px 48px; }
  .mh-footer { padding: 28px 18px; }
  .mh-form-row { grid-template-columns: 1fr; gap: 0; }
  .mh-modal { border-radius: 20px; max-height: calc(100vh - 32px); }
  .mh-modal-head { padding: 20px 20px 16px; }
  .mh-modal-body { padding: 20px 20px 8px; }
  .mh-modal-foot { padding: 14px 20px 22px; }
  .mh-modal-head h2 { font-size: 18px; }
  .mh-stats { flex-wrap: wrap; }
  .mh-stat { flex: 1 1 50%; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 18px 12px; }
  .mh-stat-val { font-size: 24px; }
  .mh-hero { padding: 110px 18px 48px; }
  .mh-hero-sub { font-size: 14.5px; margin-bottom: 36px; }
  .mh-cta-wrap { margin-top: 32px; }
  .mh-btn-primary, .mh-btn-ghost { width: 100%; justify-content: center; }
  /* iOS Safari zooms on inputs below 16px — lift to 16px on mobile. */
  .mh-field input, .mh-field select, .mh-field textarea { font-size: 16px; padding: 12px 14px; }
  .mh-net-banner { font-size: 12px; padding: 9px 14px; }
}
@media (max-width: 480px) {
  .mh-amenity-grid { grid-template-columns: 1fr; }
  .mh-section { padding: 56px 16px; }
  .mh-footer { flex-direction: column; align-items: flex-start; }
}

/* Safe-area insets (installed PWA on iOS/Android with notches) */
@supports (padding: max(0px)) {
  .mh-header { padding-top: max(16px, env(safe-area-inset-top)); }
  .mh-footer { padding-bottom: max(40px, env(safe-area-inset-bottom)); }
  .mh-net-banner { bottom: max(18px, env(safe-area-inset-bottom)); }
}
`;

type FormState = {
  fullName: string;
  designation: string;
  agency: string;
  email: string;
  phone: string;
  date: string;
  timeSlot: string;
  attendees: string;
  eventType: string;
  purpose: string;
};

const initialForm: FormState = {
  fullName: "",
  designation: "",
  agency: "",
  email: "",
  phone: "",
  date: "",
  timeSlot: "",
  attendees: "",
  eventType: "",
  purpose: "",
};

type SubmissionOutcome = "synced" | "queued";

export default function MeetingHallPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [outcome, setOutcome] = useState<SubmissionOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [draining, setDraining] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  // 3D tilt + idle float
  useEffect(() => {
    const card = cardRef.current;
    const shine = shineRef.current;
    const scene = sceneRef.current;
    if (!card || !shine || !scene) return;

    let targetRX = 0,
      targetRY = 0,
      currentRX = 0,
      currentRY = 0;
    let idleT = 0;
    let mouseActive = false;
    let raf = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      currentRX = lerp(currentRX, targetRX, 0.1);
      currentRY = lerp(currentRY, targetRY, 0.1);

      if (!mouseActive) {
        idleT += 0.008;
        const floatY = Math.sin(idleT) * 1.4;
        const floatX = Math.cos(idleT * 0.7) * 0.7;
        card.style.transform = `rotateX(${floatX}deg) rotateY(${floatY}deg) scale(1)`;
      } else {
        card.style.transform = `rotateX(${currentRX}deg) rotateY(${currentRY}deg) scale(1.02)`;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = scene.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      targetRX = -dy * 9;
      targetRY = dx * 12;

      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      shine.style.setProperty("--mx", `${mx}%`);
      shine.style.setProperty("--my", `${my}%`);
      mouseActive = true;
    };

    const onLeave = () => {
      targetRX = 0;
      targetRY = 0;
      setTimeout(() => {
        mouseActive = false;
      }, 400);
    };

    scene.addEventListener("mousemove", onMove);
    scene.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      scene.removeEventListener("mousemove", onMove);
      scene.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Lock body scroll while modal open
  useEffect(() => {
    if (bookingOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [bookingOpen]);

  // Service worker registration + online/offline + queue drain
  useEffect(() => {
    let cancelled = false;

    // SW registration is handled globally by <ServiceWorkerRegistrar />.

    const refreshCount = async () => {
      const n = await countQueued();
      if (!cancelled) setQueuedCount(n);
    };

    const drain = async () => {
      if (!navigator.onLine) return;
      setDraining(true);
      try {
        // Nudge the SW (does nothing if Background Sync already handled it).
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "dtc-drain",
          });
        }
        await drainLocalQueue();
      } finally {
        if (!cancelled) setDraining(false);
        await refreshCount();
      }
    };

    const onOnline = () => {
      setIsOnline(true);
      drain();
    };
    const onOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    refreshCount();
    if (navigator.onLine) drain();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const onSwMessage = (evt: MessageEvent) => {
      if (evt.data?.type === "dtc-sync-result") refreshCount();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    // Support the manifest shortcut ?open=book
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("open") === "book") setBookingOpen(true);
    } catch {}

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);

  function openBooking() {
    setSuccess(false);
    setOutcome(null);
    setSubmitError(null);
    setBookingOpen(true);
  }
  function closeBooking() {
    setBookingOpen(false);
    setTimeout(() => {
      if (success) {
        setForm(initialForm);
        setSuccess(false);
        setOutcome(null);
      }
    }, 300);
  }

  async function manualRetry() {
    setDraining(true);
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "dtc-hall-drain",
        });
      }
      await drainLocalQueue();
    } finally {
      setDraining(false);
      setQueuedCount(await countQueued());
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    form.fullName.trim() &&
    form.agency.trim() &&
    form.email.trim() &&
    form.date &&
    form.timeSlot &&
    form.attendees &&
    form.eventType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const payload: BookingPayload = {
      clientId: generateClientId(),
      fullName: form.fullName.trim(),
      designation: form.designation.trim() || undefined,
      agency: form.agency.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      date: form.date,
      timeSlot: form.timeSlot,
      attendees: form.attendees,
      eventType: form.eventType,
      purpose: form.purpose.trim() || undefined,
      clientSubmittedAt: Date.now(),
      submittedOffline: !navigator.onLine,
    };

    try {
      const res = await fetch("/api/meeting-hall/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (res.status === 202 && data?.queued) {
        // SW intercepted an offline POST and queued it.
        setOutcome("queued");
        setSuccess(true);
        setQueuedCount(await countQueued());
      } else if (res.ok && data?.ok) {
        setOutcome("synced");
        setSuccess(true);
      } else {
        throw new Error(data?.error || `Server responded ${res.status}`);
      }
    } catch (networkErr) {
      // Network dead and SW didn't intercept (e.g. first visit before SW
      // activated, or no SW support). Fall back to local IDB queue.
      try {
        await enqueueBooking(payload);
        setOutcome("queued");
        setSuccess(true);
        setQueuedCount(await countQueued());
      } catch (idbErr: any) {
        setSubmitError(
          idbErr?.message || "Couldn't save your request. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dtc-hall-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Header */}
      <header className="mh-header">
        <div className="mh-logo">
          <div className="mh-logo-mark" aria-hidden>
            🏛️
          </div>
          <div>
            <div className="mh-logo-name">Digital Transformation Center</div>
            <div className="mh-logo-sub">DICT Regional Office V · Bicol Region</div>
          </div>
        </div>
        <nav className="mh-nav">
          <a href="#amenities">Amenities</a>
          <a href="#details">Details</a>
          <a href="#location">Location</a>
        </nav>
        <button className="mh-btn-book" onClick={openBooking}>
          Request Booking
        </button>
      </header>

      {/* Hero */}
      <section className="mh-hero">
        <div className="mh-glow-1" />
        <div className="mh-glow-2" />

        <div className="mh-eyebrow">
          <div className="mh-eyebrow-dot" />
          DTC Meeting Hall · Legazpi City, Albay
        </div>

        <h1 className="mh-hero-title">
          Meet, train, and transform at the{" "}
          <span className="grad">Digital Transformation Center</span>
        </h1>

        <p className="mh-hero-sub">
          A professional meeting hall built for modern government work — outfitted
          with dedicated fiber, 4K projection, and AV that just works. Available
          to public agencies, partner organizations, and private events.
        </p>

        {/* 3D Hall Card */}
        <div className="mh-scene" ref={sceneRef}>
          <div className="mh-hall-card" ref={cardRef}>
            <div className="mh-shine" ref={shineRef} />
            <div className="mh-depth" />

            <div className="mh-hall-visual">
              <div className="mh-ceiling" />
              <div className="mh-wall-l" />
              <div className="mh-wall-r" />

              <div className="mh-lights">
                <div className="mh-light" />
                <div className="mh-light" style={{ opacity: 0.7 }} />
                <div className="mh-light" />
                <div className="mh-light" style={{ opacity: 0.7 }} />
                <div className="mh-light" />
              </div>

              <div className="mh-screen">
                <div className="mh-screen-content">
                  <div className="mh-screen-logo">DICT · DTC</div>
                  <div className="mh-screen-bar" />
                  <div className="mh-screen-lines">
                    <div className="mh-screen-line" style={{ width: 80 }} />
                    <div className="mh-screen-line" style={{ width: 56 }} />
                    <div className="mh-screen-line" style={{ width: 68 }} />
                  </div>
                </div>
              </div>

              <div
                className="mh-chair-row"
                style={{ bottom: "38%", left: "50%", transform: "translateX(-50%)" }}
              >
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={`top-${i}`} className="mh-chair" />
                ))}
              </div>

              {[28, 38, 48, 58, 68].map((left) => (
                <div key={left} className="mh-silhouette" style={{ left: `${left}%` }}>
                  <div className="mh-sil-head" />
                  <div className="mh-sil-body" />
                </div>
              ))}

              <div className="mh-table">
                <div style={{ width: 30, height: 3, background: "rgba(99,82,255,0.55)", borderRadius: 2 }} />
                <div style={{ width: 18, height: 3, background: "rgba(167,139,250,0.35)", borderRadius: 2 }} />
                <div style={{ width: 30, height: 3, background: "rgba(99,82,255,0.55)", borderRadius: 2 }} />
              </div>

              <div className="mh-screen-mount" />

              <div
                className="mh-chair-row"
                style={{ bottom: "14%", left: "50%", transform: "translateX(-50%)" }}
              >
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={`bot-${i}`} className="mh-chair" />
                ))}
              </div>

              <div className="mh-floor" />
              <div className="mh-ambient" />
              <div className="mh-screen-glow" />
            </div>

            <div className="mh-badge">
              <div className="mh-live-dot" />
              Open for Booking
            </div>
            <div className="mh-cap">Up to 50 pax</div>
          </div>
        </div>

        {/* Stats */}
        <div className="mh-stats">
          <div className="mh-stat">
            <div className="mh-stat-val">50</div>
            <div className="mh-stat-lbl">Max Seating</div>
          </div>
          <div className="mh-stat">
            <div className="mh-stat-val">4K</div>
            <div className="mh-stat-lbl">Projection</div>
          </div>
          <div className="mh-stat">
            <div className="mh-stat-val">
              200<span style={{ fontSize: 16, opacity: 0.45 }}>mbps</span>
            </div>
            <div className="mh-stat-lbl">Fiber Internet</div>
          </div>
          <div className="mh-stat">
            <div className="mh-stat-val">Full AV</div>
            <div className="mh-stat-lbl">Included</div>
          </div>
        </div>

        <div className="mh-cta-wrap">
          <button className="mh-btn-primary" onClick={openBooking}>
            Request Booking →
          </button>
          <a href="#amenities" className="mh-btn-ghost" style={{ textDecoration: "none" }}>
            See what's included
          </a>
        </div>
      </section>

      {/* Amenities */}
      <section className="mh-section" id="amenities" style={{ paddingTop: 60 }}>
        <div className="mh-section-label">Facilities & Amenities</div>
        <h2 className="mh-section-title">Everything set up for you.</h2>
        <p className="mh-section-sub">
          Built around the way government teams actually run trainings and meetings —
          reliable connectivity, presentation-ready AV, and comfortable seating.
        </p>

        <div className="mh-amenity-grid">
          {[
            { icon: "📡", name: "High-Speed Fiber Internet", desc: "Dedicated 200 Mbps fiber line — no throttling, no sharing with other offices." },
            { icon: "🖥️", name: "4K Projector + Screen", desc: "Laser 4K projector on a 120-inch motorized screen for crisp presentations." },
            { icon: "🎙️", name: "PA / Sound System", desc: "Wireless handhelds, a podium mic, and a balanced full-room speaker array." },
            { icon: "📹", name: "Livestream Ready", desc: "HDMI/USB-C at the podium, OBS-capable PC for hybrid meetings and streaming." },
            { icon: "❄️", name: "Climate Control", desc: "Centralized inverter AC keeps the hall comfortable for all-day sessions." },
            { icon: "🪑", name: "Flexible Seating", desc: "Modular chairs and tables — classroom, U-shape, or banquet arrangements." },
            { icon: "🔌", name: "Power + UPS", desc: "Uninterruptible power backing the AV stack so presentations don't drop." },
            { icon: "♿", name: "Accessible Venue", desc: "Ground-floor access, ramp entry, and accessible restroom facilities." },
            { icon: "☕", name: "Pantry Access", desc: "Shared kitchen with water dispensers, coffee setup, and refrigerator." },
          ].map((a) => (
            <div key={a.name} className="mh-amenity">
              <div className="mh-amenity-icon">{a.icon}</div>
              <div className="mh-amenity-name">{a.name}</div>
              <div className="mh-amenity-desc">{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mh-divider" />

      {/* Info grid (no pricing) */}
      <section className="mh-info" id="details" style={{ paddingTop: 80 }}>
        <div className="mh-section-label">What's Included</div>
        <h2 className="mh-section-title" style={{ marginBottom: 40 }}>
          A ready-to-use hall, set up on arrival.
        </h2>

        <div className="mh-info-grid">
          <div className="mh-info-card accent">
            <div className="mh-info-label">Every Booking Includes</div>
            <div className="mh-info-row"><span className="check">✓</span>High-speed internet access</div>
            <div className="mh-info-row"><span className="check">✓</span>Projector + sound system</div>
            <div className="mh-info-row"><span className="check">✓</span>Whiteboard + markers</div>
            <div className="mh-info-row"><span className="check">✓</span>On-site tech support</div>
            <div className="mh-info-row"><span className="check">✓</span>Pantry access</div>
            <div className="mh-info-row"><span className="check">✓</span>Free parking</div>
          </div>

          <div className="mh-info-card" id="location">
            <div className="mh-info-label">Location</div>
            <div className="mh-info-title">DICT Region V Office</div>
            <div className="mh-info-body">
              Legazpi City, Albay 4500<br />
              Bicol Region, Philippines
            </div>
            <div className="mh-info-divider" />
            <div className="mh-info-label" style={{ marginBottom: 8 }}>Operating Hours</div>
            <div className="mh-info-body">Monday – Friday<br />8:00 AM – 5:00 PM</div>
          </div>

          <div className="mh-info-card">
            <div className="mh-info-label">Contact the DTC Desk</div>
            <div className="mh-info-title">Get in touch</div>
            <div className="mh-info-body" style={{ marginTop: 10 }}>
              📞 (052) 742-5670
            </div>
            <div className="mh-info-body" style={{ marginTop: 6 }}>
              📧 dtc@dict.gov.ph
            </div>
            <div className="mh-info-divider" />
            <div className="mh-info-body" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Requests must be made at least 3 business days in advance. DICT
              reserves the right to reschedule bookings for official activities.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 44, display: "flex", justifyContent: "center" }}>
          <button className="mh-btn-primary" onClick={openBooking}>
            Request Booking →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mh-footer">
        <div className="mh-footer-left">
          <div>© 2026 DICT Regional Office V · Digital Transformation Center</div>
          <div style={{ marginTop: 4, fontSize: 10.5, color: "rgba(255,255,255,0.18)" }}>
            Serving Albay · Camarines Norte · Camarines Sur · Catanduanes · Masbate · Sorsogon
          </div>
          <div className="mh-footer-flag">
            <div style={{ flex: 1, background: "#0038A8" }} />
            <div style={{ flex: 1, background: "#CE1126" }} />
            <div style={{ flex: 1, background: "#FCD116" }} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Republic of the Philippines</div>
      </footer>

      {/* Booking Modal */}
      <div
        className={`mh-modal-overlay ${bookingOpen ? "visible" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeBooking();
        }}
      >
        <div className="mh-modal" role="dialog" aria-modal="true" aria-labelledby="mh-modal-title">
          {!success ? (
            <>
              <div className="mh-modal-head">
                <div>
                  <h2 id="mh-modal-title">Request a Booking</h2>
                  <p>
                    Fill this out and we'll confirm availability by email within 1–2 business days.
                  </p>
                </div>
                <button className="mh-modal-close" onClick={closeBooking} aria-label="Close">×</button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mh-modal-body">
                  <div className="mh-form-row">
                    <div className="mh-field">
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={(e) => update("fullName", e.target.value)}
                        placeholder="Juan A. dela Cruz"
                        required
                      />
                    </div>
                    <div className="mh-field">
                      <label>Designation</label>
                      <input
                        type="text"
                        value={form.designation}
                        onChange={(e) => update("designation", e.target.value)}
                        placeholder="Director, OIC, etc."
                      />
                    </div>
                  </div>

                  <div className="mh-field">
                    <label>Agency / Organization</label>
                    <input
                      type="text"
                      value={form.agency}
                      onChange={(e) => update("agency", e.target.value)}
                      placeholder="e.g. LGU Legazpi, DepEd Bicol"
                      required
                    />
                  </div>

                  <div className="mh-form-row">
                    <div className="mh-field">
                      <label>Contact Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="yourname@agency.gov.ph"
                        required
                      />
                    </div>
                    <div className="mh-field">
                      <label>Contact Number</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="09xx xxx xxxx"
                      />
                    </div>
                  </div>

                  <div className="mh-form-row">
                    <div className="mh-field">
                      <label>Preferred Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => update("date", e.target.value)}
                        required
                      />
                    </div>
                    <div className="mh-field">
                      <label>Time Slot</label>
                      <select
                        value={form.timeSlot}
                        onChange={(e) => update("timeSlot", e.target.value)}
                        required
                      >
                        <option value="">Select time</option>
                        <option>8:00 AM – 12:00 PM (AM)</option>
                        <option>1:00 PM – 5:00 PM (PM)</option>
                        <option>8:00 AM – 5:00 PM (Full Day)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mh-form-row">
                    <div className="mh-field">
                      <label>Expected Attendees</label>
                      <select
                        value={form.attendees}
                        onChange={(e) => update("attendees", e.target.value)}
                        required
                      >
                        <option value="">Select size</option>
                        <option>1 – 15 pax</option>
                        <option>16 – 30 pax</option>
                        <option>31 – 50 pax</option>
                      </select>
                    </div>
                    <div className="mh-field">
                      <label>Event Type</label>
                      <select
                        value={form.eventType}
                        onChange={(e) => update("eventType", e.target.value)}
                        required
                      >
                        <option value="">Select type</option>
                        <option>Training / Workshop</option>
                        <option>Seminar / Conference</option>
                        <option>Meeting / Huddle</option>
                        <option>Orientation</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="mh-field">
                    <label>Purpose / Description</label>
                    <textarea
                      value={form.purpose}
                      onChange={(e) => update("purpose", e.target.value)}
                      placeholder="Briefly describe your event and any special requirements…"
                    />
                  </div>
                </div>

                <div className="mh-modal-foot">
                  {submitError && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "10px 14px",
                        background: "rgba(244,63,94,0.1)",
                        border: "1px solid rgba(244,63,94,0.3)",
                        borderRadius: 10,
                        fontSize: 12.5,
                        color: "#fecdd3",
                      }}
                    >
                      {submitError}
                    </div>
                  )}
                  {!isOnline && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "10px 14px",
                        background: "rgba(245,158,11,0.1)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        borderRadius: 10,
                        fontSize: 12.5,
                        color: "#fde68a",
                      }}
                    >
                      You're offline — we'll save your request and submit it automatically when you reconnect.
                    </div>
                  )}
                  <button
                    type="submit"
                    className="mh-btn-submit"
                    disabled={!canSubmit || submitting}
                  >
                    {submitting
                      ? "Submitting…"
                      : isOnline
                        ? "Submit Booking Request →"
                        : "Save Request (Offline) →"}
                  </button>
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.28)",
                      marginTop: 10,
                      textAlign: "center",
                    }}
                  >
                    Your request will be reviewed within 1–2 business days.
                  </p>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mh-modal-head" style={{ borderBottom: "none" }}>
                <div style={{ flex: 1 }} />
                <button className="mh-modal-close" onClick={closeBooking} aria-label="Close">×</button>
              </div>
              <div className="mh-success">
                <div
                  className="mh-success-icon"
                  style={
                    outcome === "queued"
                      ? {
                          background: "rgba(245,158,11,0.14)",
                          borderColor: "rgba(245,158,11,0.38)",
                        }
                      : undefined
                  }
                >
                  {outcome === "queued" ? "⏱" : "✓"}
                </div>
                <h3>
                  {outcome === "queued"
                    ? "Saved — waiting for connection"
                    : "Request submitted"}
                </h3>
                {outcome === "queued" ? (
                  <p>
                    You're offline, but your request is safely saved on this
                    device. It will be submitted automatically the moment{" "}
                    <b style={{ color: "rgba(255,255,255,0.75)" }}>
                      {form.email}
                    </b>{" "}
                    is reachable. You can close this tab — it'll still go through.
                  </p>
                ) : (
                  <p>
                    Thanks,{" "}
                    <b style={{ color: "rgba(255,255,255,0.75)" }}>
                      {form.fullName || "friend"}
                    </b>
                    . We'll review your booking and send a confirmation to{" "}
                    <b style={{ color: "rgba(255,255,255,0.75)" }}>
                      {form.email}
                    </b>{" "}
                    within 1–2 business days.
                  </p>
                )}
                <button className="mh-btn-primary" onClick={closeBooking}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connectivity banner */}
      {(!isOnline || queuedCount > 0) && !bookingOpen && (
        <div
          className={`mh-net-banner ${
            !isOnline ? "offline" : queuedCount > 0 ? "queued" : "online"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="mh-net-dot" />
          {!isOnline && queuedCount === 0 && <span>Offline — this page still works.</span>}
          {!isOnline && queuedCount > 0 && (
            <span>
              Offline · {queuedCount} request{queuedCount === 1 ? "" : "s"} waiting to sync
            </span>
          )}
          {isOnline && queuedCount > 0 && (
            <>
              <span>
                {draining ? "Syncing…" : `${queuedCount} pending`}
              </span>
              {!draining && (
                <button className="mh-net-btn" onClick={manualRetry}>
                  Sync now
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
