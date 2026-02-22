/**
 * Format a Date as "YYYY-MM-DD" using local time parts.
 * Using toISOString() would apply a UTC offset and can return the wrong date
 * for timezones ahead of UTC.
 */
export function toDateStr(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns the YYYY-MM-DD string for the day after dateStr, timezone-safe. */
export function nextDateOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + 1));
}

export function isWeekendDay(dateStr) {
  const day = parseDate(dateStr).getDay();
  return day === 0 || day === 6;
}
