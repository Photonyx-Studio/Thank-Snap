import { describe, expect, it } from "vitest";
import { resolveDateRange } from "./dateRange";

describe("resolveDateRange", () => {
  it("resolves 7d/30d/90d to a from/to window of the right length", () => {
    const range = resolveDateRange("30d");
    expect(range.key).toBe("30d");
    expect(range.from).not.toBeNull();
    const days = Math.round((range.to.getTime() - range.from!.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });

  it("treats null, missing, and unrecognized keys as 'all' with no lower bound", () => {
    expect(resolveDateRange(null).key).toBe("all");
    expect(resolveDateRange("").key).toBe("all");
    expect(resolveDateRange("nonsense").key).toBe("all");
    expect(resolveDateRange("nonsense").from).toBeNull();
  });
});
