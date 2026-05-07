"use client";

import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { fmtTime, userColor, userInitials } from "./utils";
import type { VideoNote } from "./types";

export type SharedViewer = {
  userId: string;
  currentSec: number;
  isSelf: boolean;
  name: string;
  avatarUrl?: string;
};

export type PlayerControls = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (sec: number, absolute?: boolean) => void;
  seekBy: (deltaSec: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setSpeed: (rate: number) => void;
  isPlaying: () => boolean;
  setLoopAAtCurrent: () => void;
  setLoopBAtCurrent: () => void;
  clearLoop: () => void;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type PlayerProps = {
  videoId: string;
  startSec: number;
  seekToSec: number | null;
  notes: VideoNote[];
  sharedViewers?: SharedViewer[];
  showSharedViewers?: boolean;
  onProgress: (sec: number, duration: number) => void;
  onReady?: (controls: PlayerControls) => void;
  onPlayingChange?: (playing: boolean) => void;
  theater: boolean;
  setTheater: (next: boolean) => void;
};

export function VideoFlowPlayer({
  videoId,
  startSec,
  seekToSec,
  notes,
  sharedViewers,
  showSharedViewers,
  onProgress,
  onReady,
  onPlayingChange,
  theater,
  setTheater,
}: PlayerProps) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const playingStateRef = useRef(false);
  const readyRef = useRef(false);
  const initialSeekDoneRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [currentSec, setCurrentSec] = useState(startSec || 0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onPlayingChangeRef.current = onPlayingChange; }, [onPlayingChange]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!videoId) return;

    let disposed = false;
    readyRef.current = false;
    initialSeekDoneRef.current = false;
    setIsReady(false);
    setDuration(0);
    setLoopA(null);
    setLoopB(null);

    const load = () =>
      new Promise<void>((resolve) => {
        if ((window as any).YT?.Player) { resolve(); return; }
        const existing = document.querySelector("script[src='https://www.youtube.com/iframe_api']");
        (window as any).onYouTubeIframeAPIReady = () => resolve();
        if (!existing) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }
      });

    load().then(() => {
      if (disposed || !holderRef.current) return;
      playerRef.current?.destroy?.();
      playerRef.current = new (window as any).YT.Player(holderRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          start: Math.floor(startSec || 0),
          controls: 0,
          disablekb: 1,
          iv_load_policy: 3,
          playsinline: 1,
          fs: 0,
        },
        events: {
          onReady: (event: any) => {
            readyRef.current = true;
            setIsReady(true);

            try {
              const iframe: HTMLIFrameElement | null = event.target.getIframe?.() ?? null;
              if (iframe) {
                iframe.style.position = "absolute";
                iframe.style.inset = "0";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = "0";
                iframe.style.display = "block";
                iframe.removeAttribute("width");
                iframe.removeAttribute("height");
                iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
                iframe.setAttribute("allowfullscreen", "true");
              }
            } catch { /* ignore */ }

            const dur = Math.floor(event.target.getDuration?.() || 0);
            if (dur > 0) setDuration(dur);

            const target = pendingSeekRef.current ?? (startSec > 0 ? startSec : null);
            if (target !== null && target > 0) {
              event.target.seekTo(target, true);
              initialSeekDoneRef.current = true;
              pendingSeekRef.current = null;
              setCurrentSec(target);
            }

            try {
              const v = event.target.getVolume?.() ?? 80;
              setVolume(v);
              setMuted(Boolean(event.target.isMuted?.()));
            } catch { /* ignore */ }

            onReadyRef.current?.(buildControls());
          },
          onStateChange: (event: any) => {
            const YT = (window as any).YT;
            const playing = event.data === YT?.PlayerState?.PLAYING;
            playingStateRef.current = playing;
            setIsPlaying(playing);
            onPlayingChangeRef.current?.(playing);
          },
          onPlaybackRateChange: (event: any) => {
            setSpeedState(event.data ?? 1);
          },
        },
      });
    });

    function buildControls(): PlayerControls {
      return {
        play: () => playerRef.current?.playVideo?.(),
        pause: () => playerRef.current?.pauseVideo?.(),
        toggle: () => {
          if (playingStateRef.current) playerRef.current?.pauseVideo?.();
          else playerRef.current?.playVideo?.();
        },
        seekTo: (sec, absolute = true) => {
          const target = absolute ? sec : (playerRef.current?.getCurrentTime?.() ?? 0) + sec;
          playerRef.current?.seekTo?.(Math.max(0, target), true);
        },
        seekBy: (delta) => {
          const t = (playerRef.current?.getCurrentTime?.() ?? 0) + delta;
          playerRef.current?.seekTo?.(Math.max(0, t), true);
        },
        getCurrentTime: () => Math.floor(playerRef.current?.getCurrentTime?.() ?? 0),
        getDuration: () => Math.floor(playerRef.current?.getDuration?.() ?? 0),
        setSpeed: (rate) => playerRef.current?.setPlaybackRate?.(rate),
        isPlaying: () => playingStateRef.current,
        setLoopAAtCurrent: () => {
          const t = Math.floor(playerRef.current?.getCurrentTime?.() ?? 0);
          setLoopA(t);
        },
        setLoopBAtCurrent: () => {
          const t = Math.floor(playerRef.current?.getCurrentTime?.() ?? 0);
          setLoopB(t);
        },
        clearLoop: () => { setLoopA(null); setLoopB(null); },
      };
    }

    const timer = window.setInterval(() => {
      if (!readyRef.current) return;
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const sec = Math.floor(player.getCurrentTime() || 0);
      const dur = Math.floor(player.getDuration?.() || 0);
      setCurrentSec(sec);
      if (dur && dur !== duration) setDuration(dur);
      onProgressRef.current(sec, dur);
    }, 1000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!isReady) return;
    if (initialSeekDoneRef.current) return;
    if (startSec <= 0) return;
    const cur = playerRef.current?.getCurrentTime?.() ?? 0;
    if (Math.abs(cur - startSec) > 2) {
      playerRef.current?.seekTo?.(startSec, true);
    }
    initialSeekDoneRef.current = true;
    setCurrentSec(startSec);
  }, [isReady, startSec]);

  useEffect(() => {
    if (seekToSec === null) return;
    if (!isReady || !playerRef.current?.seekTo) {
      pendingSeekRef.current = seekToSec;
      return;
    }
    playerRef.current.seekTo(seekToSec, true);
    initialSeekDoneRef.current = true;
  }, [seekToSec, isReady]);

  useEffect(() => {
    if (loopA === null || loopB === null) return;
    if (loopB <= loopA) return;
    if (currentSec >= loopB) {
      playerRef.current?.seekTo?.(loopA, true);
    }
  }, [currentSec, loopA, loopB]);

  function handleScrub(event: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const target = Math.floor(ratio * duration);
    playerRef.current?.seekTo?.(target, true);
  }

  function changeVolume(next: number) {
    const clamped = Math.max(0, Math.min(100, next));
    setVolume(clamped);
    playerRef.current?.setVolume?.(clamped);
    if (clamped === 0) {
      playerRef.current?.mute?.();
      setMuted(true);
    } else if (muted) {
      playerRef.current?.unMute?.();
      setMuted(false);
    }
  }

  function toggleMute() {
    if (muted) {
      playerRef.current?.unMute?.();
      setMuted(false);
      if (volume === 0) {
        setVolume(50);
        playerRef.current?.setVolume?.(50);
      }
    } else {
      playerRef.current?.mute?.();
      setMuted(true);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapRef.current?.requestFullscreen?.();
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentSec / duration) * 100) : 0;
  const showOverlayPlay = isReady && !isPlaying;

  return (
    <section
      ref={wrapRef as any}
      className={`vf-player-wrap ${theater ? "vf-player-theater" : ""} ${fullscreen ? "vf-player-fullscreen" : ""}`}
    >
      <div className="vf-player-frame">
        <div ref={holderRef} className="vf-player-iframe-holder" />
        <button
          type="button"
          className="vf-player-click-overlay"
          onClick={() => playerRef.current?.[isPlaying ? "pauseVideo" : "playVideo"]?.()}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {showOverlayPlay && (
            <span className="vf-player-overlay-play">
              <Play size={28} />
            </span>
          )}
        </button>
      </div>

      <div className="vf-player-controls">
        <div className="vf-player-progress" onClick={handleScrub}>
          <div className="vf-player-progress-track">
            <span className="vf-player-progress-fill" style={{ width: `${progress}%` }} />
            {loopA !== null && duration > 0 && (
              <span
                className="vf-player-loop-bracket vf-loop-a"
                style={{ left: `${(loopA / duration) * 100}%` }}
                title={`Loop A: ${fmtTime(loopA)}`}
              />
            )}
            {loopB !== null && duration > 0 && (
              <span
                className="vf-player-loop-bracket vf-loop-b"
                style={{ left: `${(loopB / duration) * 100}%` }}
                title={`Loop B: ${fmtTime(loopB)}`}
              />
            )}
            {duration > 0 && notes.map((n) => (
              <button
                key={n._id}
                type="button"
                className={`vf-player-marker vf-marker-${n.kind}`}
                style={{ left: `${Math.min(99, (n.timestampSec / duration) * 100)}%` }}
                title={`${fmtTime(n.timestampSec)} · ${n.content.slice(0, 80)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playerRef.current?.seekTo?.(n.timestampSec, true);
                }}
              />
            ))}
            {duration > 0 && showSharedViewers && (sharedViewers ?? [])
              .filter((v) => !v.isSelf)
              .map((v) => {
                const color = userColor(v.userId);
                return (
                  <button
                    key={`pin-${v.userId}`}
                    type="button"
                    className="vf-viewer-pin"
                    style={{
                      left: `${Math.min(99, (v.currentSec / duration) * 100)}%`,
                      borderColor: color.hex,
                      background: color.bg,
                    }}
                    title={`${v.name} · ${fmtTime(v.currentSec)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playerRef.current?.seekTo?.(v.currentSec, true);
                    }}
                  >
                    {v.avatarUrl
                      ? <img src={v.avatarUrl} alt={v.name} />
                      : <span style={{ background: color.hex }}>{userInitials(v.name)}</span>}
                  </button>
                );
              })}
          </div>
        </div>

        <div className="vf-player-toolbar">
          <div className="vf-player-toolbar-left">
            <button
              className="vf-icon-btn vf-play-btn"
              onClick={() => playerRef.current?.[isPlaying ? "pauseVideo" : "playVideo"]?.()}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className="vf-icon-btn"
              onClick={() => playerRef.current?.seekTo?.(Math.max(0, (playerRef.current?.getCurrentTime?.() ?? 0) - 10), true)}
              title="Back 10s (J)"
              aria-label="Back 10 seconds"
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="vf-icon-btn"
              onClick={() => playerRef.current?.seekTo?.((playerRef.current?.getCurrentTime?.() ?? 0) + 10, true)}
              title="Forward 10s (L)"
              aria-label="Forward 10 seconds"
            >
              <RotateCw size={15} />
            </button>

            <div className="vf-volume-group">
              <button
                className="vf-icon-btn vf-volume-toggle"
                onClick={toggleMute}
                title={muted ? "Unmute" : "Mute"}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="vf-volume-slider"
              />
            </div>

            <span className="vf-player-time">{fmtTime(currentSec)} / {fmtTime(duration)}</span>
          </div>

          <div className="vf-player-toolbar-right">
            <div className="vf-loop-group" role="group" aria-label="A B loop">
              <button
                className={`vf-loop-btn ${loopA !== null ? "active" : ""}`}
                onClick={() => setLoopA(loopA === null ? currentSec : null)}
                title={loopA === null ? "Set loop start (Shift+A)" : `Clear loop start (${fmtTime(loopA)})`}
              >
                A {loopA !== null && <small>{fmtTime(loopA)}</small>}
              </button>
              <button
                className={`vf-loop-btn ${loopB !== null ? "active" : ""}`}
                onClick={() => setLoopB(loopB === null ? currentSec : null)}
                title={loopB === null ? "Set loop end (Shift+B)" : `Clear loop end (${fmtTime(loopB)})`}
                disabled={loopA === null}
              >
                B {loopB !== null && <small>{fmtTime(loopB)}</small>}
              </button>
              {(loopA !== null || loopB !== null) && (
                <button
                  className="vf-loop-btn vf-loop-clear"
                  onClick={() => { setLoopA(null); setLoopB(null); }}
                  title="Clear loop"
                >
                  <Repeat size={13} />
                </button>
              )}
            </div>

            <label className="vf-speed-select">
              <span>Speed</span>
              <select
                value={speed}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  setSpeedState(rate);
                  playerRef.current?.setPlaybackRate?.(rate);
                }}
              >
                {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
              </select>
            </label>

            <button
              className="vf-icon-btn"
              onClick={() => setTheater(!theater)}
              title={theater ? "Exit theater (T)" : "Theater mode (T)"}
              aria-label="Toggle theater mode"
            >
              {theater ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="vf-icon-btn"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label="Toggle fullscreen"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
