export default function Loading() {
  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         9999,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "radial-gradient(ellipse at top left, #0d1428 0%, #050810 55%)",
        color:          "#e8eeff",
        fontFamily:     "'Sora', system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width:        72,
            height:       72,
            margin:       "0 auto 18px",
            borderRadius: "50%",
            border:       "3px solid rgba(123,208,255,0.18)",
            borderTopColor: "#7BD0FF",
            animation:    "spin 1s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          fontSize:      12,
          color:         "rgba(180,200,255,0.55)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}>
          Starting kiosk…
        </div>
      </div>
    </div>
  );
}
