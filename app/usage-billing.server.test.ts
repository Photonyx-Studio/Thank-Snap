import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "./db.server";
import { sendBillingEvent } from "./app-events.server";
import { unauthenticated } from "./shopify.server";
import { billOverageIfNeeded } from "./usage-billing.server";

vi.mock("./db.server", () => ({
  default: {
    shop: { update: vi.fn() },
    order: { count: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("./app-events.server", () => ({ sendBillingEvent: vi.fn() }));
vi.mock("./partner-api.server", () => ({ fetchActiveSubscription: vi.fn() }));
vi.mock("./shopify.server", () => ({ unauthenticated: { admin: vi.fn() } }));
vi.mock("@sentry/react-router", () => ({ captureException: vi.fn() }));

const mockDb = vi.mocked(db, true);
const mockSend = vi.mocked(sendBillingEvent);
const mockUnauthenticatedAdmin = vi.mocked(unauthenticated.admin);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

const shop = {
  id: "shop_1",
  shopDomain: "shop.myshopify.com",
  shopGid: "gid://shopify/Shop/5678",
  subscriptionActive: true,
  subscriptionPlanHandle: "tier-1", // cap 100
};
const order = {
  id: "order_abc",
  createdAt: new Date("2026-06-15T11:59:00.000Z"),
  overageBilledAt: null,
};

describe("billOverageIfNeeded", () => {
  it("bills one unit, keyed by the order id, for an order past the plan's cap", async () => {
    mockDb.order.count.mockResolvedValue(101 as never);

    await billOverageIfNeeded(shop, order);

    expect(mockDb.order.count).toHaveBeenCalledWith({
      where: {
        shopId: "shop_1",
        createdAt: { gte: new Date("2026-06-01T00:00:00.000Z"), lte: order.createdAt },
      },
    });
    expect(mockSend).toHaveBeenCalledWith({
      shopGid: "gid://shopify/Shop/5678",
      eventHandle: "extra_order",
      idempotencyKey: "order-order_abc",
      value: 1,
    });
    expect(mockDb.order.update).toHaveBeenCalledWith({
      where: { id: "order_abc" },
      data: { overageBilledAt: new Date("2026-06-15T12:00:00.000Z") },
    });
  });

  it("doesn't bill the order that exactly reaches the cap", async () => {
    mockDb.order.count.mockResolvedValue(100 as never);

    await billOverageIfNeeded(shop, order);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("doesn't re-bill an order that was already billed", async () => {
    await billOverageIfNeeded(shop, { ...order, overageBilledAt: new Date() });

    expect(mockDb.order.count).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("doesn't bill a shop without an active subscription or recognized plan", async () => {
    await billOverageIfNeeded({ ...shop, subscriptionActive: false }, order);
    await billOverageIfNeeded({ ...shop, subscriptionPlanHandle: "legacy" }, order);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("doesn't bill an order from a previous month", async () => {
    await billOverageIfNeeded(shop, {
      ...order,
      createdAt: new Date("2026-05-31T23:00:00.000Z"),
    });

    expect(mockDb.order.count).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("looks up and stores the shop GID when it isn't cached yet", async () => {
    mockDb.order.count.mockResolvedValue(150 as never);
    mockUnauthenticatedAdmin.mockResolvedValue({
      admin: {
        graphql: vi.fn(async () =>
          Response.json({ data: { shop: { id: "gid://shopify/Shop/999" } } }),
        ),
      },
    } as never);

    await billOverageIfNeeded({ ...shop, shopGid: null }, order);

    expect(mockDb.shop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: { shopGid: "gid://shopify/Shop/999" },
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ shopGid: "gid://shopify/Shop/999" }),
    );
  });

  it("swallows a failed App Events call and leaves the order unbilled for a retry", async () => {
    mockDb.order.count.mockResolvedValue(101 as never);
    mockSend.mockRejectedValue(new Error("App Events request failed: 500"));

    await expect(billOverageIfNeeded(shop, order)).resolves.toBeUndefined();
    expect(mockDb.order.update).not.toHaveBeenCalled();
  });
});
