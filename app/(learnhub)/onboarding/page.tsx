import { redirect } from "next/navigation";
export default function OldOnboardingRedirect() { redirect("/learnhub/onboarding"); }
// dead code below — real page at app/learnhub/onboarding/page.tsx
import type { FC } from "react";

type Role = "student" | "mentor" | "org_partner";

interface PendingProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

const ROLES: Array<{ value: Role; label: string; desc: string; emoji: string }> = [
  {
    value: "student",
    label: "Student",
    desc: "I'm enrolled in an ILCDB program (SPARK, DWIA, Project CLICK, Tech4ED)",
    emoji: "🎓",
  },
  {
    value: "mentor",
    label: "Mentor",
    desc: "I'm a DICT trainer or facilitator managing a cohort",
    emoji: "🏫",
  },
  {
    value: "org_partner",
    label: "Org Partner",
    desc: "My organization posts online work opportunities for ILCDB graduates",
    emoji: "🏢",
  },
];

function _OnboardingPage_unused() {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/learnhub/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "session") {
          router.replace("/learnhub/feed");
        } else if (data.type === "pending") {
          setProfile(data.profile);
        } else {
          router.replace("/learnhub/login");
        }
      })
      .catch(() => router.replace("/learnhub/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async () => {
    if (!selectedRole) {
      setError("Please select a role to continue.");
      return;
    }
    setSubmitting(true);
    setError("");

    const body: Record<string, string> = { role: selectedRole };
    if (selectedRole === "student") body.school = extra;
    else body.organization = extra;

    const res = await fetch("/api/learnhub/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // Mint Firebase token in background
      fetch("/api/learnhub/auth/firebase-token", { method: "POST" }).catch(() => {});
      router.push("/learnhub/feed");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0d0f1a" }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#5b6cff", borderTopColor: "transparent" }}
        />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0d0f1a" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(91,108,255,0.1) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "#131626",
          border: "1px solid rgba(91,108,255,0.2)",
        }}
      >
        {/* Header */}
        <div>
          <p
            className="text-xs font-medium tracking-widest uppercase mb-1"
            style={{ color: "#5b6cff", fontFamily: "var(--font-sora)" }}
          >
            Welcome to ILCDB LearnHub
          </p>
          <h1
            className="text-2xl font-bold"
            style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
          >
            Tell us about yourself
          </h1>
          {profile && (
            <p className="text-sm mt-1" style={{ color: "#9ba3cc" }}>
              Signed in as <span style={{ color: "#e8eaff" }}>{profile.email}</span>
            </p>
          )}
        </div>

        {/* Role cards */}
        <div className="flex flex-col gap-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className="flex items-start gap-4 rounded-xl p-4 text-left transition-all duration-150"
              style={{
                background:
                  selectedRole === role.value
                    ? "rgba(91,108,255,0.12)"
                    : "#1a1d30",
                border:
                  selectedRole === role.value
                    ? "1.5px solid #5b6cff"
                    : "1.5px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-2xl mt-0.5">{role.emoji}</span>
              <div>
                <p
                  className="font-semibold text-sm"
                  style={{
                    color: selectedRole === role.value ? "#7c8bff" : "#e8eaff",
                    fontFamily: "var(--font-sora)",
                  }}
                >
                  {role.label}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "#9ba3cc" }}>
                  {role.desc}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Optional extra field */}
        {selectedRole && (
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#9ba3cc" }}
            >
              {selectedRole === "student" ? "School / University" : "Organization name"}{" "}
              <span style={{ color: "#5c6490" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={
                selectedRole === "student"
                  ? "e.g. Bicol University"
                  : "e.g. TechCorp Philippines"
              }
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: "#0d0f1a",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e8eaff",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "#5b6cff")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />
          </div>
        )}

        {error && (
          <p className="text-sm" style={{ color: "#ff5f6d" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedRole || submitting}
          className="w-full rounded-xl py-3 font-semibold text-sm transition-all duration-150 disabled:opacity-40"
          style={{
            background: "#5b6cff",
            color: "#fff",
            fontFamily: "var(--font-sora)",
          }}
        >
          {submitting ? "Setting up your account…" : "Join LearnHub →"}
        </button>
      </div>
    </main>
  );
}
