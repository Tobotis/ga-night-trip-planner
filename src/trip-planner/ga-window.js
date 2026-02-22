import { isWeekendDay, nextDateOf } from "./date-utils";

/**
 * Night GA cutoff depends on the next day:
 * - If the following day is weekend, cutoff is 07:00
 * - Otherwise cutoff is 05:00
 */
export function gaCutoffHour(dateStr) {
  const nextDayIsWeekend = isWeekendDay(nextDateOf(dateStr));
  return nextDayIsWeekend ? 7 : 5;
}

export function nightGAWindow(dateStr) {
  const cutoffHour = gaCutoffHour(dateStr);
  const nextDayIsWeekend = cutoffHour === 7;
  const end = `${String(cutoffHour).padStart(2, "0")}:00`;

  return {
    start: "19:00",
    end,
    label: nextDayIsWeekend
      ? "19:00–07:00 (next day is weekend)"
      : "19:00–05:00 (next day is weekday)",
    nextDayIsWeekend,
  };
}

export function morningReturnQueryTime(dateStr) {
  return gaCutoffHour(dateStr) === 7 ? "07:01" : "05:01";
}

/**
 * Returns true if the given ISO datetime falls within the GA Night window.
 * Window: 19:00 on gaDate -> 05:00/07:00 on the next morning.
 */
export function isWithinGA(isoStr, gaDate) {
  if (!isoStr) return true;

  const d = new Date(isoStr);
  const [y, m, day] = gaDate.split("-").map(Number);
  const windowStart = new Date(y, m - 1, day, 19, 0, 0);
  const windowEnd = new Date(y, m - 1, day + 1, gaCutoffHour(gaDate), 0, 0);

  return d >= windowStart && d <= windowEnd;
}
