// Deliberately not *.server.ts: this is pure date math with no DB/Node-only
// code, and DateRangeFilter.tsx (a plain component, not a route module) needs
// it in the client bundle. Route files get automatic server/client
// code-splitting for loader/action; a regular component doesn't, so it can't
// import anything from a *.server.ts file without leaking that module (and
// its Prisma import) into the browser.
export type DateRangeKey = "7d" | "30d" | "90d" | "all";

export interface DateRange {
  key: DateRangeKey;
  /** null means "all time" — no lower bound. */
  from: Date | null;
  to: Date;
}

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const RANGE_DAYS: Record<Exclude<DateRangeKey, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function resolveDateRange(key: string | null): DateRange {
  const to = new Date();
  if (key === "7d" || key === "30d" || key === "90d") {
    const from = new Date(to);
    from.setDate(from.getDate() - RANGE_DAYS[key]);
    return { key, from, to };
  }
  return { key: "all", from: null, to };
}
