// Pass-through — real LearnHub shell layout is at app/learnhub/(lh-main)/layout.tsx

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function FeedIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function JournalIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PathIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WorkIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function CertIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MsgIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M8 21h8M12 17v4M17 4h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-.5M7 4H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h.5M5 4h14v5a7 7 0 0 1-14 0V4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/learnhub/feed", label: "Feed", icon: <FeedIcon /> },
  { href: "/learnhub/journal", label: "Journal", icon: <JournalIcon /> },
  { href: "/learnhub/learning-path", label: "Learning Path", icon: <PathIcon /> },
  { href: "/learnhub/work", label: "Opportunities", icon: <WorkIcon /> },
  { href: "/learnhub/certificates", label: "Certificates", icon: <CertIcon /> },
  { href: "/learnhub/messages", label: "Messages", icon: <MsgIcon /> },
  { href: "/learnhub/leaderboard", label: "Leaderboard", icon: <TrophyIcon /> },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full z-20 flex flex-col transition-all duration-200"
      style={{
        width: collapsed ? 64 : 220,
        background: "#131626",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: "#5b6cff",
            fontFamily: "var(--font-sora)",
            color: "#fff",
          }}
        >
          L
        </div>
        {!collapsed && (
          <span
            className="font-bold text-sm truncate"
            style={{ color: "#e8eaff", fontFamily: "var(--font-sora)" }}
          >
            LearnHub
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-100"
              style={{
                color: active ? "#7c8bff" : "#9ba3cc",
                background: active ? "rgba(91,108,255,0.12)" : "transparent",
                fontFamily: "var(--font-dm-sans)",
              }}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings link */}
      <div
        className="px-2 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/learnhub/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-100"
          style={{ color: "#5c6490" }}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          {!collapsed && (
            <span className="text-sm font-medium">Settings</span>
          )}
        </Link>
      </div>
    </aside>
  );
}

function Topbar({
  onToggleSidebar,
  sidebarWidth,
}: {
  onToggleSidebar: () => void;
  sidebarWidth: number;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/learnhub/auth/session", { method: "DELETE" });
    router.push("/learnhub/login");
  };

  return (
    <header
      className="fixed top-0 right-0 z-10 flex items-center gap-3 px-4 h-14"
      style={{
        left: sidebarWidth,
        background: "rgba(13,15,26,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-2 transition-colors"
        style={{ color: "#9ba3cc" }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
          <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex-1" />

      <NotificationBell />

      <button
        onClick={handleSignOut}
        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
        style={{
          color: "#9ba3cc",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        Sign out
      </button>
    </header>
  );
}

export default function PassThrough({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
