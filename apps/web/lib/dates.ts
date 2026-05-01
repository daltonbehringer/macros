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
