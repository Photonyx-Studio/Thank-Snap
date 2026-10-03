import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { createFeedback, listFeedbackForShop } from "./feedback.server";

vi.mock("../db.server", () => ({
  default: {
    shop: { upsert: vi.fn(), findUnique: vi.fn() },
    feedback: { create: vi.fn(), findMany: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFeedback", () => {
  it("creates the shop if it doesn't exist yet, and trims message/email", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.feedback.create.mockResolvedValue({} as never);

    await createFeedback("shop.myshopify.com", {
      type: "BUG",
      message: "  The dashboard chart is blank  ",
      contactEmail: "  merchant@example.com  ",
    });

    expect(mockDb.shop.upsert).toHaveBeenCalledWith({
      where: { shopDomain: "shop.myshopify.com" },
      create: { shopDomain: "shop.myshopify.com" },
      update: {},
    });
    expect(mockDb.feedback.create).toHaveBeenCalledWith({
      data: {
        shopId: "shop_1",
        type: "BUG",
        message: "The dashboard chart is blank",
        contactEmail: "merchant@example.com",
      },
    });
  });

  it("stores a blank contact email as null instead of an empty string", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.feedback.create.mockResolvedValue({} as never);

    await createFeedback("shop.myshopify.com", {
      type: "FEATURE_REQUEST",
      message: "More chart types please",
      contactEmail: "   ",
    });

    expect(mockDb.feedback.create).toHaveBeenCalledWith({
      data: {
        shopId: "shop_1",
        type: "FEATURE_REQUEST",
        message: "More chart types please",
        contactEmail: null,
      },
    });
  });
});

describe("listFeedbackForShop", () => {
  it("returns an empty list for a shop that's never opened the admin app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const rows = await listFeedbackForShop("no-shop.myshopify.com");

    expect(rows).toEqual([]);
    expect(mockDb.feedback.findMany).not.toHaveBeenCalled();
  });

  it("returns the shop's submissions, most recent first, with ISO timestamps", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.feedback.findMany.mockResolvedValue([
      {
        id: "fb_1",
        type: "BUG",
        message: "Something broke",
        contactEmail: "a@example.com",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
      },
    ] as never);

    const rows = await listFeedbackForShop("shop.myshopify.com");

    expect(mockDb.feedback.findMany).toHaveBeenCalledWith({
      where: { shopId: "shop_1" },
      orderBy: { createdAt: "desc" },
    });
    expect(rows).toEqual([
      {
        id: "fb_1",
        type: "BUG",
        message: "Something broke",
        contactEmail: "a@example.com",
        createdAt: "2026-01-15T10:00:00.000Z",
      },
    ]);
  });
});
