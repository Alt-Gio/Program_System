// Thin-line SVG icons for each role. Kept in a single file so the carousel
// can animate them on slide change without loading a separate chunk per role.

import type { RoleMeta } from "./roles";

const common = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function RoleIcon({ icon, size = 48 }: { icon: RoleMeta["icon"]; size?: number }) {
  switch (icon) {
    case "book":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <path d="M24 12c-4-3-10-3-14-2v28c4-1 10-1 14 2" />
          <path d="M24 12c4-3 10-3 14-2v28c-4-1-10-1-14 2" />
          <path d="M24 12v28" />
        </svg>
      );
    case "compass":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <circle cx="24" cy="24" r="14" />
          <circle cx="24" cy="24" r="2" />
          <path d="M24 10v3M24 35v3M10 24h3M35 24h3" />
        </svg>
      );
    case "sprout":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <path d="M24 38v-14" />
          <path d="M24 24c0-6 4-10 10-10 0 6-4 10-10 10z" />
          <path d="M24 28c0-4-3-7-8-7 0 4 3 7 8 7z" />
        </svg>
      );
    case "shield":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <path d="M24 10l12 4v10c0 8-6 13-12 15-6-2-12-7-12-15V14z" />
          <path d="M19 24l4 4 8-8" />
        </svg>
      );
    case "lock":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <rect x="13" y="22" width="22" height="16" rx="2" />
          <path d="M17 22v-4a7 7 0 1 1 14 0v4" />
          <circle cx="24" cy="30" r="1.5" />
        </svg>
      );
    case "sitemap":
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...common}>
          <rect x="20" y="10" width="8" height="6" rx="1" />
          <rect x="10" y="32" width="8" height="6" rx="1" />
          <rect x="30" y="32" width="8" height="6" rx="1" />
          <path d="M24 16v8M14 32v-8h20v8" />
        </svg>
      );
    default:
      return null;
  }
}
