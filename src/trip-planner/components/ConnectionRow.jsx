import { isWithinGA } from "../ga-window";
import { formatTime, parseSbbDuration } from "../format-utils";

export default function ConnectionRow({ conn, gaDate, compact }) {
  const dep = conn.from?.departure;
  const arr = conn.to?.arrival;
  const transfers = conn.transfers;
  const sections = conn.sections || [];

  const valid = isWithinGA(dep, gaDate) && isWithinGA(arr, gaDate);

  const products = sections
    .filter((section) => section.journey)
    .map((section) => `${section.journey.category ?? ""}${section.journey.number ?? ""}`.trim())
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
      <span
        style={{
          fontFamily: "monospace",
          fontSize: compact ? "12px" : "14px",
          fontWeight: 600,
          color: "#e0e0e0",
        }}
      >
        {formatTime(dep)}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: compact ? "12px" : "14px",
          fontWeight: 600,
          color: "#e0e0e0",
        }}
      >
        {formatTime(arr)}
      </span>
      {!compact && (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>
          {parseSbbDuration(conn.duration)}
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
        {products.map((product, index) => (
          <span
            key={index}
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
            {product}
          </span>
        ))}
      </div>
      <span style={{ fontSize: "14px", textAlign: "center", color: valid ? "#34d399" : "#f87171" }}>
        {valid ? "✓" : "✗"}
      </span>
    </div>
  );
}
