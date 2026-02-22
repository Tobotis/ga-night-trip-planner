import { useState, useCallback, useEffect } from "react";

const API = "https://transport.opendata.ch/v1";

const CITIES = [
  { name: "Arosa", station: "Arosa" },
  { name: "Basel", station: "Basel SBB" },
  { name: "Bellinzona", station: "Bellinzona" },
  { name: "Bern", station: "Bern" },
  { name: "Biel/Bienne", station: "Biel/Bienne" },
  { name: "Brienz", station: "Brienz (BE)" },
  { name: "Davos", station: "Davos Platz" },
  { name: "Geneva", station: "Genève" },
  { name: "Grindelwald", station: "Grindelwald" },
  { name: "Interlaken", station: "Interlaken Ost" },
  { name: "Köniz", station: "Köniz" },
  { name: "La Chaux-de-Fonds", station: "La Chaux-de-Fonds" },
  { name: "Lauterbrunnen", station: "Lauterbrunnen" },
  { name: "Lausanne", station: "Lausanne" },
  { name: "Locarno", station: "Locarno" },
  { name: "Lucerne", station: "Luzern" },
  { name: "Lugano", station: "Lugano" },
  { name: "Montreux", station: "Montreux" },
  { name: "Pontresina", station: "Pontresina" },
  { name: "Rapperswil SG", station: "Rapperswil SG" },
  { name: "Schaffhausen", station: "Schaffhausen" },
  { name: "Sion", station: "Sion" },
  { name: "St. Gallen", station: "St. Gallen" },
  { name: "St. Moritz", station: "St. Moritz" },
  { name: "Stein am Rhein", station: "Stein am Rhein" },
  { name: "Thun", station: "Thun" },
  { name: "Winterthur", station: "Winterthur" },
  { name: "Zermatt", station: "Zermatt" },
];

const HOME = "Zürich HB";

// Module-level response cache keyed by full request URL
const apiCache = new Map();

function formatTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function durationSeconds(dep, arr) {
  if (!dep || !arr) return null;
  return (new Date(arr) - new Date(dep)) / 1000;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isWeekend(dateStr) {
  const d = parseDate(dateStr);
  return d.getDay() === 0 || d.getDay() === 6;
}

function nightGAWindow(dateStr) {
  const we = isWeekend(dateStr);
  return {
    start: "19:00",
    end: we ? "07:00" : "05:00",
    label: we ? "19:00–07:00 (weekend)" : "19:00–05:00 (weekday)",
    isWeekend: we,
  };
}

function isWithinGA(isoStr, gaDate) {
  if (!isoStr) return true;
  const d = new Date(isoStr);
  const timeMin = d.getHours() * 60 + d.getMinutes();
  const we = isWeekend(gaDate);
  const endMin = we ? 7 * 60 : 5 * 60;
  if (timeMin >= 19 * 60) return true; // after 19:00 same day
  if (timeMin < endMin) return true;   // before end next morning
  return false;
}

async function fetchConnections(from, to, date, time, isArrival = false, limit = 6) {
  const params = new URLSearchParams({ from, to, date, time, limit: String(limit) });
  if (isArrival) params.set("isArrivalTime", "1");
  const url = `${API}/connections?${params}`;
  if (apiCache.has(url)) return apiCache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const data = await resp.json();
  apiCache.set(url, data);
  return data;
}

function addMinutes(isoStr, minutes) {
  const d = new Date(isoStr);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function nextDateOf(dateStr) {
  const d = new Date(parseDate(dateStr));
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Returns "HH:MM" and the date string (same day or +1) for a Date object, relative to a base date
function splitDateTime(d, baseDate) {
  const time = d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", hour12: false });
  const h = d.getHours();
  // If hour is 0–11, it's past midnight → use next day's date
  const date = h < 12 ? nextDateOf(baseDate) : baseDate;
  return { time, date };
}

function TableHeader({ compact }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "56px 56px 1fr 28px" : "70px 70px 80px 50px 1fr 36px",
        gap: compact ? "6px" : "8px",
        padding: "6px 12px",
        borderBottom: "1px solid #1a1a1a",
        fontSize: "10px",
        color: "#555",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      <span>Dep</span>
      <span>Arr</span>
      {!compact && <span>Duration</span>}
      {!compact && <span>Chg</span>}
      <span>Trains</span>
      <span style={{ textAlign: "center" }}>GA</span>
    </div>
  );
}

function ConnectionRow({ conn, gaDate, compact }) {
  const dep = conn.from?.departure;
  const arr = conn.to?.arrival;
  const dur = conn.duration;
  const transfers = conn.transfers;
  const sections = conn.sections || [];

  const valid = isWithinGA(dep, gaDate) && isWithinGA(arr, gaDate);

  const products = sections
    .filter((s) => s.journey)
    .map((s) => `${s.journey.category || ""}${s.journey.number || ""}`.trim())
    .filter(Boolean);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "56px 56px 1fr 28px" : "70px 70px 80px 50px 1fr 36px",
        alignItems: "center",
        gap: compact ? "6px" : "8px",
        padding: "8px 12px",
        borderBottom: "1px solid #1a1a1a",
        opacity: valid ? 1 : 0.4,
        background: valid ? "transparent" : "#0a0000",
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: compact ? "12px" : "14px", fontWeight: 600, color: "#e0e0e0" }}>
        {formatTime(dep)}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: compact ? "12px" : "14px", fontWeight: 600, color: "#e0e0e0" }}>
        {formatTime(arr)}
      </span>
      {!compact && (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>
          {dur ? dur.replace("00d", "").replace(":", "h ").replace(":", "m") : "—"}
        </span>
      )}
      {!compact && (
        <span
          style={{
            fontSize: "11px",
            color: transfers === 0 ? "#34d399" : transfers === 1 ? "#fbbf24" : "#fb923c",
            fontWeight: 500,
          }}
        >
          {transfers === 0 ? "direct" : `${transfers}×`}
        </span>
      )}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {products.map((p, i) => (
          <span
            key={i}
            style={{
              background: "#1a1a2a",
              color: "#818cf8",
              padding: "1px 6px",
              borderRadius: "3px",
              fontSize: "10px",
              fontFamily: "monospace",
              fontWeight: 500,
            }}
          >
            {p}
          </span>
        ))}
      </div>
      <span style={{ fontSize: "14px", textAlign: "center" }}>{valid ? "✓" : "✗"}</span>
    </div>
  );
}

function SectionDetail({ conn }) {
  const sections = conn.sections || [];
  return (
    <div style={{ padding: "8px 12px 12px", background: "#080810" }}>
      {sections.map((sec, i) => {
        if (sec.journey) {
          const cat = sec.journey.category || "";
          const num = sec.journey.number || "";
          return (
            <div key={i} style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "12px", alignItems: "baseline" }}>
              <span style={{ color: "#818cf8", fontFamily: "monospace", minWidth: "55px", fontWeight: 500 }}>
                {cat}{num}
              </span>
              <span style={{ color: "#666" }}>
                {formatTime(sec.departure?.departure)} {sec.departure?.station?.name}
              </span>
              <span style={{ color: "#444" }}>→</span>
              <span style={{ color: "#666" }}>
                {formatTime(sec.arrival?.arrival)} {sec.arrival?.station?.name}
              </span>
              {sec.departure?.platform && (
                <span style={{ color: "#444", fontSize: "10px" }}>Gl.{sec.departure.platform}</span>
              )}
            </div>
          );
        }
        if (sec.walk) {
          return (
            <div key={i} style={{ fontSize: "11px", color: "#555", padding: "2px 0", fontStyle: "italic" }}>
              🚶 Walk {sec.walk.duration ? `${Math.round(sec.walk.duration / 60)} min` : ""}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function TripPlanner() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilFri = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFri);
    return d.toISOString().slice(0, 10);
  });
  const [outbound, setOutbound] = useState(null);
  const [returnTrips, setReturnTrips] = useState(null);
  const [morningReturn, setMorningReturn] = useState(null); // null=not needed, []=not found, [...]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedOut, setExpandedOut] = useState(null);
  const [expandedRet, setExpandedRet] = useState(null);
  const [multiCity, setMultiCity] = useState([]);
  const [multiResults, setMultiResults] = useState(null);
  const [stayMinutes, setStayMinutes] = useState(60);
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 560 : false
  );

  useEffect(() => {
    const handler = () => setCompact(window.innerWidth < 560);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const gaWindow = nightGAWindow(date);
  const nextDate = nextDateOf(date);

  const fetchTrip = useCallback(
    async (city) => {
      setLoading(true);
      setError(null);
      setOutbound(null);
      setReturnTrips(null);
      setMorningReturn(null);
      setExpandedOut(null);
      setExpandedRet(null);
      setSelectedCity(city);
      setMultiResults(null);

      try {
        const outData = await fetchConnections(HOME, city.station, date, "19:00", false, 6);

        const we = isWeekend(date);
        const nd = nextDateOf(date);
        // Departure-based search from 19:00, higher limit → shows full spread of night trains
        const retData = await fetchConnections(city.station, HOME, date, "19:00", false, 16);

        const outConns = outData.connections || [];
        const retConns = retData.connections || [];
        setOutbound(outConns);
        setReturnTrips(retConns);

        // If no valid GA returns, auto-fetch morning trains after the cutoff
        const validRet = retConns.filter(
          (c) => isWithinGA(c.from?.departure, date) && isWithinGA(c.to?.arrival, date)
        );
        if (validRet.length === 0) {
          try {
            const morningTime = we ? "07:01" : "05:01";
            const morningData = await fetchConnections(city.station, HOME, nd, morningTime, false, 3);
            setMorningReturn(morningData.connections || []);
          } catch {
            setMorningReturn([]);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [date]
  );

  const fetchMulti = useCallback(async () => {
    if (multiCity.length < 1) return;
    setLoading(true);
    setError(null);
    setSelectedCity(null);
    setOutbound(null);
    setReturnTrips(null);
    setMorningReturn(null);
    setMultiResults(null);

    try {
      const legs = [];

      // Leg 0: ZH → first city, depart 19:00
      const first = multiCity[0];
      const leg0 = await fetchConnections(HOME, first.station, date, "19:00", false, 3);
      legs.push({ from: HOME, to: first.name, connections: leg0.connections || [] });

      // Intermediate legs — depart stayMinutes after previous leg's best arrival
      for (let i = 0; i < multiCity.length - 1; i++) {
        const fromCity = multiCity[i];
        const toCity = multiCity[i + 1];
        const prevBest = legs[i].connections[0];
        let depTime = "20:30";
        let legDate = date;
        if (prevBest?.to?.arrival) {
          const d = addMinutes(prevBest.to.arrival, stayMinutes);
          const split = splitDateTime(d, date);
          depTime = split.time;
          legDate = split.date;
        }
        const legData = await fetchConnections(fromCity.station, toCity.station, legDate, depTime, false, 3);
        legs.push({ from: fromCity.name, to: toCity.name, connections: legData.connections || [] });
      }

      // Final leg: last city → ZH, depart stayMinutes after previous leg's best arrival
      const lastCity = multiCity[multiCity.length - 1];
      const prevBest2 = legs[legs.length - 1].connections[0];
      let retTime = "23:00";
      let retDate = date;
      if (prevBest2?.to?.arrival) {
        const d = addMinutes(prevBest2.to.arrival, stayMinutes);
        const split = splitDateTime(d, date);
        retTime = split.time;
        retDate = split.date;
      }
      const retData = await fetchConnections(lastCity.station, HOME, retDate, retTime, false, 3);
      legs.push({ from: lastCity.name, to: "Zürich HB", connections: retData.connections || [] });

      setMultiResults(legs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date, multiCity, stayMinutes]);

  const toggleMultiCity = (city) => {
    setMultiCity((prev) => {
      const exists = prev.find((c) => c.name === city.name);
      if (exists) return prev.filter((c) => c.name !== city.name);
      return [...prev, city];
    });
  };

  const [mode, setMode] = useState("single");

  return (
    <div
      style={{
        background: "#060608",
        color: "#e0e0e0",
        minHeight: "100vh",
        fontFamily: "'Segoe UI', -apple-system, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ background: "#0a0a10", borderBottom: "1px solid #1a1a2a", padding: "16px 20px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                🚂 Night GA Schedule Fetcher
              </h1>
              <p style={{ color: "#555", fontSize: "12px", margin: "2px 0 0" }}>
                Real timetable data via Swiss Transport API · from Zürich HB
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "2px", background: "#111", borderRadius: "6px", padding: "2px" }}>
                {["single", "multi"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setMultiResults(null); setOutbound(null); setReturnTrips(null); setMorningReturn(null); }}
                    style={{
                      background: mode === m ? "#222" : "transparent",
                      color: mode === m ? "#fff" : "#666",
                      border: "none",
                      borderRadius: "4px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {m === "single" ? "Single City" : "Multi-City"}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  background: "#111",
                  color: "#e0e0e0",
                  border: "1px solid #2a2a2a",
                  borderRadius: "6px",
                  padding: "6px 10px",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
              <div
                style={{
                  background: gaWindow.isWeekend ? "#0a1a0a" : "#1a1a0a",
                  border: `1px solid ${gaWindow.isWeekend ? "#166534" : "#854d0e"}`,
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  color: gaWindow.isWeekend ? "#34d399" : "#fbbf24",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                GA: {gaWindow.label}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px 20px" }}>
        {/* City selection */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", color: "#555", marginBottom: "8px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {mode === "single" ? "Select destination" : "Select cities in order (click to add/remove)"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {CITIES.map((city) => {
              const isSelected = mode === "single"
                ? selectedCity?.name === city.name
                : multiCity.some((c) => c.name === city.name);
              const multiIndex = multiCity.findIndex((c) => c.name === city.name);
              return (
                <button
                  key={city.name}
                  onClick={() => mode === "single" ? fetchTrip(city) : toggleMultiCity(city)}
                  style={{
                    background: isSelected ? "#1a1a2e" : "#0e0e12",
                    color: isSelected ? "#818cf8" : "#888",
                    border: `1px solid ${isSelected ? "#333366" : "#1a1a1a"}`,
                    borderRadius: "5px",
                    padding: "5px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: isSelected ? 600 : 400,
                    position: "relative",
                    transition: "all 0.15s",
                  }}
                >
                  {mode === "multi" && multiIndex >= 0 && (
                    <span style={{
                      position: "absolute", top: "-6px", right: "-6px",
                      background: "#818cf8", color: "#000", borderRadius: "50%",
                      width: "16px", height: "16px", fontSize: "10px", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{multiIndex + 1}</span>
                  )}
                  {city.name}
                </button>
              );
            })}
          </div>

          {/* Multi-city controls */}
          {mode === "multi" && multiCity.length > 0 && (
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#666" }}>
                Zürich → {multiCity.map((c) => c.name).join(" → ")} → Zürich
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#666" }}>
                Stay:
                <input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={stayMinutes}
                  onChange={(e) => setStayMinutes(Math.max(15, Number(e.target.value)))}
                  style={{
                    width: "52px",
                    background: "#111",
                    color: "#e0e0e0",
                    border: "1px solid #2a2a2a",
                    borderRadius: "4px",
                    padding: "3px 6px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                min
              </label>
              <button
                onClick={fetchMulti}
                disabled={multiCity.length < 1 || loading}
                style={{
                  background: "#818cf8",
                  color: "#000",
                  border: "none",
                  borderRadius: "5px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: multiCity.length < 1 || loading ? 0.4 : 1,
                }}
              >
                {loading ? "Fetching…" : "Fetch Schedule"}
              </button>
              <button
                onClick={() => { setMultiCity([]); setMultiResults(null); }}
                style={{
                  background: "transparent", color: "#555", border: "1px solid #222",
                  borderRadius: "5px", padding: "5px 10px", fontSize: "11px", cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#818cf8", fontSize: "14px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", animation: "spin 1s linear infinite" }}>🚂</div>
            Fetching real schedules from SBB…
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {error && (
          <div style={{ background: "#1a0505", border: "1px solid #4a1515", borderRadius: "8px", padding: "12px 16px", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>
            Error: {error}
          </div>
        )}

        {/* Single city results */}
        {mode === "single" && selectedCity && !loading && (outbound || returnTrips) && (
          <div>
            {[
              { title: `Zürich HB → ${selectedCity.name}`, data: outbound, expanded: expandedOut, setExpanded: setExpandedOut, dir: "out" },
              { title: `${selectedCity.name} → Zürich HB`, data: returnTrips, expanded: expandedRet, setExpanded: setExpandedRet, dir: "ret" },
            ].map(({ title, data, expanded, setExpanded, dir }) => (
              <div key={dir} style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#ccc", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
                  {dir === "out" ? "→" : "←"} {title}
                </h3>
                <div style={{ background: "#0c0c10", border: "1px solid #1a1a1a", borderRadius: "8px", overflow: "hidden" }}>
                  <TableHeader compact={compact} />
                  {data && data.length > 0 ? (
                    data.map((conn, i) => (
                      <div key={i}>
                        <div onClick={() => setExpanded(expanded === i ? null : i)} style={{ cursor: "pointer" }}>
                          <ConnectionRow conn={conn} gaDate={date} compact={compact} />
                        </div>
                        {expanded === i && <SectionDetail conn={conn} />}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", color: "#555", fontSize: "12px" }}>
                      No connections found for this time window.
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Trip analysis */}
            {outbound && returnTrips && outbound.length > 0 && returnTrips.length > 0 && (() => {
              const validOut = outbound.filter((c) => isWithinGA(c.from?.departure, date) && isWithinGA(c.to?.arrival, date));
              const validRet = returnTrips.filter((c) => isWithinGA(c.from?.departure, date) && isWithinGA(c.to?.arrival, date));
              const bestOut = validOut[0];
              const bestRet = validRet.length > 0 ? validRet[validRet.length - 1] : null;

              const groundTime = bestOut?.to?.arrival && bestRet?.from?.departure
                ? durationSeconds(bestOut.to.arrival, bestRet.from.departure)
                : null;

              return (
                <div style={{ background: "#0a0a14", border: "1px solid #1a1a2a", borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#818cf8", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Trip Analysis
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", fontSize: "12px" }}>
                    <div>
                      <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>Valid outbound options</div>
                      <div style={{ color: validOut.length > 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>{validOut.length} of {outbound.length}</div>
                    </div>
                    <div>
                      <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>Valid return options</div>
                      <div style={{ color: validRet.length > 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>{validRet.length} of {returnTrips.length}</div>
                    </div>
                    {bestOut && (
                      <div>
                        <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>Earliest arrival</div>
                        <div style={{ color: "#ccc", fontWeight: 600, fontFamily: "monospace" }}>{formatTime(bestOut.to?.arrival)}</div>
                      </div>
                    )}
                    {bestRet && (
                      <div>
                        <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>Latest return dep.</div>
                        <div style={{ color: "#ccc", fontWeight: 600, fontFamily: "monospace" }}>{formatTime(bestRet.from?.departure)}</div>
                      </div>
                    )}
                    {groundTime !== null && groundTime > 0 && (
                      <div>
                        <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>Max time on ground</div>
                        <div style={{
                          color: groundTime >= 3600 ? "#34d399" : groundTime >= 1800 ? "#fbbf24" : "#f87171",
                          fontWeight: 600,
                        }}>
                          {formatDuration(groundTime)}
                        </div>
                      </div>
                    )}

                    {/* Overnight gap: show morning trains */}
                    {validRet.length === 0 && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ color: "#f87171", fontSize: "12px", fontWeight: 500, marginBottom: "10px" }}>
                          ⚠️ No valid return within GA Night window ({gaWindow.isWeekend ? "07:00" : "05:00"} cutoff).
                          You'd need to stay overnight or buy a supplementary ticket for the morning train back.
                        </div>
                        {morningReturn !== null && (
                          <div>
                            <div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 600, marginBottom: "6px" }}>
                              First morning trains back to Zürich on {nextDate} (outside GA — separate ticket needed):
                            </div>
                            {morningReturn.length > 0 ? (
                              <div style={{ background: "#0c0c10", border: "1px solid #2a1500", borderRadius: "6px", overflow: "hidden" }}>
                                <TableHeader compact={compact} />
                                {morningReturn.map((conn, i) => (
                                  <ConnectionRow key={i} conn={conn} gaDate={date} compact={compact} />
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: "11px", color: "#555" }}>No morning trains found.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Multi-city results */}
        {mode === "multi" && multiResults && !loading && (
          <div>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#ccc", margin: "0 0 12px" }}>
              Multi-City Route: Zürich → {multiCity.map((c) => c.name).join(" → ")} → Zürich
            </h3>
            {multiResults.map((leg, li) => (
              <div key={li} style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#818cf8", marginBottom: "6px" }}>
                  Leg {li + 1}: {leg.from} → {leg.to}
                </div>
                <div style={{ background: "#0c0c10", border: "1px solid #1a1a1a", borderRadius: "8px", overflow: "hidden" }}>
                  <TableHeader compact={compact} />
                  {leg.connections.length > 0 ? (
                    leg.connections.map((conn, ci) => (
                      <ConnectionRow key={ci} conn={conn} gaDate={date} compact={compact} />
                    ))
                  ) : (
                    <div style={{ padding: "12px", textAlign: "center", color: "#555", fontSize: "12px" }}>
                      No connections found for this leg at this time.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !outbound && !multiResults && !error && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#333" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🇨🇭</div>
            <div style={{ fontSize: "14px", color: "#555" }}>
              {mode === "single"
                ? "Select a city to fetch real SBB schedules"
                : "Select cities in order, then click Fetch Schedule"}
            </div>
            <div style={{ fontSize: "11px", color: "#333", marginTop: "6px" }}>
              Connections are fetched live from transport.opendata.ch
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: "20px", padding: "12px 16px", background: "#0a0a0e", border: "1px solid #1a1a1a", borderRadius: "8px", fontSize: "11px", color: "#555", lineHeight: 1.8 }}>
          <strong style={{ color: "#888" }}>How it works:</strong> Click a city to fetch real SBB timetable data for your selected date.
          Outbound shows departures from 19:00. Return shows arrivals back in Zürich before {gaWindow.isWeekend ? "07:00" : "05:00"}.
          <span style={{ color: "#34d399" }}> ✓</span> = within GA Night validity. <span style={{ opacity: 0.4 }}>Dimmed</span> = outside GA window (you'd need a ticket).
          Click any row to expand the full route with stops and platforms.
          Results are cached for the session — switching dates clears the cache.
          In Multi-City mode, the "Stay" input sets how long after each arrival the next leg departs.
        </div>
      </div>
    </div>
  );
}

export default TripPlanner;
