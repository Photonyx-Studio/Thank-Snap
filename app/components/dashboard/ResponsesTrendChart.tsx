import type { TrendPoint } from "../../models/dashboard.server";
import { CHART_THEME_CLASS, CHART_THEME_STYLES } from "./chartTheme";

interface ResponsesTrendChartProps {
  trend: TrendPoint[];
}

const WIDTH = 480;
const HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const PAD_X = 8;
const PLOT_WIDTH = WIDTH - PAD_X * 2;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A two-series line chart (surveys shown vs. answered) over the selected
 * window, scaled into a fixed viewBox. Per-point hit targets carry a native
 * tooltip since a full custom tooltip isn't worth the weight here. */
export function ResponsesTrendChart({ trend }: ResponsesTrendChartProps) {
  if (trend.length === 0) {
    return <s-paragraph tone="neutral">No data in this range yet.</s-paragraph>;
  }

  const maxValue = Math.max(1, ...trend.map((p) => Math.max(p.shown, p.answered)));
  const stepX = trend.length > 1 ? PLOT_WIDTH / (trend.length - 1) : 0;

  function coords(index: number, value: number) {
    const x = PAD_X + index * stepX;
    const y = PAD_TOP + PLOT_HEIGHT - (value / maxValue) * PLOT_HEIGHT;
    return { x, y };
  }

  function toPolyline(values: number[]) {
    return values.map((v, i) => Object.values(coords(i, v)).join(",")).join(" ");
  }

  const shownPoints = toPolyline(trend.map((p) => p.shown));
  const answeredPoints = toPolyline(trend.map((p) => p.answered));

  return (
    <div className={CHART_THEME_CLASS}>
      <style>{CHART_THEME_STYLES}</style>
      <s-stack direction="inline" gap="base" alignItems="center">
        <Legend color="var(--series-1)" label="Shown" />
        <Legend color="var(--series-2)" label="Answered" />
      </s-stack>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Surveys shown and answered per day"
        style={{ width: "100%", height: "auto", marginTop: "8px" }}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = PAD_TOP + PLOT_HEIGHT - fraction * PLOT_HEIGHT;
          return (
            <line
              key={fraction}
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={y}
              y2={y}
              stroke="var(--gridline)"
              strokeWidth={1}
            />
          );
        })}

        <polyline
          points={shownPoints}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={answeredPoints}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {trend.map((p, i) => {
          const shown = coords(i, p.shown);
          const answered = coords(i, p.answered);
          return (
            <g key={p.date}>
              <circle cx={shown.x} cy={shown.y} r={6} fill="transparent">
                <title>{`${p.date}: ${p.shown} shown`}</title>
              </circle>
              <circle cx={answered.x} cy={answered.y} r={6} fill="transparent">
                <title>{`${p.date}: ${p.answered} answered`}</title>
              </circle>
            </g>
          );
        })}

        <text x={PAD_X} y={HEIGHT - 6} fontSize={10} fill="var(--muted)">
          {formatShortDate(trend[0].date)}
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} fontSize={10} fill="var(--muted)" textAnchor="end">
          {formatShortDate(trend[trend.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
        }}
      ></span>
      <s-text tone="neutral">{label}</s-text>
    </s-stack>
  );
}
