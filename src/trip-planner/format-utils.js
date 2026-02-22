export function formatTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format a duration given in seconds, e.g. 5400 -> "1h 30min". */
export function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return "—";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;

  return `${h}h ${m}min`;
}

/**
 * Parse the SBB API duration string "00d05:30:00" (days + hours:minutes:seconds)
 * into a human-readable string like "5h 30min".
 */
export function parseSbbDuration(dur) {
  if (!dur) return "—";

  const match = dur.match(/^(\d+)d(\d+):(\d+)/);
  if (!match) return dur;

  const totalHours = Number(match[1]) * 24 + Number(match[2]);
  const minutes = Number(match[3]);

  if (totalHours === 0) return `${minutes}min`;
  if (minutes === 0) return `${totalHours}h`;

  return `${totalHours}h ${minutes}min`;
}
