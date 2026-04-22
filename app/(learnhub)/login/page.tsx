import { redirect } from "next/navigation";

export default function OldLoginRedirect() { redirect("/learnhub/login"); }
function _LoginContent_unused() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/learnhub/feed";

  const handleGoogleLogin = () => {
    window.location.href = `/api/learnhub/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0d0f1a" }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(91,108,255,0.12) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{
          background: "#131626",
          border: "1px solid rgba(91,108,255,0.2)",
          boxShadow: "0 0 40px rgba(91,108,255,0.08)",
        }}
      >
        {/* Logos */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: "#5b6cff", fontFamily: "var(--font-sora)" }}
          >
            L
          </div>
          <div>
            <p
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}
            >
              ILCDB
            </p>
            <p
              className="text-lg font-bold leading-tight"
              style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
            >
              LearnHub
            </p>
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-base font-medium"
            style={{ color: "#e8eaff" }}
          >
            Welcome back
          </p>
          <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>
            DICT Region V Social Learning Platform
          </p>
        </div>

        {error && (
          <div
            className="w-full rounded-lg px-4 py-3 text-sm text-center"
            style={{
              background: "rgba(255,95,109,0.1)",
              border: "1px solid rgba(255,95,109,0.3)",
              color: "#ff5f6d",
            }}
          >
            {error === "oauth_failed"
              ? "Google sign-in was cancelled or failed. Please try again."
              : "Something went wrong. Please try again."}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-5 font-medium transition-all duration-150 active:scale-95"
          style={{
            background: "#1a1d30",
            border: "1px solid rgba(91,108,255,0.35)",
            color: "#e8eaff",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#5b6cff";
            (e.currentTarget as HTMLElement).style.background = "rgba(91,108,255,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(91,108,255,0.35)";
            (e.currentTarget as HTMLElement).style.background = "#1a1d30";
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-xs text-center" style={{ color: "#5c6490" }}>
          By continuing, you agree to DICT Region V&apos;s platform policies.
          <br />
          For ILCDB program participants only.
        </p>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs" style={{ color: "#5c6490" }}>
        DICT Region V · ILCDB LearnHub · {new Date().getFullYear()}
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

