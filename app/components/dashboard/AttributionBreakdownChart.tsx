import type { AttributionOption } from "../../models/dashboard.server";
import { CHART_THEME_CLASS, CHART_THEME_STYLES } from "./chartTheme";

interface AttributionBreakdownChartProps {
  breakdown: AttributionOption[];
}

const BAR_HEIGHT = 6;

/** A ranked, direct-labeled bar list — one series (answer count), so every
 * bar shares a single accent color rather than cycling hues per option.
 * Bar width is relative to the top option (not each row's own share of the
 * total), so the #1 channel always fills the track and every other bar
 * reads as "X% as popular as our top channel" at a glance. Kept deliberately
 * quiet: a thin flat-color bar, muted percentage, and ordering alone (no
 * badges or shadows) to carry the ranking. */
export function AttributionBreakdownChart({ breakdown }: AttributionBreakdownChartProps) {
  if (breakdown.length === 0) {
    return <s-paragraph tone="neutral">No attribution answers yet in this range.</s-paragraph>;
  }

  const max = Math.max(...breakdown.map((row) => row.count));

  return (
    <div className={CHART_THEME_CLASS}>
      <style>{CHART_THEME_STYLES}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {breakdown.map((row) => {
          const widthPercent = max > 0 ? (row.count / max) * 100 : 0;

          return (
            <div key={row.option}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "8px",
                  marginBottom: "5px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.option}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  {row.percentage}%
                </span>
              </div>

              <div
                title={`${row.option}: ${row.count} (${row.percentage}%)`}
                style={{
                  height: `${BAR_HEIGHT}px`,
                  borderRadius: `${BAR_HEIGHT / 2}px`,
                  background: "var(--gridline)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${widthPercent}%`,
                    borderRadius: `${BAR_HEIGHT / 2}px`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
