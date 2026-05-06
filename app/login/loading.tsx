export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#05060f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          border: "2px solid rgba(249, 115, 22, 0.2)",
          borderTopColor: "#f97316",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </main>
  );
}
