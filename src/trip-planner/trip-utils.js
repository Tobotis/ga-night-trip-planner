import { toDateStr } from "./date-utils";

export function addMinutes(isoStr, minutes) {
  const d = new Date(isoStr);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function durationSeconds(dep, arr) {
  if (!dep || !arr) return null;
  return (new Date(arr) - new Date(dep)) / 1000;
}

/**
 * Returns the local time string and date string for a Date object.
 */
export function splitDateTime(d) {
  return {
    time: d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", hour12: false }),
    date: toDateStr(d),
  };
}
