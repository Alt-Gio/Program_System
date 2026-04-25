"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search as SearchIcon, X } from "lucide-react";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { DICT_PROJECTS } from "@/lib/types";

type Hit = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  group: "Activities" | "Interns" | "Personnel" | "Programs";
};

export function SmartSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Only fetch when the overlay is open to avoid unnecessary subscriptions
  const activities = useQuery(
    api.activities.listActivities,
    open ? {} : "skip",
  );
  const interns = useQuery(api.interns.list, open ? {} : "skip");
  const personnel = useQuery(api.personnel.list, open ? {} : "skip");
  const projects = useQuery(api.projects.list, open ? { isActive: true } : "skip");

  useKeyboardShortcut({ key: "/", shift: false, ctrl: false }, () =>
    setOpen(true),
  );
  useKeyboardShortcut({ key: "Escape", allowInInput: true }, () => setOpen(false));

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  const projectMap = useMemo(() => {
    const m: Record<string, { shortName: string; code: string }> = {};
    for (const p of projects ?? []) {
      m[p._id] = { shortName: p.shortName, code: p.code };
    }
    return m;
  }, [projects]);

  const hits: Hit[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out: Hit[] = [];

    // Programs
    for (const p of DICT_PROJECTS) {
      if (
        p.shortName.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query)
      ) {
        out.push({
          id: `proj-${p.code}`,
          href: `/projects/${p.code.toLowerCase()}`,
          title: p.shortName,
          subtitle: p.name,
          group: "Programs",
        });
      }
    }

    // Activities
    for (const a of activities ?? []) {
      if (
        a.activityTitle?.toLowerCase().includes(query) ||
        a.venue?.toLowerCase().includes(query) ||
        (a.personnelRaw ?? "").toLowerCase().includes(query)
      ) {
        const proj = projectMap[a.projectId as any];
        out.push({
          id: `act-${a._id}`,
          href: `/activities/${a._id}`,
          title: a.activityTitle,
          subtitle: `${proj?.shortName ?? "?"} · ${a.venue} · ${a.startDate}`,
          group: "Activities",
        });
      }
    }

    // Interns
    for (const i of interns ?? []) {
      if (
        i.fullName?.toLowerCase().includes(query) ||
        i.school?.toLowerCase().includes(query) ||
        (i.course ?? "").toLowerCase().includes(query)
      ) {
        out.push({
          id: `intern-${i.id}`,
          href: `/interns`,
          title: i.fullName,
          subtitle: `${i.school ?? ""}${i.course ? " · " + i.course : ""}`,
          group: "Interns",
        });
      }
    }

    // Personnel
    for (const p of personnel ?? []) {
      const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
      if (
        name.toLowerCase().includes(query) ||
        (p.position ?? "").toLowerCase().includes(query) ||
        (p.division ?? "").toLowerCase().includes(query)
      ) {
        out.push({
          id: `pers-${p._id}`,
          href: `/personnel`,
          title: name || "(unnamed)",
          subtitle: [p.position, p.division].filter(Boolean).join(" · "),
          group: "Personnel",
        });
      }
    }

    return out.slice(0, 40);
  }, [q, activities, interns, personnel, projectMap]);

  // Keep cursor in range as results change
  useEffect(() => {
    if (cursor >= hits.length) setCursor(Math.max(0, hits.length - 1));
  }, [hits.length, cursor]);

  const go = (h: Hit) => {
    setOpen(false);
    router.push(h.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(hits.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[cursor]) go(hits[cursor]);
    }
  };

  if (!open) return null;

  const grouped: Record<Hit["group"], Hit[]> = {
    Activities: [],
    Interns: [],
    Personnel: [],
    Programs: [],
  };
  hits.forEach((h) => grouped[h.group].push(h));

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <SearchIcon className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search activities, interns, personnel, programs…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            Esc
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim() === "" ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm text-gray-600">
                Search across the whole system
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Try a program name, an intern, a venue, or a title.
              </div>
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm text-gray-600">
                No results for "{q}"
              </div>
              <div className="mt-1 text-xs text-gray-400">
                Try a different keyword or check spelling.
              </div>
            </div>
          ) : (
            (["Programs", "Activities", "Interns", "Personnel"] as const)
              .filter((g) => grouped[g].length > 0)
              .map((g) => (
                <div key={g}>
                  <div className="bg-gray-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {g}
                  </div>
                  {grouped[g].map((h) => {
                    runningIdx++;
                    const active = runningIdx === cursor;
                    return (
                      <Link
                        key={h.id}
                        href={h.href}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setCursor(runningIdx)}
                        className={`block border-b border-gray-50 px-4 py-2.5 transition ${
                          active ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {h.title}
                        </div>
                        {h.subtitle && (
                          <div className="truncate text-xs text-gray-500">
                            {h.subtitle}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          <span>
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
              Enter
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
              /
            </kbd>{" "}
            anywhere
          </span>
        </div>
      </div>
    </div>
  );
}
