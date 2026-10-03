import type { AttributionOption } from "../../models/dashboard.server";
import { CHART_THEME_CLASS, CHART_THEME_STYLES } from "./chartTheme";

interface AttributionBreakdownChartProps {
  breakdown: AttributionOption[];
}

const BAR_HEIGHT = 26;

/** A ranked, direct-labeled bar list — one series (answer count), so every
 * bar shares a single accent color rather than cycling hues per option.
 * Bar width is relative to the top option (not each row's own share of the
 * total), so the #1 channel always fills the track and every other bar
 * reads as "X% as popular as our top channel" at a glance - that head-to-
 * head comparison is the point, the same way a health bar reads relative
 * to a full bar rather than to some abstract scale. */
export function AttributionBreakdownChart({ breakdown }: AttributionBreakdownChartProps) {
  if (breakdown.length === 0) {
    return <s-paragraph tone="neutral">No attribution answers yet in this range.</s-paragraph>;
  }

  const max = Math.max(...breakdown.map((row) => row.count));

  return (
    <div className={CHART_THEME_CLASS}>
      <style>{CHART_THEME_STYLES}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {breakdown.map((row, index) => {
          const widthPercent = max > 0 ? (row.count / max) * 100 : 0;
          const isLeader = index === 0;

          return (
            <div key={row.option} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  background: isLeader ? "var(--accent)" : "var(--gridline)",
                  color: isLeader ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                {index + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: isLeader ? 700 : 600,
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
                      fontSize: "15px",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-primary)",
                      flexShrink: 0,
                    }}
                  >
                    {row.percentage}%
                  </span>
                </div>

                <div
                  title={`${row.option}: ${row.count} (${row.percentage}%)`}
                  style={{
                    position: "relative",
                    height: `${BAR_HEIGHT}px`,
                    borderRadius: `${BAR_HEIGHT / 2}px`,
                    background: "var(--gridline)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      height: "100%",
                      width: `${widthPercent}%`,
                      minWidth: widthPercent > 0 ? `${BAR_HEIGHT}px` : 0,
                      borderRadius: `${BAR_HEIGHT / 2}px`,
                      background: "var(--accent)",
                      boxShadow: "inset 0 -3px 5px rgba(0, 0, 0, 0.18)",
                      transition: "width 0.4s ease-out",
                    }}
                  >
                    {/* Glossy top highlight - what reads this as a chunky
                        "health bar" fill rather than a flat data bar. */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: `${BAR_HEIGHT / 2}px`,
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 55%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
