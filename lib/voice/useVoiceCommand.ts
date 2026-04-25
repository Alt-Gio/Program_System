"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConvex } from "convex/react";
import { VoiceEngine, type VoiceEngineState, type VoiceMode } from "./VoiceEngine";
import { parseIntent } from "./IntentParser";
import { executeVoiceIntent, type ActionResult } from "./ActionExecutor";

export type HistoryItem = {
  command: string;
  result: ActionResult;
  timestamp: number;
};

export type VoiceCommandState = {
  isSupported: boolean;
  engineState: VoiceEngineState;
  mode: VoiceMode;
  interimTranscript: string;
  lastCommand: string;
  lastResult: ActionResult | null;
  pendingConfirmation: ActionResult | null;
  errorMessage: string | null;
  showHelp: boolean;
  history: HistoryItem[];
};

export function useVoiceCommand() {
  const router = useRouter();
  const pathname = usePathname();
  const convex = useConvex();
  const engineRef = useRef<VoiceEngine | null>(null);

  const [state, setState] = useState<VoiceCommandState>({
    isSupported: VoiceEngine.isSupported(),
    engineState: "idle",
    mode: "off",
    interimTranscript: "",
    lastCommand: "",
    lastResult: null,
    pendingConfirmation: null,
    errorMessage: null,
    showHelp: false,
    history: [],
  });

  const speak = useCallback((text: string) => {
    engineRef.current?.speak(text);
  }, []);

  // Track context for the parser without re-subscribing the engine on nav
  const contextRef = useRef<{ currentPage: string; lastAction?: string }>({
    currentPage: "dashboard",
  });
  useEffect(() => {
    contextRef.current.currentPage =
      pathname?.split("/").filter(Boolean).pop() ?? "dashboard";
  }, [pathname]);

  const handleFinal = useCallback(
    async (transcript: string) => {
      const lower = transcript.toLowerCase().trim();

      // Special commands handled inline (fast path, no Groq call)
      if (lower === "help" || lower === "what can you do") {
        setState((s) => ({ ...s, showHelp: true, lastCommand: transcript }));
        speak("Here are the things I can do.");
        return;
      }
      if (
        lower === "stop listening" ||
        lower === "sleep" ||
        lower === "stop"
      ) {
        setState((s) => ({ ...s, mode: "off", lastCommand: transcript }));
        engineRef.current?.stop();
        speak("Going to sleep. Click the mic to wake me.");
        return;
      }

      setState((s) => ({
        ...s,
        lastCommand: transcript,
        engineState: "processing",
        interimTranscript: "",
      }));

      // Confirmation follow-up
      if (state.pendingConfirmation) {
        const yes = /\b(yes|confirm|ok(ay)?|oo|sige)\b/i.test(lower);
        const no = /\b(no|cancel|hindi|wag|huwag)\b/i.test(lower);
        if (yes) {
          setState((s) => ({ ...s, pendingConfirmation: null, engineState: "idle" }));
          speak("Confirmed.");
          return;
        }
        if (no) {
          setState((s) => ({ ...s, pendingConfirmation: null, engineState: "idle" }));
          speak("Cancelled.");
          return;
        }
      }

      const intent = await parseIntent(transcript, {
        currentPage: contextRef.current.currentPage,
        lastAction: contextRef.current.lastAction,
      });

      const result = await executeVoiceIntent(intent, { router, convex });
      contextRef.current.lastAction = intent.action;

      setState((s) => ({
        ...s,
        lastResult: result,
        engineState: "idle",
        pendingConfirmation: result.requiresConfirmation ? result : null,
        history: [
          ...s.history.slice(-19),
          { command: transcript, result, timestamp: Date.now() },
        ],
      }));

      if (result.message) speak(result.message);
    },
    [router, convex, speak, state.pendingConfirmation],
  );

  useEffect(() => {
    if (!VoiceEngine.isSupported()) return;

    const engine = new VoiceEngine({
      language: "en-PH",
      wakeWord: "hey system",
      onInterimTranscript: (text) =>
        setState((s) => ({ ...s, interimTranscript: text })),
      onFinalTranscript: handleFinal,
      onStateChange: (engineState) =>
        setState((s) => ({ ...s, engineState })),
      onWakeDetected: () => speak("Yes?"),
      onError: (error) => {
        if (error === "microphone_denied") {
          setState((s) => ({
            ...s,
            errorMessage:
              "Microphone access was denied. Allow it in browser settings.",
          }));
          return;
        }
        if (error === "browser_unsupported") {
          setState((s) => ({ ...s, isSupported: false }));
          return;
        }
        setState((s) => ({ ...s, errorMessage: error }));
      },
    });

    engineRef.current = engine;
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [handleFinal, speak]);

  const listen = useCallback(() => {
    setState((s) => ({
      ...s,
      interimTranscript: "",
      errorMessage: null,
      lastResult: null,
    }));
    engineRef.current?.listenOnce();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setState((s) => ({ ...s, mode: "off" }));
  }, []);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = engine.getState();
    if (current === "listening") stop();
    else listen();
  }, [listen, stop]);

  const enableWakeWord = useCallback(() => {
    engineRef.current?.startWakeMode();
    setState((s) => ({ ...s, mode: "wake", errorMessage: null }));
    speak("Wake word active. Say hey system to give a command.");
  }, [speak]);

  const disableWakeWord = useCallback(() => {
    engineRef.current?.stop();
    setState((s) => ({ ...s, mode: "off" }));
  }, []);

  const openHelp = useCallback(() => {
    setState((s) => ({ ...s, showHelp: true }));
  }, []);

  const closeHelp = useCallback(() => {
    setState((s) => ({ ...s, showHelp: false }));
  }, []);

  const dismissResult = useCallback(() => {
    setState((s) => ({ ...s, lastResult: null }));
  }, []);

  return {
    ...state,
    listen,
    stop,
    toggle,
    speak,
    enableWakeWord,
    disableWakeWord,
    openHelp,
    closeHelp,
    dismissResult,
  };
}
