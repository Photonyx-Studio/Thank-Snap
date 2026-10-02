/** Shared CSS custom properties for the dashboard's inline SVG/HTML charts —
 * a colorblind-safe palette that also adapts to the visitor's OS theme, since
 * the embedded app iframe only ever sees prefers-color-scheme, not Shopify
 * admin's own theme toggle.
 *
 * --series-1/--series-2 are a two-series comparison pair (shown vs.
 * answered in the trend chart) - blue/orange specifically, because that
 * pairing stays distinguishable under the common forms of red-green color
 * blindness. Don't repurpose either for a single-series chart by swapping
 * in the brand green; --accent exists for exactly that (see
 * AttributionBreakdownChart, which has only one series and so carries no
 * such pairing risk). */
export const CHART_THEME_CLASS = "tsnap-chart";

export const CHART_THEME_STYLES = `
.${CHART_THEME_CLASS} {
  color-scheme: light;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --muted: #898781;
  --gridline: #e1e0d9;
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --accent: #1D9E75;
}
@media (prefers-color-scheme: dark) {
  .${CHART_THEME_CLASS} {
    color-scheme: dark;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --muted: #898781;
    --gridline: #2c2c2a;
    --series-1: #3987e5;
    --series-2: #d95926;
    --accent: #34C795;
  }
}
`;
