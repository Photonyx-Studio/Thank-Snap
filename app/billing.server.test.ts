import { describe, expect, it } from "vitest";
import { findPlanTier, PLAN_FEATURES, PLAN_TIERS } from "./billing.server";

describe("PLAN_TIERS", () => {
  it("defines exactly the 3 tiers: $0/100, $19/1000, $49/5000 orders per month", () => {
    expect(PLAN_TIERS).toHaveLength(3);
    expect(PLAN_TIERS.map((t) => [t.price.amount, t.orderCap]).sort(
      (a, b) => a[0] - b[0],
    )).toEqual([
      [0, 100],
      [19, 1000],
      [49, 5000],
    ]);
  });

  it("has a unique, non-empty handle per tier", () => {
    const handles = PLAN_TIERS.map((t) => t.handle);
    expect(handles.every((h) => h.length > 0)).toBe(true);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it("orders orderCap strictly ascending with price", () => {
    const sorted = [...PLAN_TIERS].sort((a, b) => a.price.amount - b.price.amount);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].orderCap).toBeGreaterThan(sorted[i - 1].orderCap);
    }
  });
});

describe("PLAN_FEATURES", () => {
  it("lists at least one feature, with no duplicates", () => {
    expect(PLAN_FEATURES.length).toBeGreaterThan(0);
    expect(new Set(PLAN_FEATURES).size).toBe(PLAN_FEATURES.length);
  });

  it("includes the CSV export feature, since every tier includes it", () => {
    expect(PLAN_FEATURES.some((f) => /CSV export/i.test(f))).toBe(true);
  });
});

describe("findPlanTier", () => {
  it("finds a tier by its handle", () => {
    expect(findPlanTier("tier-2")?.name).toBe("Starter");
  });

  it("returns null for an unknown handle", () => {
    expect(findPlanTier("not-a-real-handle")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(findPlanTier(null)).toBeNull();
    expect(findPlanTier(undefined)).toBeNull();
  });
});
