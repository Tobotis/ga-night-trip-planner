export default function TableHeader({ compact }) {
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
