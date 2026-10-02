import type { AttributionOption } from "../../models/dashboard.server";
import { CHART_THEME_CLASS, CHART_THEME_STYLES } from "./chartTheme";

interface AttributionBreakdownChartProps {
  breakdown: AttributionOption[];
}

/** A ranked, direct-labeled bar list — one series (answer count), so every
 * bar shares a single accent color rather than cycling hues per option. */
export function AttributionBreakdownChart({ breakdown }: AttributionBreakdownChartProps) {
  if (breakdown.length === 0) {
    return <s-paragraph tone="neutral">No attribution answers yet in this range.</s-paragraph>;
  }

  const max = Math.max(...breakdown.map((row) => row.count));

  return (
    <div className={CHART_THEME_CLASS}>
      <style>{CHART_THEME_STYLES}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {breakdown.map((row) => (
          <div key={row.option}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "13px",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{row.option}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {row.count} · {row.percentage}%
              </span>
            </div>
            <div
              style={{
                height: "10px",
                borderRadius: "5px",
                background: "var(--gridline)",
              }}
            >
              <div
                title={`${row.option}: ${row.count} (${row.percentage}%)`}
                style={{
                  height: "100%",
                  width: `${max > 0 ? (row.count / max) * 100 : 0}%`,
                  borderRadius: "5px",
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
