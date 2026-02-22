import { fetchConnections } from "./api";
import { gaCutoffHour, isWithinGA } from "./ga-window";
import { splitDateTime } from "./trip-utils";

function windowEndDate(gaDate) {
  const [y, m, day] = gaDate.split("-").map(Number);
  return new Date(y, m - 1, day + 1, gaCutoffHour(gaDate), 0, 0, 0);
}

function isBeforeOrAtWindowEnd(isoStr, gaDate) {
  if (!isoStr) return false;
  const departure = new Date(isoStr);
  if (Number.isNaN(departure.getTime())) return false;
  return departure <= windowEndDate(gaDate);
}

function connectionSignature(connection) {
  return [
    connection.from?.departure ?? "",
    connection.to?.arrival ?? "",
    connection.duration ?? "",
    String(connection.transfers ?? ""),
  ].join("|");
}

function nextCursor(afterDepartureIso) {
  const next = new Date(afterDepartureIso);
  next.setMinutes(next.getMinutes() + 1);
  return splitDateTime(next);
}

/**
 * Fetch connections iteratively from startTime onward and keep only those fully
 * inside the GA Night window. Stops once enough results are found or cutoff is reached.
 */
export async function fetchConnectionsWithinGAWindow({
  from,
  to,
  gaDate,
  startTime = "19:00",
  targetCount = 28,
  batchSize = 16,
  maxBatches = 12,
}) {
  const results = [];
  const seen = new Set();

  let queryDate = gaDate;
  let queryTime = startTime;
  let cursorToken = `${queryDate} ${queryTime}`;

  for (let i = 0; i < maxBatches; i += 1) {
    const data = await fetchConnections(from, to, queryDate, queryTime, false, batchSize);
    const connections = data.connections ?? [];

    if (connections.length === 0) break;

    for (const connection of connections) {
      const key = connectionSignature(connection);
      if (seen.has(key)) continue;
      seen.add(key);

      if (
        isWithinGA(connection.from?.departure, gaDate) &&
        isWithinGA(connection.to?.arrival, gaDate)
      ) {
        results.push(connection);
      }
    }

    if (results.length >= targetCount) break;

    const lastDepartureIso = connections[connections.length - 1]?.from?.departure;
    if (!lastDepartureIso) break;
    if (!isBeforeOrAtWindowEnd(lastDepartureIso, gaDate)) break;

    const next = nextCursor(lastDepartureIso);
    const nextToken = `${next.date} ${next.time}`;
    if (nextToken === cursorToken) break;

    queryDate = next.date;
    queryTime = next.time;
    cursorToken = nextToken;
  }

  return results.sort((a, b) => {
    const aDep = a.from?.departure ? new Date(a.from.departure).getTime() : Number.POSITIVE_INFINITY;
    const bDep = b.from?.departure ? new Date(b.from.departure).getTime() : Number.POSITIVE_INFINITY;
    return aDep - bDep;
  });
}
