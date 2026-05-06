"use client";

import { Mic, MicOff, Loader2, Volume2, HelpCircle, Radio } from "lucide-react";
import { useVoiceCommand } from "@/lib/voice/useVoiceCommand";
import { VoiceCommandHelp } from "./VoiceCommandHelp";

export function VoiceOrb() {
  const voice = useVoiceCommand();

  if (!voice.isSupported) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 shadow">
        🎙️ Voice commands require Chrome or Edge.
      </div>
    );
  }

  const listening = voice.engineState === "listening";
  const processing = voice.engineState === "processing";
  const speaking = voice.engineState === "speaking";

  const orbTitle = listening
    ? "Listening…"
    : processing
      ? "Processing…"
      : speaking
        ? "Speaking…"
        : "Click and speak a command";

  const orbClasses = listening
    ? "bg-blue-500 border-blue-600 text-white animate-pulse"
    : processing
      ? "bg-amber-500 border-amber-600 text-white"
      : speaking
        ? "bg-emerald-500 border-emerald-600 text-white"
        : voice.mode === "wake"
          ? "bg-indigo-500 border-indigo-600 text-white"
          : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600";

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {voice.interimTranscript && listening && (
          <div className="max-w-xs rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-lg">
            <span className="mr-1 text-gray-400">“</span>
            {voice.interimTranscript}
            <span className="ml-1 text-gray-400">”</span>
          </div>
        )}

        {voice.pendingConfirmation && (
          <div className="max-w-xs rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-lg">
            <div className="font-semibold">Awaiting confirmation</div>
            <div>{voice.pendingConfirmation.message}</div>
            <div className="mt-1 text-[10px] text-amber-700">
              Say "yes" to confirm or "no" to cancel.
            </div>
          </div>
        )}

        {voice.lastResult && !listening && !processing && !voice.pendingConfirmation && (
          <div
            className={`max-w-xs rounded-2xl border px-3 py-2 text-sm shadow-lg ${
              voice.lastResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <button
              type="button"
              onClick={voice.dismissResult}
              className="float-right ml-2 text-xs opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
            <span className="mr-1 font-semibold">
              {voice.lastResult.success ? "✓" : "✗"}
            </span>
            {voice.lastResult.message}
          </div>
        )}

        {voice.errorMessage && (
          <div className="max-w-xs rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow">
            {voice.errorMessage}
          </div>
        )}

        {/* Voice control cluster — secondary pills stacked above the
            primary mic so the whole group is a narrow right-aligned
            column. This avoids overlapping the QuickAddButton (which
            sits at right-[108px] bottom-6 on desktop) and reads as
            one unified control instead of three competing chips. */}
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={voice.openHelp}
            title="See what you can say"
            className="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-gray-500 shadow-sm ring-1 ring-gray-200/80 hover:text-gray-800 hover:ring-gray-300 transition"
          >
            <HelpCircle className="h-3 w-3" /> What can I say?
          </button>

          <button
            type="button"
            onClick={
              voice.mode === "wake" ? voice.disableWakeWord : voice.enableWakeWord
            }
            title={
              voice.mode === "wake"
                ? "Disable wake word"
                : "Enable wake word (say 'hey system')"
            }
            aria-pressed={voice.mode === "wake"}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ring-1 transition ${
              voice.mode === "wake"
                ? "bg-indigo-600 text-white ring-indigo-600 hover:bg-indigo-700"
                : "bg-white/95 backdrop-blur text-gray-500 ring-gray-200/80 hover:text-gray-800 hover:ring-gray-300"
            }`}
          >
            <Radio className={`h-3 w-3 ${voice.mode === "wake" ? "animate-pulse" : ""}`} />
            {voice.mode === "wake" ? "Wake on" : "Wake off"}
          </button>

          <button
            type="button"
            onClick={voice.toggle}
            title={orbTitle}
            aria-label={orbTitle}
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-xl transition-transform duration-150 hover:scale-105 active:scale-95 ${orbClasses}`}
          >
            {processing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : speaking ? (
              <Volume2 className="h-6 w-6" />
            ) : listening ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {voice.showHelp && <VoiceCommandHelp onClose={voice.closeHelp} />}
    </>
  );
}
