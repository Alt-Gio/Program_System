// Calendar route skeleton â€” renders instantly on navigation while the real
// page.tsx hydrates and fetches events. Keeps the visual structure stable so
// the user sees the calendar shell appear immediately instead of a blank gap.

export default function CalendarLoading() {
  const cells = Array.from({ length: 42 });
  return (
    <div className="max-w-5xl mx-auto px-4 py-6" aria-busy="true">
      <header className="flex items-center justify-between mb-5">
        <div>
          <div
            className="h-5 w-28 rounded mb-2"
            style={{ background: "rgba(91,108,255,0.18)" }}
          />
          <div
            className="h-3 w-64 rounded"
            style={{ background: "var(--lh-card-3)" }}
          />
        </div>
        <div
          className="h-8 w-24 rounded-lg"
          style={{ background: "rgba(91,108,255,0.25)" }}
        />
      </header>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <div className="h-7 w-7 rounded-lg" style={{ background: "var(--lh-card-3)" }} />
          <div className="h-7 w-7 rounded-lg" style={{ background: "var(--lh-card-3)" }} />
        </div>
        <div className="h-4 w-32 rounded" style={{ background: "var(--lh-border)" }} />
        <div style={{ width: 80 }} />
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-[10px] font-semibold text-center py-1"
            style={{ color: "var(--lh-text-2)", letterSpacing: "0.06em" }}
          >
            {d.toUpperCase()}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((_, i) => (
          <div
            key={i}
            className="rounded-lg min-h-[88px]"
            style={{
              background: "var(--lh-card)",
              border: "1px solid rgba(255,255,255,0.04)",
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
}
