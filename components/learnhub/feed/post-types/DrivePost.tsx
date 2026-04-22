"use client";

interface DriveMetadata {
  driveFileId?: string;
  fileName?: string;
  mimeType?: string;
  previewUrl?: string;
}

const MIME_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.google-apps.presentation": "📊",
  "application/vnd.google-apps.document": "📝",
  "application/vnd.google-apps.spreadsheet": "📈",
  "image/": "🖼️",
  "video/": "🎬",
};

function getMimeIcon(mime?: string): string {
  if (!mime) return "📁";
  for (const [key, icon] of Object.entries(MIME_ICONS)) {
    if (mime.startsWith(key)) return icon;
  }
  return "📁";
}

export function DrivePost({ metadata }: { metadata: Record<string, unknown> }) {
  const m = metadata as unknown as DriveMetadata;

  if (!m.driveFileId && !m.previewUrl) return null;

  const openUrl = m.driveFileId
    ? `https://drive.google.com/file/d/${m.driveFileId}/view`
    : m.previewUrl ?? "#";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0d0f1a",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* File info row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl shrink-0">{getMimeIcon(m.mimeType)}</span>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: "#e8eaff" }}
          >
            {m.fileName ?? "Google Drive File"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#9ba3cc" }}>
            Google Drive
          </p>
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: "rgba(91,108,255,0.12)",
            color: "#7c8bff",
            border: "1px solid rgba(91,108,255,0.25)",
          }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
            <path
              d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Open
        </a>
      </div>

      {/* Inline preview for PDFs / presentations */}
      {m.previewUrl && (
        <div
          className="mx-3 mb-3 rounded-lg overflow-hidden"
          style={{ height: 220, background: "#131626" }}
        >
          <iframe
            src={m.previewUrl}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            title={m.fileName ?? "Drive preview"}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )}
    </div>
  );
}
