/**
 * UTC range for "today" in the browser's local timezone.
 * Storage is UTC; rendering is local. The server takes from/to as ISO strings,
 * so converting once on the client is the cleanest seam.
 */
export function todayRange(now = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Format an ISO timestamp as a local time-of-day (e.g. "12:34 PM"). */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** YYYY-MM-DD in browser-local TZ (used by the chat backend for "today"). */
export function todayLocal(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Friday, May 1 — for prompt rendering. */
export function todayLabel(now = new Date()): string {
  return now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Build a YYYY-MM-DD range ending today, going back N days inclusive. */
export function lastNDaysRange(n: number, now = new Date()): {
  from: string;
  to: string;
} {
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - (n - 1));
  return { from: localISODate(from), to: localISODate(to) };
}

function localISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
