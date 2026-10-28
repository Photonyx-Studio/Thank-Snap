import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { resyncSubscriptionForShop } from "../subscription.server";
import { action } from "./internal.resync-subscriptions";

vi.mock("../db.server", () => ({
  default: { shop: { findMany: vi.fn() } },
}));

vi.mock("../subscription.server", () => ({ resyncSubscriptionForShop: vi.fn() }));
vi.mock("@sentry/react-router", () => ({ captureException: vi.fn() }));

const mockDb = vi.mocked(db, true);
const mockResync = vi.mocked(resyncSubscriptionForShop);

function makeRequest(authHeader?: string) {
  return new Request("https://app.example.com/internal/resync-subscriptions", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.CRON_SECRET = "test-secret";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
});

describe("POST /internal/resync-subscriptions", () => {
  it("rejects a request without the correct bearer secret", async () => {
    const response = await action({ request: makeRequest("Bearer wrong") } as never);

    expect(response.status).toBe(401);
    expect(mockDb.shop.findMany).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await action({ request: makeRequest("Bearer test-secret") } as never);

    expect(response.status).toBe(401);
  });

  it("resyncs only shops the admin hasn't checked recently", async () => {
    mockDb.shop.findMany.mockResolvedValue([
      { id: "shop_1", shopDomain: "a.myshopify.com", shopGid: "gid://shopify/Shop/1" },
      { id: "shop_2", shopDomain: "b.myshopify.com", shopGid: null },
    ] as never);

    const promise = action({ request: makeRequest("Bearer test-secret") } as never);
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(mockDb.shop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subscriptionActive: true }),
      }),
    );
    expect(mockResync).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ checked: 2, resynced: 2 });
  });

  it("keeps resyncing the rest of the batch after one shop fails", async () => {
    mockDb.shop.findMany.mockResolvedValue([
      { id: "shop_1", shopDomain: "a.myshopify.com", shopGid: null },
      { id: "shop_2", shopDomain: "b.myshopify.com", shopGid: null },
    ] as never);
    mockResync.mockRejectedValueOnce(new Error("Partner API request failed: 429"));
    mockResync.mockResolvedValueOnce(undefined);

    const promise = action({ request: makeRequest("Bearer test-secret") } as never);
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(mockResync).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ checked: 2, resynced: 1 });
  });
});
