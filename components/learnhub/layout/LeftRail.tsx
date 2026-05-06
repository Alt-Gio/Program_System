"use client";

/**
 * LearnHub Left Rail (DTC-HUB Pinterest-style nav).
 *
 * 72-px-wide vertical icon rail that replaces the old 260-px profile
 * panel. Each item shows a tooltip on hover and a left-edge active
 * indicator on the current route. The "Create" button is a special
 * gradient pill that scrolls the user to the post composer on the
 * feed page (or routes there if they're elsewhere).
 *
 * Avatar + Settings live at the bottom for parity with the mockup.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Plus, Zap, Briefcase, Trophy, Settings } from "lucide-react";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

interface RailItem {
  id: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}

const ITEMS: RailItem[] = [
  { id: "feed",        href: "/learnhub/feed",        icon: <Home size={20} />,        label: "Home" },
  { id: "learning",    href: "/learnhub/learning-path", icon: <LayoutGrid size={20} />, label: "My Learning" },
  { id: "flow",        href: "/learnhub/journal",     icon: <Zap size={20} />,         label: "Flow State" },
  { id: "work",        href: "/learnhub/work",        icon: <Briefcase size={20} />,   label: "Opportunities" },
  { id: "leaderboard", href: "/learnhub/leaderboard", icon: <Trophy size={20} />,      label: "Leaderboard" },
];

export function LeftRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useLearnhubSession();

  const onCreatePost = () => {
    // If not on feed, navigate there with a #compose hash; the feed
    // page can read that on mount to focus the composer.
    if (!pathname.startsWith("/learnhub/feed")) {
      router.push("/learnhub/feed#compose");
    } else if (typeof window !== "undefined") {
      window.location.hash = "compose";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const avatarSrc = session?.avatarUrl
    ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session?.name ?? "U")}&backgroundColor=FF6B35&textColor=ffffff`;

  return (
    <nav className="lh-rail" aria-label="Primary">
      <div className="lh-rail-items">
        {ITEMS.slice(0, 2).map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return <RailLink key={it.id} item={it} active={active} />;
        })}

        {/* Create-post FAB */}
        <button
          type="button"
          onClick={onCreatePost}
          className="lh-rail-btn lh-rail-fab"
          title="Create Post"
          aria-label="Create Post"
        >
          <Plus size={20} />
          <span className="lh-rail-tip">Create Post</span>
        </button>

        {ITEMS.slice(2).map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return <RailLink key={it.id} item={it} active={active} />;
        })}
      </div>

      <div className="lh-rail-footer">
        <Link
          href="/learnhub/settings"
          className={`lh-rail-btn${pathname.startsWith("/learnhub/settings") ? " is-active" : ""}`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={20} />
          <span className="lh-rail-tip">Settings</span>
        </Link>

        <Link
          href="/learnhub/profile"
          className={`lh-rail-avatar${pathname.startsWith("/learnhub/profile") ? " is-active" : ""}`}
          title={session?.name ?? "Profile"}
          aria-label="My Profile"
        >
          <img
            src={avatarSrc}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(session?.name ?? "U")}`;
            }}
          />
          <span className="lh-rail-tip">{session?.name ?? "My Profile"}</span>
        </Link>
      </div>
    </nav>
  );
}

function RailLink({ item, active }: { item: RailItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`lh-rail-btn${active ? " is-active" : ""}`}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      {item.icon}
      <span className="lh-rail-tip">{item.label}</span>
      {active && <span className="lh-rail-active-bar" aria-hidden />}
    </Link>
  );
}
