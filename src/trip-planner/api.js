import { API } from "./constants";

// Module-level response cache keyed by full request URL.
const apiCache = new Map();

export async function fetchConnections(from, to, date, time, isArrival = false, limit = 6) {
  const params = new URLSearchParams({ from, to, date, time, limit: String(limit) });
  if (isArrival) params.set("isArrivalTime", "1");

  const url = `${API}/connections?${params}`;
  if (apiCache.has(url)) return apiCache.get(url);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);

  const data = await resp.json();
  apiCache.set(url, data);
  return data;
}
