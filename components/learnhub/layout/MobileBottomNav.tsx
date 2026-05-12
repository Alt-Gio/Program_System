"use client";

/**
 * Facebook-style mobile bottom nav for LearnHub.
 *
 * Five real navigation slots — no central create-FAB. Post creation lives in
 * the composer at the top of /learnhub/feed (same model as Facebook, where
 * "What's on your mind?" is the entry point, not a floating + button).
 *
 * The rightmost slot is the user's actual Google avatar (the same picture
 * that appears in their Gmail), with an "active" ring when the user is on a
 * profile/settings/me-owned route. Long-press-equivalent (the avatar tap)
 * still routes to /learnhub/profile; the avatar dropdown menu in the top
 * nav owns sign-out and settings shortcuts.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlaySquare, Briefcase, MessageSquare } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";

interface BasicItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

// Five-slot Facebook-style nav: Home · Watch · Work · Chats · Me.
// Watch sits in the spot Facebook gives its video tab; it deep-links into
// the new /learnhub/watch video-only feed.
const NAV_ITEMS_LEFT: BasicItem[] = [
  { href: "/learnhub/feed",  icon: <Home size={22} />,        label: "Home" },
  { href: "/learnhub/watch", icon: <PlaySquare size={22} />,  label: "Watch" },
  { href: "/learnhub/work",  icon: <Briefcase size={22} />,   label: "Work" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { session, userId } = useLearnhubSession();

  // Live unread message count — same query the topnav uses, cheap because
  // Convex de-dupes across subscribers.
  const convs = useQuery(
    api.learnhub_conversations.listMyConversations,
    userId ? { userId } : "skip",
  );
  const unreadMsgs = (convs ?? []).reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  const profileActive =
    pathname.startsWith("/learnhub/profile") ||
    pathname.startsWith("/learnhub/settings") ||
    pathname.startsWith("/learnhub/certificates") ||
    pathname.startsWith("/learnhub/journal");

  return (
    <nav className="lh-bottom-nav" aria-label="Primary">
      {NAV_ITEMS_LEFT.map((item) => (
        <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
      ))}

      <BottomLink
        item={{
          href: "/learnhub/messages",
          icon: <MessageSquare size={22} />,
          label: "Chats",
          badge: unreadMsgs,
        }}
        active={isActive(pathname, "/learnhub/messages")}
      />

      <MeBottomItem
        href="/learnhub/profile"
        name={session?.name ?? "You"}
        avatarUrl={session?.avatarUrl ?? null}
        active={profileActive}
      />
    </nav>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function BottomLink({ item, active }: { item: BasicItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`lh-bottom-nav-item${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
    >
      <span className="lh-bottom-nav-icon" aria-hidden>
        {item.icon}
        {item.badge && item.badge > 0 ? (
          <span className="lh-bottom-nav-badge">{item.badge > 9 ? "9+" : item.badge}</span>
        ) : null}
      </span>
      <span className="lh-bottom-nav-label">{item.label}</span>
    </Link>
  );
}

function MeBottomItem({
  href,
  name,
  avatarUrl,
  active,
}: {
  href: string;
  name: string;
  avatarUrl: string | null;
  active: boolean;
}) {
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=5B6CFF&textColor=ffffff`;
  return (
    <Link
      href={href}
      className={`lh-bottom-nav-item lh-bottom-nav-me${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={`Profile (${name})`}
    >
      <span className={`lh-bottom-nav-avatar${active ? " is-active" : ""}`} aria-hidden>
        <img
          src={avatarUrl || fallback}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallback;
          }}
        />
      </span>
      <span className="lh-bottom-nav-label">Me</span>
    </Link>
  );
}
