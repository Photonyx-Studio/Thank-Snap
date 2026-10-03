/** Rounds `part/total` to one decimal place as a percent; `null` when there's nothing to divide by. */
export function percentage(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}
