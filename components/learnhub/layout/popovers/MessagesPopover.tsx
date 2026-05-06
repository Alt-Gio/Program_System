"use client";

/**
 * MessagesPopover — drop-down panel from the TopNav messages icon.
 *
 * Shows the user's most recent conversations (from
 * `api.learnhub_conversations.listMyConversations`) with a quick
 * search input. Clicking a row deep-links to /learnhub/messages with
 * the chosen conversation already focused. "See all" routes to the
 * full Messenger page.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLearnhubSession } from "@/lib/learnhub/hooks";
import { MessageSquare, Search, X } from "lucide-react";

interface MessagesPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function MessagesPopover({ open, onClose }: MessagesPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { userId } = useLearnhubSession();
  const convs = useQuery(
    api.learnhub_conversations.listMyConversations,
    userId ? { userId } : "skip"
  );
  const [tab, setTab] = useState<"inbox" | "unread">("inbox");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!convs) return convs;
    const q = search.trim().toLowerCase();
    return convs
      .filter((c) => (tab === "unread" ? (c.unreadCount ?? 0) > 0 : true))
      .filter((c) => {
        if (!q) return true;
        return (c.other?.name ?? "").toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [convs, tab, search]);

  if (!open) return null;

  return (
    <div className="lh-popover-wrap" ref={ref}>
      <div className="lh-popover" style={{ width: 360 }}>
        <header className="lh-popover-header">
          <div>
            <p className="lh-popover-title">
              <MessageSquare size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Chats
            </p>
          </div>
          <button type="button" onClick={onClose} className="lh-popover-close" aria-label="Close">
            <X size={14} />
          </button>
        </header>

        <div style={{ padding: "0 14px 10px" }}>
          <div className="lh-msg-search">
            <Search size={13} style={{ color: "var(--lh-text-3)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Messenger"
            />
          </div>
        </div>

        <div className="lh-msg-tabs" style={{ paddingBottom: 4 }}>
          <button
            type="button"
            className={`lh-msg-tab${tab === "inbox" ? " is-active" : ""}`}
            onClick={() => setTab("inbox")}
          >
            Inbox
          </button>
          <button
            type="button"
            className={`lh-msg-tab${tab === "unread" ? " is-active" : ""}`}
            onClick={() => setTab("unread")}
          >
            Unread
          </button>
        </div>

        <div className="lh-popover-list">
          {convs === undefined && (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="lh-skeleton" style={{ height: 48, borderRadius: 10 }} />
              ))}
            </div>
          )}
          {convs !== undefined && (filtered?.length ?? 0) === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--lh-text-3)", fontSize: 13 }}>
              {tab === "unread" ? "No unread chats." : "No conversations yet."}
            </div>
          )}
          {filtered?.map((c) => {
            const unread = (c.unreadCount ?? 0) > 0;
            const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.other?.name ?? "U")}`;
            return (
              <Link
                key={c._id}
                href={`/learnhub/messages?to=${c.other?._id ?? ""}`}
                className={`lh-msg-conv-row${unread ? " has-unread" : ""}`}
                onClick={onClose}
                style={{ textDecoration: "none" }}
              >
                <div className="lh-msg-conv-avatar-wrap">
                  <img
                    src={c.other?.avatarUrl ?? fallback}
                    alt=""
                    className="lh-msg-conv-avatar"
                    style={{ width: 40, height: 40 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
                  />
                </div>
                <div className="lh-msg-conv-body">
                  <div className="lh-msg-conv-top">
                    <span className="lh-msg-conv-name">{c.other?.name ?? "User"}</span>
                  </div>
                  <div className="lh-msg-conv-bottom">
                    <span className="lh-msg-conv-preview">
                      {c.lastMsg?.content ?? "No messages yet"}
                    </span>
                    {unread && <span className="lh-msg-conv-badge">{c.unreadCount}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <footer className="lh-popover-footer">
          <Link href="/learnhub/messages" onClick={onClose} className="lh-popover-see-all">
            See all in Messenger →
          </Link>
        </footer>
      </div>
    </div>
  );
}
