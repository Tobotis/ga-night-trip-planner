import { formatTime } from "../format-utils";

export default function SectionDetail({ conn }) {
  const sections = conn.sections || [];

  return (
    <div style={{ padding: "8px 12px 12px", background: "#080810" }}>
      {sections.map((section, index) => {
        if (section.journey) {
          return (
            <div
              key={index}
              style={{ display: "flex", gap: "8px", padding: "4px 0", fontSize: "12px", alignItems: "baseline" }}
            >
              <span style={{ color: "#818cf8", fontFamily: "monospace", minWidth: "55px", fontWeight: 500 }}>
                {section.journey.category ?? ""}
                {section.journey.number ?? ""}
              </span>
              <span style={{ color: "#666" }}>
                {formatTime(section.departure?.departure)} {section.departure?.station?.name}
              </span>
              <span style={{ color: "#444" }}>-></span>
              <span style={{ color: "#666" }}>
                {formatTime(section.arrival?.arrival)} {section.arrival?.station?.name}
              </span>
              {section.departure?.platform && (
                <span style={{ color: "#444", fontSize: "10px" }}>Gl.{section.departure.platform}</span>
              )}
            </div>
          );
        }

        if (section.walk) {
          return (
            <div key={index} style={{ fontSize: "11px", color: "#555", padding: "2px 0", fontStyle: "italic" }}>
              walk {section.walk.duration ? `${Math.round(section.walk.duration / 60)} min` : ""}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
