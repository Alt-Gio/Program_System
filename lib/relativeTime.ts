export function relativeTime(
  target: number | Date,
  now: number = Date.now(),
): string {
  const t = target instanceof Date ? target.getTime() : target;
  const diff = now - t;
  const abs = Math.abs(diff);
  const future = diff < 0;

  const sec = 1000;
  const min = 60 * sec;
  const hr = 60 * min;
  const day = 24 * hr;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const units: Array<[number, string]> = [
    [year, "year"],
    [month, "month"],
    [week, "week"],
    [day, "day"],
    [hr, "hour"],
    [min, "minute"],
  ];

  for (const [u, label] of units) {
    if (abs >= u) {
      const n = Math.floor(abs / u);
      return future
        ? `in ${n} ${label}${n === 1 ? "" : "s"}`
        : `${n} ${label}${n === 1 ? "" : "s"} ago`;
    }
  }
  return future ? "in a moment" : "just now";
}

export function absoluteTime(target: number | Date): string {
  const d = target instanceof Date ? target : new Date(target);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
