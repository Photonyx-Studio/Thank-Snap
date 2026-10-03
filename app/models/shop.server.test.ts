import type { JwtPayload } from "@shopify/shopify-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { findShopBySessionToken, shopDomainFromSessionToken } from "./shop.server";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

function tokenWithDest(dest: string): JwtPayload {
  return { dest } as JwtPayload;
}

describe("shopDomainFromSessionToken", () => {
  it("strips the https:// prefix", () => {
    expect(shopDomainFromSessionToken(tokenWithDest("https://my-shop.myshopify.com"))).toBe(
      "my-shop.myshopify.com",
    );
  });

  it("strips the http:// prefix", () => {
    expect(shopDomainFromSessionToken(tokenWithDest("http://my-shop.myshopify.com"))).toBe(
      "my-shop.myshopify.com",
    );
  });

  it("leaves a bare domain untouched", () => {
    expect(shopDomainFromSessionToken(tokenWithDest("my-shop.myshopify.com"))).toBe(
      "my-shop.myshopify.com",
    );
  });
});

describe("findShopBySessionToken", () => {
  it("looks up the shop read-only, without creating one", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);

    const shop = await findShopBySessionToken(tokenWithDest("https://my-shop.myshopify.com"));

    expect(mockDb.shop.findUnique).toHaveBeenCalledWith({
      where: { shopDomain: "my-shop.myshopify.com" },
    });
    expect(shop).toEqual({ id: "shop_1" });
  });

  it("returns null for a shop that's never opened the admin app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const shop = await findShopBySessionToken(tokenWithDest("https://unknown.myshopify.com"));

    expect(shop).toBeNull();
  });
});
