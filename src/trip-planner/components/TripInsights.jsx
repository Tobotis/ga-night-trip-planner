import { useEffect, useMemo, useState } from "react";

import {
  analyzeConnection,
  listRoundTripCandidates,
  recommendRoundTrips,
} from "../connection-analysis";
import { formatDuration, formatTime } from "../format-utils";

const STAY_PRESETS = [
  {
    id: "quick",
    label: "Quick",
    minGroundMinutes: 45,
    maxGroundMinutes: 120,
    preferredGroundMinutes: 90,
    hint: "45-120m",
    color: "#22d3ee",
  },
  {
    id: "balanced",
    label: "Balanced",
    minGroundMinutes: 120,
    maxGroundMinutes: 240,
    preferredGroundMinutes: 180,
    hint: "2-4h",
    color: "#818cf8",
  },
  {
    id: "long",
    label: "Long",
    minGroundMinutes: 240,
    maxGroundMinutes: null,
    preferredGroundMinutes: 300,
    hint: "4h+",
    color: "#f59e0b",
  },
];

const STAY_DISTRIBUTION_BINS = [
  { label: "45-120m", minMinutes: 45, maxMinutes: 120 },
  { label: "2-4h", minMinutes: 120, maxMinutes: 240 },
  { label: "4-6h", minMinutes: 240, maxMinutes: 360 },
  { label: "6-8h", minMinutes: 360, maxMinutes: 480 },
  { label: "8h+", minMinutes: 480, maxMinutes: Number.POSITIVE_INFINITY },
];

function isInPresetWindow(minutes, preset) {
  const max = preset.maxGroundMinutes == null ? Number.POSITIVE_INFINITY : preset.maxGroundMinutes;
  return minutes >= preset.minGroundMinutes && minutes < max;
}

function averageTransferWaitPerEvent(items) {
  const analyses = items.map(({ connection }) => analyzeConnection(connection));
  const totalEvents = analyses.reduce((sum, analysis) => sum + analysis.waitCount, 0);
  if (totalEvents === 0) return null;

  const totalWaitSec = analyses.reduce((sum, analysis) => sum + analysis.transferWaitSec, 0);
  return {
    avgSec: totalWaitSec / totalEvents,
    totalEvents,
  };
}

function buildStayDistribution(candidates, presets) {
  const rows = STAY_DISTRIBUTION_BINS.map((bin) => ({
    ...bin,
    count: 0,
    byPreset: Object.fromEntries(presets.map((preset) => [preset.id, 0])),
  }));

  for (const candidate of candidates) {
    const minutes = candidate.groundSec / 60;
    const row = rows.find((bin) => minutes >= bin.minMinutes && minutes < bin.maxMinutes);
    if (!row) continue;

    row.count += 1;

    for (const preset of presets) {
      if (isInPresetWindow(minutes, preset)) {
        row.byPreset[preset.id] += 1;
      }
    }
  }

  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);
  return {
    rows,
    maxCount: maxCount || 1,
    total: candidates.length,
  };
}

function RecommendationCard({ title, subtitle, candidate, onFocusPair }) {
  return (
    <div
      style={{
        border: "1px solid #202038",
        borderRadius: "6px",
        padding: "9px 10px",
        background: "#0d0d18",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: "12px" }}>{title}</div>
          <div style={{ color: "#8f94a8", fontSize: "11px" }}>{subtitle}</div>
        </div>
        <button
          onClick={() => onFocusPair?.(candidate.outbound.item.tableIndex, candidate.ret.item.tableIndex)}
          style={{
            background: "#1f2540",
            color: "#c7d2fe",
            border: "1px solid #313d72",
            borderRadius: "5px",
            padding: "3px 8px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          Focus
        </button>
      </div>

      <div style={{ marginTop: "6px", fontSize: "11px", color: "#c9ccd6" }}>
        Out #{candidate.outbound.item.tableIndex + 1}: {formatTime(candidate.outbound.metrics.departureIso)} ->{" "}
        {formatTime(candidate.outbound.metrics.arrivalIso)}
      </div>
      <div style={{ marginTop: "2px", fontSize: "11px", color: "#c9ccd6" }}>
        Ret #{candidate.ret.item.tableIndex + 1}: {formatTime(candidate.ret.metrics.departureIso)} ->{" "}
        {formatTime(candidate.ret.metrics.arrivalIso)}
      </div>

      <div style={{ marginTop: "6px", fontSize: "11px", color: "#a5a9bb" }}>
        Travel {formatDuration(candidate.totalTravelSec)} · Transfers {candidate.totalTransfers} · City {formatDuration(candidate.groundSec)}
      </div>
    </div>
  );
}

export default function TripInsights({
  selectedCity,
  outbound,
  displayReturn,
  onFocusPair,
}) {
  const outboundItems = (outbound || []).map((connection, index) => ({
    connection,
    tableIndex: index,
  }));

  const returnItems = (displayReturn || []).map((connection, index) => ({
    connection,
    tableIndex: index,
  }));

  const allCandidates = useMemo(
    () => listRoundTripCandidates(outboundItems, returnItems, { minGroundMinutes: 45 }),
    [outboundItems, returnItems]
  );

  const presetRecommendations = useMemo(() => {
    const byId = {};

    for (const preset of STAY_PRESETS) {
      byId[preset.id] = recommendRoundTrips(outboundItems, returnItems, {
        minGroundMinutes: preset.minGroundMinutes,
        maxGroundMinutes: preset.maxGroundMinutes,
        preferredGroundMinutes: preset.preferredGroundMinutes,
      });
    }

    return byId;
  }, [outboundItems, returnItems]);

  const stayDistribution = useMemo(
    () => buildStayDistribution(allCandidates, STAY_PRESETS),
    [allCandidates]
  );

  const [stayPresetId, setStayPresetId] = useState("balanced");

  const availablePresetIds = STAY_PRESETS
    .filter((preset) => (presetRecommendations[preset.id]?.candidatesCount ?? 0) > 0)
    .map((preset) => preset.id);

  useEffect(() => {
    if (availablePresetIds.includes(stayPresetId)) return;
    if (availablePresetIds.length > 0) {
      setStayPresetId(availablePresetIds[0]);
    }
  }, [availablePresetIds, stayPresetId]);

  const activePreset = STAY_PRESETS.find((preset) => preset.id === stayPresetId) || STAY_PRESETS[1];
  const rec = presetRecommendations[activePreset.id] || {
    bestOverall: null,
    fastest: null,
    candidatesCount: 0,
    mode: "none",
    hasAnyDirect: false,
  };

  const avgWait = averageTransferWaitPerEvent([...outboundItems, ...returnItems]);
  const showFastestSeparately =
    rec.fastest && rec.bestOverall && rec.fastest.key !== rec.bestOverall.key;

  return (
    <div
      style={{
        background: "#0a0a14",
        border: "1px solid #1a1a2a",
        borderRadius: "8px",
        padding: "12px 14px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <h3
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#818cf8",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Smart Picks · {selectedCity?.name}
        </h3>
        <div style={{ color: "#8b90a6", fontSize: "11px" }}>
          {outboundItems.length} out · {returnItems.length} ret
        </div>
      </div>

      {stayDistribution.total > 0 && (
        <div
          style={{
            marginBottom: "10px",
            background: "#0d0d18",
            border: "1px solid #1d2132",
            borderRadius: "8px",
            padding: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
              color: "#8f94a8",
              fontSize: "10px",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span>Stay-Time Distribution</span>
            <span>{stayDistribution.total} total combos</span>
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            {STAY_PRESETS.map((preset) => {
              const count = presetRecommendations[preset.id]?.candidatesCount ?? 0;
              const available = count > 0;
              const active = preset.id === activePreset.id;

              return (
                <button
                  key={preset.id}
                  onClick={() => setStayPresetId(preset.id)}
                  disabled={!available}
                  style={{
                    border: `1px solid ${active ? preset.color : "#25273a"}`,
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    cursor: available ? "pointer" : "not-allowed",
                    background: active ? "#1a2042" : "#111322",
                    color: available ? (active ? "#e3e8ff" : "#9ea3b9") : "#5e6275",
                    opacity: available ? 1 : 0.5,
                  }}
                  title={available ? `${preset.hint} · ${count} possible combinations` : "No feasible combinations"}
                >
                  {preset.label} {preset.hint} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: "4px" }}>
            {stayDistribution.rows.map((row) => {
              const totalWidth = row.count === 0
                ? 0
                : Math.max((row.count / stayDistribution.maxCount) * 100, 8);
              const activeCount = row.byPreset[activePreset.id] ?? 0;
              const activeWidth = activeCount === 0
                ? 0
                : Math.max((activeCount / stayDistribution.maxCount) * 100, 4);

              return (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "58px 1fr 44px",
                    gap: "6px",
                    alignItems: "center",
                    fontSize: "10px",
                    color: "#8f94a8",
                  }}
                >
                  <span>{row.label}</span>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "999px",
                      background: "#171927",
                      border: "1px solid #23283b",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${totalWidth}%`,
                        height: "100%",
                        background: "#475569",
                        position: "absolute",
                        left: 0,
                        top: 0,
                      }}
                    />
                    <div
                      style={{
                        width: `${activeWidth}%`,
                        height: "100%",
                        background: activePreset.color,
                        position: "absolute",
                        left: 0,
                        top: 0,
                      }}
                    />
                  </div>
                  <span style={{ textAlign: "right" }}>{activeCount}/{row.count}</span>
                </div>
              );
            })}
          </div>

          <div style={{ color: "#7a8096", fontSize: "10px", marginTop: "6px" }}>
            Colored bar = selected profile · gray = all feasible combos.
          </div>
        </div>
      )}

      <div style={{ color: "#9aa0b5", fontSize: "11px", marginBottom: "10px" }}>
        Stay target: {activePreset.hint}. {rec.hasAnyDirect
          ? "Direct options exist: layover waiting is ignored for best-overall ranking."
          : avgWait
            ? `No direct options. Avg wait per transfer is ${formatDuration(avgWait.avgSec)} (${avgWait.totalEvents} transfer events).`
            : "No direct options and no transfer-wait signal available yet."}
      </div>

      {rec.bestOverall ? (
        <div style={{ display: "grid", gap: "8px" }}>
          <RecommendationCard
            title="Best Overall"
            subtitle={
              rec.mode === "both_direct"
                ? "Directness + chosen city-time target"
                : rec.mode === "any_direct"
                  ? "Prefer more direct legs, then city-time target"
                  : "Transfer quality + chosen city-time target"
            }
            candidate={rec.bestOverall}
            onFocusPair={onFocusPair}
          />

          {showFastestSeparately ? (
            <RecommendationCard
              title="Fastest Total Travel"
              subtitle="Pure shortest combined travel time"
              candidate={rec.fastest}
              onFocusPair={onFocusPair}
            />
          ) : (
            <div style={{ color: "#8f94a8", fontSize: "11px" }}>
              Fastest total travel is the same route as Best Overall.
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: "#fbbf24", fontSize: "12px" }}>
          No feasible round-trip pair found for the selected stay profile.
        </div>
      )}
    </div>
  );
}
