// Typed wrapper around window CustomEvents so voice actions can reach
// any page in the (main) layout without a global React context.

export type VoiceEventMap = {
  "voice:sort": { field: string; order: "asc" | "desc" };
  "voice:filter": { field: string; value: string };
  "voice:search": { query: string };
  "voice:openItem": { type: string; index: number };
  "voice:openModal": { id: string; prefill?: Record<string, any> };
  "voice:closeModal": Record<string, never>;
  "voice:fillForm": { formId: string; data: Record<string, string> };
  "voice:confirm": Record<string, never>;
  "voice:cancel": Record<string, never>;
  "voice:export": { destination: string };
  "voice:importLogOpen": { program: string };
  "voice:help": Record<string, never>;
};

export function emitVoiceEvent<K extends keyof VoiceEventMap>(
  name: K,
  detail: VoiceEventMap[K],
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function onVoiceEvent<K extends keyof VoiceEventMap>(
  name: K,
  handler: (detail: VoiceEventMap[K]) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}
