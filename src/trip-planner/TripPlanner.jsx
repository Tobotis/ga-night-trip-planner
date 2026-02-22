import { useCallback, useEffect, useState } from "react";

import { fetchConnections } from "./api";
import { CITIES, HOME } from "./constants";
import { nextDateOf, toDateStr } from "./date-utils";
import { formatDuration, formatTime } from "./format-utils";
import { isWithinGA, morningReturnQueryTime, nightGAWindow } from "./ga-window";
import { addMinutes, durationSeconds, splitDateTime } from "./trip-utils";
import ConnectionRow from "./components/ConnectionRow";
import SectionDetail from "./components/SectionDetail";
import TableHeader from "./components/TableHeader";

export default function TripPlanner() {
  const [mode, setMode] = useState("single");
  const [selectedCity, setSelectedCity] = useState(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    const daysUntilFri = ((5 - d.getDay() + 7) % 7) || 7;
    d.setDate(d.getDate() + daysUntilFri);
    return toDateStr(d);
  });
  const [outbound, setOutbound] = useState(null);
  const [returnTrips, setReturnTrips] = useState(null);
  const [morningReturn, setMorningReturn] = useState(null); // null=not needed, []=not found
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedOut, setExpandedOut] = useState(null);
  const [expandedRet, setExpandedRet] = useState(null);
  const [multiCity, setMultiCity] = useState([]);
  const [multiResults, setMultiResults] = useState(null);
  const [stayMinutes, setStayMinutes] = useState(60);
  const [compact, setCompact] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth < 560 : false)
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
        const [outData, retData] = await Promise.all([
          fetchConnections(HOME, city.station, date, "19:00", false, 6),
          fetchConnections(city.station, HOME, date, "19:00", false, 16),
        ]);

        const outConns = outData.connections ?? [];
        const retConns = retData.connections ?? [];
        setOutbound(outConns);
        setReturnTrips(retConns);

        const validRet = retConns.filter(
          (connection) =>
            isWithinGA(connection.from?.departure, date) && isWithinGA(connection.to?.arrival, date)
        );

        if (validRet.length === 0) {
          const morningTime = morningReturnQueryTime(date);
          try {
            const morningData = await fetchConnections(
              city.station,
              HOME,
              nextDateOf(date),
              morningTime,
              false,
              3
            );
            setMorningReturn(morningData.connections ?? []);
          } catch {
            setMorningReturn([]);
          }
        }
      } catch (fetchError) {
        setError(fetchError.message);
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

      const leg0Data = await fetchConnections(HOME, multiCity[0].station, date, "19:00", false, 3);
      legs.push({ from: HOME, to: multiCity[0].name, connections: leg0Data.connections ?? [] });

      for (let i = 0; i < multiCity.length - 1; i += 1) {
        const prevBestArr = legs[i].connections[0]?.to?.arrival;
        let depTime = "20:30";
        let legDate = date;

        if (prevBestArr) {
          const split = splitDateTime(addMinutes(prevBestArr, stayMinutes));
          depTime = split.time;
          legDate = split.date;
        }

        const legData = await fetchConnections(
          multiCity[i].station,
          multiCity[i + 1].station,
          legDate,
          depTime,
          false,
          3
        );
        legs.push({
          from: multiCity[i].name,
          to: multiCity[i + 1].name,
          connections: legData.connections ?? [],
        });
      }

      const lastCity = multiCity[multiCity.length - 1];
      const prevBestArr = legs[legs.length - 1].connections[0]?.to?.arrival;
      let retTime = "23:00";
      let retDate = date;

      if (prevBestArr) {
        const split = splitDateTime(addMinutes(prevBestArr, stayMinutes));
        retTime = split.time;
        retDate = split.date;
      }

      const retData = await fetchConnections(lastCity.station, HOME, retDate, retTime, false, 3);
      legs.push({ from: lastCity.name, to: HOME, connections: retData.connections ?? [] });

      setMultiResults(legs);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, [date, multiCity, stayMinutes]);

  const toggleMultiCity = (city) => {
    setMultiCity((previous) =>
      previous.some((c) => c.name === city.name)
        ? previous.filter((c) => c.name !== city.name)
        : [...previous, city]
    );
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setSelectedCity(null);
    setOutbound(null);
    setReturnTrips(null);
    setMorningReturn(null);
    setExpandedOut(null);
    setExpandedRet(null);
    setMultiResults(null);
  };

  return (
    <div
      style={{
        background: "#060608",
        color: "#e0e0e0",
        minHeight: "100vh",
        fontFamily: "'Segoe UI', -apple-system, system-ui, sans-serif",
      }}
    >
      <div style={{ background: "#0a0a10", borderBottom: "1px solid #1a1a2a", padding: "16px 20px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                🚂 Night GA Schedule Fetcher
              </h1>
              <p style={{ color: "#555", fontSize: "12px", margin: "2px 0 0" }}>
                Real timetable data via Swiss Transport API · from Zürich HB
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  gap: "2px",
                  background: "#111",
                  borderRadius: "6px",
                  padding: "2px",
                }}
              >
                {["single", "multi"].map((currentMode) => (
                  <button
                    key={currentMode}
                    onClick={() => switchMode(currentMode)}
                    style={{
                      background: mode === currentMode ? "#222" : "transparent",
                      color: mode === currentMode ? "#fff" : "#666",
                      border: "none",
                      borderRadius: "4px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {currentMode === "single" ? "Single City" : "Multi-City"}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
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
                  background: gaWindow.nextDayIsWeekend ? "#0a1a0a" : "#1a1a0a",
                  border: `1px solid ${gaWindow.nextDayIsWeekend ? "#166534" : "#854d0e"}`,
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  color: gaWindow.nextDayIsWeekend ? "#34d399" : "#fbbf24",
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
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#555",
              marginBottom: "8px",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {mode === "single" ? "Select destination" : "Select cities in order (click to add/remove)"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {CITIES.map((city) => {
              const isSelected =
                mode === "single"
                  ? selectedCity?.name === city.name
                  : multiCity.some((selected) => selected.name === city.name);
              const multiIndex = multiCity.findIndex((selected) => selected.name === city.name);

              return (
                <button
                  key={city.name}
                  onClick={() => (mode === "single" ? fetchTrip(city) : toggleMultiCity(city))}
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
                    <span
                      style={{
                        position: "absolute",
                        top: "-6px",
                        right: "-6px",
                        background: "#818cf8",
                        color: "#000",
                        borderRadius: "50%",
                        width: "16px",
                        height: "16px",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {multiIndex + 1}
                    </span>
                  )}
                  {city.name}
                </button>
              );
            })}
          </div>

          {mode === "multi" && multiCity.length > 0 && (
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "12px", color: "#666" }}>
                Zürich -> {multiCity.map((city) => city.name).join(" -> ")} -> Zürich
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#666" }}>
                Stay:
                <input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={stayMinutes}
                  onChange={(event) =>
                    setStayMinutes(Math.max(15, Math.min(240, Number(event.target.value))))
                  }
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
                disabled={loading}
                style={{
                  background: "#818cf8",
                  color: "#000",
                  border: "none",
                  borderRadius: "5px",
                  padding: "6px 16px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.4 : 1,
                }}
              >
                {loading ? "Fetching…" : "Fetch Schedule"}
              </button>
              <button
                onClick={() => {
                  setMultiCity([]);
                  setMultiResults(null);
                }}
                style={{
                  background: "transparent",
                  color: "#555",
                  border: "1px solid #222",
                  borderRadius: "5px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#818cf8", fontSize: "14px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🚂</div>
            Fetching real schedules from SBB…
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#1a0505",
              border: "1px solid #4a1515",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "#f87171",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            Error: {error}
          </div>
        )}

        {mode === "single" && selectedCity && !loading && (outbound || returnTrips) &&
          (() => {
            const displayReturn = returnTrips
              ? returnTrips.filter(
                  (connection) =>
                    isWithinGA(connection.from?.departure, date) &&
                    isWithinGA(connection.to?.arrival, date)
                )
              : null;

            return (
              <div>
                {[
                  {
                    title: `Zürich HB → ${selectedCity.name}`,
                    data: outbound,
                    expanded: expandedOut,
                    setExpanded: setExpandedOut,
                    dir: "out",
                  },
                  {
                    title: `${selectedCity.name} → Zürich HB`,
                    data: displayReturn,
                    expanded: expandedRet,
                    setExpanded: setExpandedRet,
                    dir: "ret",
                  },
                ].map(({ title, data, expanded, setExpanded, dir }) => (
                  <div key={dir} style={{ marginBottom: "16px" }}>
                    <h3
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#ccc",
                        margin: "0 0 8px",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {dir === "out" ? "→" : "←"} {title}
                    </h3>
                    <div
                      style={{
                        background: "#0c0c10",
                        border: "1px solid #1a1a1a",
                        borderRadius: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <TableHeader compact={compact} />
                      {data && data.length > 0 ? (
                        data.map((connection, index) => (
                          <div key={index}>
                            <div
                              onClick={() => setExpanded(expanded === index ? null : index)}
                              style={{ cursor: "pointer" }}
                            >
                              <ConnectionRow conn={connection} gaDate={date} compact={compact} />
                            </div>
                            {expanded === index && <SectionDetail conn={connection} />}
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

                {outbound && returnTrips && outbound.length > 0 && returnTrips.length > 0 &&
                  (() => {
                    const validOut = outbound.filter(
                      (connection) =>
                        isWithinGA(connection.from?.departure, date) &&
                        isWithinGA(connection.to?.arrival, date)
                    );
                    const validRet = returnTrips.filter(
                      (connection) =>
                        isWithinGA(connection.from?.departure, date) &&
                        isWithinGA(connection.to?.arrival, date)
                    );
                    const bestOut = validOut[0];
                    const bestRet = validRet.length > 0 ? validRet[validRet.length - 1] : null;
                    const groundTime =
                      bestOut?.to?.arrival && bestRet?.from?.departure
                        ? durationSeconds(bestOut.to.arrival, bestRet.from.departure)
                        : null;

                    return (
                      <div
                        style={{
                          background: "#0a0a14",
                          border: "1px solid #1a1a2a",
                          borderRadius: "8px",
                          padding: "14px 16px",
                          marginBottom: "16px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#818cf8",
                            margin: "0 0 10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Trip Analysis
                        </h3>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <div>
                            <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>
                              Valid outbound options
                            </div>
                            <div style={{ color: validOut.length > 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                              {validOut.length} of {outbound.length}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>
                              Valid return options
                            </div>
                            <div style={{ color: validRet.length > 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                              {validRet.length} of {returnTrips.length}
                            </div>
                          </div>
                          {bestOut && (
                            <div>
                              <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>
                                Earliest arrival
                              </div>
                              <div style={{ color: "#ccc", fontWeight: 600, fontFamily: "monospace" }}>
                                {formatTime(bestOut.to?.arrival)}
                              </div>
                            </div>
                          )}
                          {bestRet && (
                            <div>
                              <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>
                                Latest return dep.
                              </div>
                              <div style={{ color: "#ccc", fontWeight: 600, fontFamily: "monospace" }}>
                                {formatTime(bestRet.from?.departure)}
                              </div>
                            </div>
                          )}
                          {groundTime != null && groundTime > 0 && (
                            <div>
                              <div style={{ color: "#555", fontSize: "10px", marginBottom: "2px" }}>
                                Max time on ground
                              </div>
                              <div
                                style={{
                                  color:
                                    groundTime >= 3600
                                      ? "#34d399"
                                      : groundTime >= 1800
                                        ? "#fbbf24"
                                        : "#f87171",
                                  fontWeight: 600,
                                }}
                              >
                                {formatDuration(groundTime)}
                              </div>
                            </div>
                          )}

                          {validRet.length === 0 && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div style={{ color: "#f87171", fontSize: "12px", fontWeight: 500, marginBottom: "10px" }}>
                                No valid return within GA Night window ({gaWindow.end} cutoff). You'd need to
                                stay overnight or buy a supplementary ticket for the morning train back.
                              </div>
                              {morningReturn !== null && (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#fbbf24",
                                      fontWeight: 600,
                                      marginBottom: "6px",
                                    }}
                                  >
                                    First morning trains back to Zürich on {nextDate} (outside GA - separate
                                    ticket needed):
                                  </div>
                                  {morningReturn.length > 0 ? (
                                    <div
                                      style={{
                                        background: "#0c0c10",
                                        border: "1px solid #2a1500",
                                        borderRadius: "6px",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <TableHeader compact={compact} />
                                      {morningReturn.map((connection, index) => (
                                        <ConnectionRow
                                          key={index}
                                          conn={connection}
                                          gaDate={date}
                                          compact={compact}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: "11px", color: "#555" }}>
                                      No morning trains found.
                                    </div>
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
            );
          })()}

        {mode === "multi" && multiResults && !loading && (
          <div>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#ccc", margin: "0 0 12px" }}>
              Multi-City Route: Zürich -> {multiCity.map((city) => city.name).join(" -> ")} -> Zürich
            </h3>
            {multiResults.map((leg, legIndex) => (
              <div key={legIndex} style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#818cf8", marginBottom: "6px" }}>
                  Leg {legIndex + 1}: {leg.from} -> {leg.to}
                </div>
                <div
                  style={{
                    background: "#0c0c10",
                    border: "1px solid #1a1a1a",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <TableHeader compact={compact} />
                  {leg.connections.length > 0 ? (
                    leg.connections.map((connection, connectionIndex) => (
                      <ConnectionRow
                        key={connectionIndex}
                        conn={connection}
                        gaDate={date}
                        compact={compact}
                      />
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

        <div
          style={{
            marginTop: "20px",
            padding: "12px 16px",
            background: "#0a0a0e",
            border: "1px solid #1a1a1a",
            borderRadius: "8px",
            fontSize: "11px",
            color: "#555",
            lineHeight: 1.8,
          }}
        >
          <strong style={{ color: "#888" }}>How it works:</strong> Click a city to fetch real SBB timetable data for
          your selected date. Outbound shows departures from 19:00. Return shows arrivals back in Zürich before {" "}
          {gaWindow.end}. <span style={{ color: "#34d399" }}>✓</span> = within GA Night validity. {" "}
          <span style={{ opacity: 0.4 }}>Dimmed</span> = outside GA window (you'd need a ticket). Click any row to
          expand the full route with stops and platforms. Results are cached per route and date for the session. In
          Multi-City mode, the "Stay" input sets how long after each arrival the next leg departs.
        </div>
      </div>
    </div>
  );
}
