import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "./db.server";
import { getUsageStatus } from "./subscription.server";

vi.mock("./db.server", () => ({
  default: {
    shop: { upsert: vi.fn(), update: vi.fn() },
    order: { count: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function shopRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "shop_1",
    subscriptionPlanHandle: "tier-2",
    usagePeriodStart: null,
    usagePeriodOrderCount: 0,
    usageCheckedAt: null,
    ...overrides,
  };
}

describe("getUsageStatus", () => {
  it("counts fresh when there's no cache yet, and caches the result", async () => {
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never);
    mockDb.order.count.mockResolvedValue(42 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(mockDb.order.count).toHaveBeenCalledWith({
      where: { shopId: "shop_1", createdAt: { gte: new Date("2026-06-01T00:00:00.000Z") } },
    });
    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: {
        usagePeriodStart: new Date("2026-06-01T00:00:00.000Z"),
        usagePeriodOrderCount: 42,
        usageCheckedAt: new Date("2026-06-15T12:00:00.000Z"),
      },
    });
    expect(status).toEqual({
      planHandle: "tier-2",
      planName: "Starter",
      orderCap: 1000,
      currentCount: 42,
      periodStart: "2026-06-01T00:00:00.000Z",
      isOverCap: false,
    });
  });

  it("uses the cached count within the TTL, without re-querying", async () => {
    mockDb.shop.upsert.mockResolvedValue(
      shopRow({
        usagePeriodStart: new Date("2026-06-01T00:00:00.000Z"),
        usagePeriodOrderCount: 900,
        usageCheckedAt: new Date("2026-06-15T11:58:00.000Z"), // 2 min ago
      }) as never,
    );

    const status = await getUsageStatus("shop.myshopify.com");

    expect(mockDb.order.count).not.toHaveBeenCalled();
    expect(mockDb.shop.update).not.toHaveBeenCalled();
    expect(status.currentCount).toBe(900);
  });

  it("re-queries once the cache is older than the TTL", async () => {
    mockDb.shop.upsert.mockResolvedValue(
      shopRow({
        usagePeriodStart: new Date("2026-06-01T00:00:00.000Z"),
        usagePeriodOrderCount: 900,
        usageCheckedAt: new Date("2026-06-15T11:00:00.000Z"), // 1h ago
      }) as never,
    );
    mockDb.order.count.mockResolvedValue(950 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(mockDb.order.count).toHaveBeenCalled();
    expect(status.currentCount).toBe(950);
  });

  it("re-queries when a new calendar month has started, even if the cache is otherwise fresh", async () => {
    mockDb.shop.upsert.mockResolvedValue(
      shopRow({
        usagePeriodStart: new Date("2026-05-01T00:00:00.000Z"), // last month
        usagePeriodOrderCount: 999,
        usageCheckedAt: new Date("2026-06-15T11:59:00.000Z"), // 1 min ago
      }) as never,
    );
    mockDb.order.count.mockResolvedValue(3 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(mockDb.order.count).toHaveBeenCalledWith({
      where: { shopId: "shop_1", createdAt: { gte: new Date("2026-06-01T00:00:00.000Z") } },
    });
    expect(status.currentCount).toBe(3);
    expect(status.periodStart).toBe("2026-06-01T00:00:00.000Z");
  });

  it("does not enforce a cap for an unrecognized or missing plan handle (fails open)", async () => {
    mockDb.shop.upsert.mockResolvedValue(
      shopRow({ subscriptionPlanHandle: "some-legacy-handle" }) as never,
    );
    mockDb.order.count.mockResolvedValue(999_999 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.orderCap).toBeNull();
    expect(status.planName).toBeNull();
    expect(status.isOverCap).toBe(false);
  });

  it("is over cap once the count reaches the plan's orderCap", async () => {
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never); // tier-2, cap 1000
    mockDb.order.count.mockResolvedValue(1000 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.isOverCap).toBe(true);
  });

  it("is not over cap one order below the plan's orderCap", async () => {
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never); // tier-2, cap 1000
    mockDb.order.count.mockResolvedValue(999 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.isOverCap).toBe(false);
  });
});
