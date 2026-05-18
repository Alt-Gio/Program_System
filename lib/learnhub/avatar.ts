/**
 * Inline-SVG initials avatar generator.
 *
 * Previously we fell back to `https://api.dicebear.com/7.x/initials/svg?seed=...`
 * for users without a profile photo. That host is blocked by the production
 * CSP (`img-src 'self' data: blob: …` does not include api.dicebear.com),
 * which left half the UI showing broken avatar boxes.
 *
 * Generating the SVG inline as a `data:` URI sidesteps CSP entirely
 * (`data:` is already allowlisted) and removes a third-party dependency
 * from the critical render path. The output is identical-looking: two
 * initials on a coloured gradient circle.
 *
 * Usage:
 *   <img src={initialsAvatar(name)} />
 *   <img src={user.avatarUrl || initialsAvatar(user.name)} />
 */

const PALETTE = [
  ["#5B6CFF", "#7B5BFF"], // indigo → violet
  ["#F97316", "#EF4444"], // orange → red
  ["#10B981", "#06B6D4"], // emerald → cyan
  ["#A855F7", "#EC4899"], // purple → pink
  ["#0EA5E9", "#6366F1"], // sky → indigo
  ["#F59E0B", "#F97316"], // amber → orange
  ["#22C55E", "#10B981"], // green → emerald
  ["#FB7185", "#F43F5E"], // rose
];

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable colour pick based on the name so the same user always gets the
// same gradient — matches the dicebear behaviour users were used to.
function paletteFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] as [string, string];
}

export function initialsAvatar(name: string | null | undefined): string {
  const safe = (name ?? "User").trim() || "User";
  const initials = initialsOf(safe);
  const [c1, c2] = paletteFor(safe);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="80" height="80" rx="40" fill="url(#g)"/>` +
    `<text x="50%" y="50%" dy=".06em" text-anchor="middle" dominant-baseline="middle" ` +
    `fill="#fff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" ` +
    `font-size="34" font-weight="700">${escapeXml(initials)}</text>` +
    `</svg>`;
  // encodeURIComponent is safe-for-CSP and works in every browser; using
  // base64 would be slightly smaller but adds a btoa cost on the server.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
