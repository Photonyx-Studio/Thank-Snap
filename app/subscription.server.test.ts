import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "./db.server";
import { findPlanTier } from "./billing.server";
import { cancelActiveSubscription, fetchActiveSubscription } from "./partner-api.server";
import { unauthenticated } from "./shopify.server";
import {
  cancelSubscription,
  getUsageStatus,
  refreshSubscription,
  requireActiveSubscription,
  resyncSubscriptionForShop,
} from "./subscription.server";

vi.mock("./db.server", () => ({
  default: {
    shop: { upsert: vi.fn(), update: vi.fn() },
    order: { count: vi.fn() },
  },
}));

vi.mock("./partner-api.server", () => ({
  fetchActiveSubscription: vi.fn(),
  cancelActiveSubscription: vi.fn(),
}));
vi.mock("./shopify.server", () => ({ unauthenticated: { admin: vi.fn() } }));

// Real implementation by default - wrapped only so a test can stand in a
// plan without an overagePrice (every real tier currently has one).
vi.mock("./billing.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./billing.server")>();
  return { ...actual, findPlanTier: vi.fn(actual.findPlanTier) };
});

const mockDb = vi.mocked(db, true);
const mockFetchActiveSubscription = vi.mocked(fetchActiveSubscription);
const mockCancelActiveSubscription = vi.mocked(cancelActiveSubscription);
const mockFindPlanTier = vi.mocked(findPlanTier);

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
    subscriptionPlanHandle: "starter",
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
      planHandle: "starter",
      planName: "Starter",
      orderCap: 1000,
      currentCount: 42,
      periodStart: "2026-06-01T00:00:00.000Z",
      isOverCap: false,
      overagePrice: 0.02,
      overageCount: 0,
      surveyPaused: false,
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
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never); // starter, cap 1000
    mockDb.order.count.mockResolvedValue(1000 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.isOverCap).toBe(true);
  });

  it("is not over cap one order below the plan's orderCap", async () => {
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never); // starter, cap 1000
    mockDb.order.count.mockResolvedValue(999 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.isOverCap).toBe(false);
  });

  it("counts orders past the cap as overage, and keeps the survey showing on a plan with an overage price", async () => {
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never); // starter, cap 1000
    mockDb.order.count.mockResolvedValue(1042 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.isOverCap).toBe(true);
    expect(status.overageCount).toBe(42);
    expect(status.overagePrice).toBe(0.02);
    expect(status.surveyPaused).toBe(false);
  });

  it("pauses the survey once over cap on a plan without an overage price", async () => {
    mockFindPlanTier.mockReturnValueOnce({
      handle: "starter",
      name: "Starter",
      price: { amount: 19, currencyCode: "USD" },
      orderCap: 1000,
    });
    mockDb.shop.upsert.mockResolvedValue(shopRow() as never);
    mockDb.order.count.mockResolvedValue(1000 as never);

    const status = await getUsageStatus("shop.myshopify.com");

    expect(status.overagePrice).toBeNull();
    expect(status.surveyPaused).toBe(true);
  });
});

describe("refreshSubscription", () => {
  const admin = {
    graphql: vi.fn(async () =>
      Response.json({ data: { shop: { id: "gid://shopify/Shop/5678" } } }),
    ),
  };
  const session = { shop: "shop.myshopify.com" };

  function cachedShop(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "shop_1",
      subscriptionActive: true,
      subscriptionPlanHandle: "seed",
      subscriptionCheckedAt: new Date("2026-06-15T11:58:00.000Z"), // 2 min ago
      ...overrides,
    };
  }

  it("uses a fresh cached subscription without calling the Partner API", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop() as never);

    await refreshSubscription({ admin, session } as never);

    expect(mockFetchActiveSubscription).not.toHaveBeenCalled();
  });

  it("bypasses a fresh cache when the welcome link's plan_handle names a different plan", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop() as never);
    mockFetchActiveSubscription.mockResolvedValue(null);

    await refreshSubscription({ admin, session, planHandle: "starter" } as never);

    expect(mockFetchActiveSubscription).toHaveBeenCalledWith("gid://shopify/Shop/5678");
  });

  it("bypasses a fresh cache when forced (the Billing page)", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop() as never);
    mockFetchActiveSubscription.mockResolvedValue(null);

    await refreshSubscription({ admin, session, force: true } as never);

    expect(mockFetchActiveSubscription).toHaveBeenCalled();
  });

  it("keeps using a fresh cache when plan_handle matches the cached plan", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop() as never);

    await refreshSubscription({ admin, session, planHandle: "seed" } as never);

    expect(mockFetchActiveSubscription).not.toHaveBeenCalled();
  });

  it("stores the plan (not the usage meter), cancellation, pending change and shop GID", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop({ subscriptionCheckedAt: null }) as never);
    mockFetchActiveSubscription.mockResolvedValue({
      billingPeriod: "EVERY_30_DAYS",
      cancelAtEndOfCycle: true,
      trialEndsAt: null,
      currentBillingCycle: {
        startTime: "2026-06-01T00:00:00Z",
        endTime: "2026-07-01T00:00:00Z",
      },
      items: [{ handle: "extra_order" }, { handle: "growth" }],
      pendingUpdate: { items: [{ handle: "extra_order" }, { handle: "starter" }] },
    });

    await refreshSubscription({ admin, session } as never);

    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: {
        shopGid: "gid://shopify/Shop/5678",
        subscriptionActive: true,
        subscriptionPlanHandle: "growth",
        subscriptionTrialEndsAt: null,
        subscriptionCurrentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
        subscriptionCancelAtEndOfCycle: true,
        subscriptionPendingPlanHandle: "starter",
        subscriptionCheckedAt: new Date("2026-06-15T12:00:00.000Z"),
      },
    });
  });

  it("requireActiveSubscription redirects to the plan selection page when there's no subscription", async () => {
    mockDb.shop.upsert.mockResolvedValue(cachedShop({ subscriptionActive: false }) as never);
    mockFetchActiveSubscription.mockResolvedValue(null);
    mockDb.shop.update.mockResolvedValue({ subscriptionActive: false } as never);
    admin.graphql
      .mockResolvedValueOnce(Response.json({ data: { shop: { id: "gid://shopify/Shop/5678" } } }))
      .mockResolvedValueOnce(Response.json({ data: { app: { handle: "thank-snap" } } }));
    const redirect = vi.fn(() => new Response(null, { status: 302 }));

    await requireActiveSubscription({ admin, session, redirect } as never);

    expect(redirect).toHaveBeenCalledWith(
      "https://admin.shopify.com/store/shop/charges/thank-snap/pricing_plans",
      { target: "_top" },
    );
  });
});

describe("resyncSubscriptionForShop", () => {
  const mockUnauthenticatedAdmin = vi.mocked(unauthenticated.admin);

  it("queries the Partner API directly using an already-cached shop GID", async () => {
    mockFetchActiveSubscription.mockResolvedValue(null);
    mockDb.shop.update.mockResolvedValue({} as never);

    await resyncSubscriptionForShop({
      id: "shop_1",
      shopDomain: "shop.myshopify.com",
      shopGid: "gid://shopify/Shop/5678",
    });

    expect(mockUnauthenticatedAdmin).not.toHaveBeenCalled();
    expect(mockFetchActiveSubscription).toHaveBeenCalledWith("gid://shopify/Shop/5678");
  });

  it("picks up a cancellation that happened outside the redirect flow, without an admin visit", async () => {
    mockFetchActiveSubscription.mockResolvedValue(null);
    mockDb.shop.update.mockResolvedValue({} as never);

    await resyncSubscriptionForShop({
      id: "shop_1",
      shopDomain: "shop.myshopify.com",
      shopGid: "gid://shopify/Shop/5678",
    });

    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: expect.objectContaining({ subscriptionActive: false }),
    });
  });

  it("looks up the shop GID through an offline admin session when it isn't cached yet", async () => {
    mockUnauthenticatedAdmin.mockResolvedValue({
      admin: {
        graphql: vi.fn(async () =>
          Response.json({ data: { shop: { id: "gid://shopify/Shop/999" } } }),
        ),
      },
    } as never);
    mockFetchActiveSubscription.mockResolvedValue(null);
    mockDb.shop.update.mockResolvedValue({} as never);

    await resyncSubscriptionForShop({
      id: "shop_1",
      shopDomain: "shop.myshopify.com",
      shopGid: null,
    });

    expect(mockUnauthenticatedAdmin).toHaveBeenCalledWith("shop.myshopify.com");
    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: { shopGid: "gid://shopify/Shop/999" },
    });
    expect(mockFetchActiveSubscription).toHaveBeenCalledWith("gid://shopify/Shop/999");
  });
});

describe("cancelSubscription", () => {
  const mockUnauthenticatedAdmin = vi.mocked(unauthenticated.admin);

  it("cancels at the Partner API using an already-cached shop GID, then refreshes the cached state", async () => {
    mockCancelActiveSubscription.mockResolvedValue(undefined);
    mockFetchActiveSubscription.mockResolvedValue({
      billingPeriod: "EVERY_30_DAYS",
      cancelAtEndOfCycle: true,
      trialEndsAt: null,
      currentBillingCycle: {
        startTime: "2026-06-01T00:00:00Z",
        endTime: "2026-07-01T00:00:00Z",
      },
      items: [{ handle: "starter" }],
      pendingUpdate: null,
    });
    mockDb.shop.update.mockResolvedValue({} as never);

    await cancelSubscription({
      id: "shop_1",
      shopDomain: "shop.myshopify.com",
      shopGid: "gid://shopify/Shop/5678",
    });

    expect(mockUnauthenticatedAdmin).not.toHaveBeenCalled();
    expect(mockCancelActiveSubscription).toHaveBeenCalledWith("gid://shopify/Shop/5678");
    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: expect.objectContaining({ subscriptionCancelAtEndOfCycle: true }),
    });
  });

  it("looks up the shop GID through an offline admin session when it isn't cached yet", async () => {
    mockUnauthenticatedAdmin.mockResolvedValue({
      admin: {
        graphql: vi.fn(async () =>
          Response.json({ data: { shop: { id: "gid://shopify/Shop/999" } } }),
        ),
      },
    } as never);
    mockCancelActiveSubscription.mockResolvedValue(undefined);
    mockFetchActiveSubscription.mockResolvedValue(null);
    mockDb.shop.update.mockResolvedValue({} as never);

    await cancelSubscription({ id: "shop_1", shopDomain: "shop.myshopify.com", shopGid: null });

    expect(mockUnauthenticatedAdmin).toHaveBeenCalledWith("shop.myshopify.com");
    expect(mockCancelActiveSubscription).toHaveBeenCalledWith("gid://shopify/Shop/999");
  });

  it("doesn't swallow a Partner API cancellation failure", async () => {
    mockCancelActiveSubscription.mockRejectedValue(new Error("View financials permission required"));

    await expect(
      cancelSubscription({
        id: "shop_1",
        shopDomain: "shop.myshopify.com",
        shopGid: "gid://shopify/Shop/5678",
      }),
    ).rejects.toThrow("View financials permission required");

    expect(mockFetchActiveSubscription).not.toHaveBeenCalled();
  });
});
