"use client";

export type VoiceEngineState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export type VoiceMode = "off" | "push" | "wake";

export type VoiceEngineConfig = {
  language?: string;
  wakeWord?: string;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onStateChange?: (state: VoiceEngineState) => void;
  onError?: (error: string) => void;
  onWakeDetected?: () => void;
};

type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export class VoiceEngine {
  private recognition: any = null;
  private config: VoiceEngineConfig;
  private state: VoiceEngineState = "idle";
  private mode: VoiceMode = "off";
  private wakeArmed = false;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: VoiceEngineConfig) {
    this.config = config;
    this.init();
  }

  static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as AnyWindow;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  private init() {
    if (typeof window === "undefined") return;
    const w = window as AnyWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      this.config.onError?.("browser_unsupported");
      return;
    }

    const rec = new SR();
    rec.lang = this.config.language ?? "en-PH";
    // Wake mode uses continuous restart; push-to-talk uses one-shot.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.config.onInterimTranscript?.(interim);
      if (!final) return;

      const trimmed = final.trim();

      if (this.mode === "wake") {
        const lower = trimmed.toLowerCase();
        const wake = (this.config.wakeWord ?? "hey system").toLowerCase();

        if (!this.wakeArmed) {
          if (lower.includes(wake)) {
            this.wakeArmed = true;
            this.config.onWakeDetected?.();
            // Any remaining text after the wake word becomes the command
            const afterWake = trimmed.slice(lower.indexOf(wake) + wake.length).trim();
            if (afterWake.length > 3) {
              this.wakeArmed = false;
              this.config.onFinalTranscript(afterWake);
            }
          }
        } else {
          this.wakeArmed = false;
          this.config.onFinalTranscript(trimmed);
        }
      } else {
        this.config.onFinalTranscript(trimmed);
      }
    };

    rec.onstart = () => this.setState("listening");

    rec.onend = () => {
      if (this.state === "error") return;
      if (this.mode === "wake") {
        // Continuous loop while in wake mode
        this.restartTimeout = setTimeout(() => this.tryStart(), 250);
      } else {
        this.setState("idle");
      }
    };

    rec.onerror = (event: any) => {
      const err = event?.error ?? "unknown";
      if (err === "no-speech" || err === "aborted") {
        this.setState("idle");
        if (this.mode === "wake") {
          this.restartTimeout = setTimeout(() => this.tryStart(), 500);
        }
        return;
      }
      if (err === "not-allowed" || err === "service-not-allowed") {
        this.setState("error");
        this.config.onError?.("microphone_denied");
        return;
      }
      if (err === "network") {
        this.config.onError?.("network_error");
        if (this.mode === "wake") {
          this.restartTimeout = setTimeout(() => this.tryStart(), 2000);
        }
        return;
      }
      this.setState("error");
      this.config.onError?.(err);
    };

    this.recognition = rec;
  }

  // Push-to-talk one-shot listen — used when user clicks the orb.
  listenOnce() {
    if (!this.recognition) return;
    this.mode = "push";
    this.wakeArmed = false;
    this.tryStart();
  }

  // Always-on wake-word mode.
  startWakeMode() {
    if (!this.recognition) return;
    this.mode = "wake";
    this.wakeArmed = false;
    this.tryStart();
  }

  stop() {
    this.mode = "off";
    this.wakeArmed = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    try {
      this.recognition?.stop();
    } catch {
      // already stopped
    }
    this.setState("idle");
  }

  getMode(): VoiceMode {
    return this.mode;
  }

  getState(): VoiceEngineState {
    return this.state;
  }

  private tryStart() {
    if (!this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      // Already started — ignore
    }
  }

  private setState(state: VoiceEngineState) {
    if (this.state === state) return;
    this.state = state;
    this.config.onStateChange?.(state);
  }

  speak(text: string, onEnd?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.config.language ?? "en-PH";
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) u.voice = preferred;

    this.setState("speaking");
    u.onend = () => {
      this.setState("idle");
      onEnd?.();
    };
    u.onerror = () => {
      this.setState("idle");
      onEnd?.();
    };
    window.speechSynthesis.speak(u);
  }
}
