"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, Sparkles } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "celebrate";

type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
  durationMs: number;
};

let toasts: Toast[] = [];
let listeners: ((next: Toast[]) => void)[] = [];

function notify() {
  for (const listener of listeners) listener(toasts);
}

export function toast(message: string, opts?: { kind?: ToastKind; durationMs?: number }) {
  const id = Math.random().toString(36).slice(2);
  const kind = opts?.kind ?? "info";
  const durationMs = opts?.durationMs ?? (kind === "error" ? 4000 : 2400);
  toasts = [...toasts, { id, message, kind, durationMs }];
  notify();
  if (typeof window !== "undefined") {
    window.setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
      notify();
    }, durationMs);
  }
  return id;
}

export function useToasts() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);
  return list;
}

function iconFor(kind: ToastKind) {
  if (kind === "success") return <CheckCircle2 size={16} />;
  if (kind === "error") return <AlertTriangle size={16} />;
  if (kind === "celebrate") return <Sparkles size={16} />;
  return <Info size={16} />;
}

export function Toaster() {
  const list = useToasts();
  if (list.length === 0) return null;
  return (
    <div className="vf-toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`vf-toast vf-toast-${t.kind}`}>
          {iconFor(t.kind)}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export async function withToast<T>(
  promise: Promise<T>,
  messages: { success?: string; error?: string }
): Promise<T | null> {
  try {
    const result = await promise;
    if (messages.success) toast(messages.success, { kind: "success" });
    return result;
  } catch (err) {
    const msg = messages.error ?? (err instanceof Error ? err.message : "Something went wrong");
    toast(msg, { kind: "error" });
    return null;
  }
}
