"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, X } from "lucide-react";
import { fmtTime, labelForKind, youtubeUrl } from "./utils";
import type { NoteKind, VideoNote, VideoSession } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  session: VideoSession | null;
  notes: VideoNote[];
  transcript: string;
  onExported?: () => void;
};

function buildMarkdown(session: VideoSession | null, notes: VideoNote[], transcript: string) {
  if (!session) return "";
  const lines: string[] = [];
  lines.push(`# ${session.title ?? "YouTube Learning Session"}`);
  lines.push("");
  if (session.channelName) lines.push(`**Channel:** ${session.channelName}`);
  lines.push(`**Video:** ${youtubeUrl(session.videoId)}`);
  if (session.durationSec) lines.push(`**Duration:** ${fmtTime(session.durationSec)}`);
  lines.push(`**Progress:** ${session.progressPct}% · status ${session.status}`);
  lines.push("");

  if (session.aiSummary?.summary) {
    lines.push("## Summary");
    lines.push(session.aiSummary.summary);
    lines.push("");
  }

  if (session.aiSummary?.keyConcepts?.length) {
    lines.push("## Key concepts");
    for (const item of session.aiSummary.keyConcepts) lines.push(`- ${item}`);
    lines.push("");
  }
  if (session.aiSummary?.actionItems?.length) {
    lines.push("## Action items");
    for (const item of session.aiSummary.actionItems) lines.push(`- ${item}`);
    lines.push("");
  }
  if (session.aiSummary?.questions?.length) {
    lines.push("## Open questions");
    for (const item of session.aiSummary.questions) lines.push(`- ${item}`);
    lines.push("");
  }
  if (session.aiSummary?.beginnerExplanation) {
    lines.push("## Beginner explanation");
    lines.push(session.aiSummary.beginnerExplanation);
    lines.push("");
  }

  if (notes.length) {
    lines.push("## Timestamped notes");
    const ordered = [...notes].sort((a, b) => a.timestampSec - b.timestampSec);
    for (const n of ordered) {
      const link = youtubeUrl(session.videoId, n.timestampSec);
      lines.push(`- **[${fmtTime(n.timestampSec)}](${link}) · ${labelForKind(n.kind as NoteKind)}** — ${n.content}`);
    }
    lines.push("");
  }

  if (session.aiSummary?.quizItems?.length) {
    lines.push("## Quick recall");
    for (const q of session.aiSummary.quizItems) {
      lines.push(`**Q:** ${q.question}`);
      lines.push(`**A:** ${q.answer}`);
      lines.push("");
    }
  }

  if (transcript.trim()) {
    lines.push("## Transcript");
    lines.push(transcript.trim());
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`Exported from LearnHub Video Flow.`);
  return lines.join("\n");
}

export function ExportModal({ open, onClose, session, notes, transcript, onExported }: Props) {
  const markdown = useMemo(() => buildMarkdown(session, notes, transcript), [session, notes, transcript]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      onExported?.();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const safe = (session?.title ?? "video-flow").replace(/[^\w-]+/g, "_").slice(0, 60);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onExported?.();
  }

  return (
    <div className="vf-modal-backdrop" role="dialog" aria-label="Export pack" onClick={onClose}>
      <div className="vf-modal vf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Export pack</h2>
          <button className="vf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <p className="vf-muted">
          Copy the Markdown below into NotebookLM, Notion, or Google Docs. Timestamps deep-link back to YouTube.
        </p>
        <textarea readOnly className="vf-export-textarea" value={markdown} />
        <div className="vf-modal-actions">
          <button className="vf-primary-btn" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy markdown"}
          </button>
          <button className="vf-ghost-btn" onClick={download}>
            <Download size={15} /> Download .md
          </button>
          <a
            className="vf-ghost-btn"
            href="https://notebooklm.google.com/"
            target="_blank"
            rel="noreferrer noopener"
          >
            <ExternalLink size={15} /> Open NotebookLM
          </a>
        </div>
      </div>
    </div>
  );
}
