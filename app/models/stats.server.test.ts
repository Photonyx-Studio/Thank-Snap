import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { getResponseStats } from "./stats.server";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    order: { count: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getResponseStats", () => {
  it("returns all zeros/null when the shop has never opened the app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const stats = await getResponseStats("no-shop.myshopify.com");

    expect(stats).toEqual({ surveysShown: 0, surveysAnswered: 0, responseRate: null });
    expect(mockDb.order.count).not.toHaveBeenCalled();
  });

  it("returns a null rate when the survey has never been shown", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.order.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const stats = await getResponseStats("shop.myshopify.com");

    expect(stats).toEqual({ surveysShown: 0, surveysAnswered: 0, responseRate: null });
  });

  it("computes a rounded percentage rate", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.order.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

    const stats = await getResponseStats("shop.myshopify.com");

    expect(stats).toEqual({ surveysShown: 10, surveysAnswered: 3, responseRate: 30 });
  });

  it("rounds to one decimal place instead of truncating", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.order.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);

    const stats = await getResponseStats("shop.myshopify.com");

    // 1/3 = 33.333...% -> rounded to 33.3
    expect(stats.responseRate).toBe(33.3);
  });

  it("scopes both counts to the requesting shop", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_42" } as never);
    mockDb.order.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    await getResponseStats("shop.myshopify.com");

    expect(mockDb.shop.findUnique).toHaveBeenCalledWith({
      where: { shopDomain: "shop.myshopify.com" },
    });
    expect(mockDb.order.count).toHaveBeenNthCalledWith(1, { where: { shopId: "shop_42" } });
    expect(mockDb.order.count).toHaveBeenNthCalledWith(2, {
      where: { shopId: "shop_42", responses: { some: {} } },
    });
  });
});
