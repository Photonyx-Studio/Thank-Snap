import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { action } from "./webhooks.customers.redact";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    order: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

const mockDb = vi.mocked(db, true);
const mockAuthenticate = vi.mocked(authenticate.webhook);

function makeRequest() {
  return new Request("https://app.example.com/webhooks/customers/redact", {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
});

describe("POST /webhooks/customers/redact", () => {
  it("deletes only the order whose numeric id exactly matches", async () => {
    mockAuthenticate.mockResolvedValue({
      shop: "shop.myshopify.com",
      topic: "CUSTOMERS_REDACT",
      payload: { orders_to_redact: [299938] },
    } as never);
    mockDb.order.findMany.mockResolvedValue([
      { id: "order_exact", shopifyOrderId: "gid://shopify/Order/299938" },
      { id: "order_unrelated", shopifyOrderId: "gid://shopify/Order/1299938" },
    ] as never);

    await action({ request: makeRequest() } as never);

    expect(mockDb.order.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["order_exact"] } },
    });
  });

  it("does nothing when no order matches", async () => {
    mockAuthenticate.mockResolvedValue({
      shop: "shop.myshopify.com",
      topic: "CUSTOMERS_REDACT",
      payload: { orders_to_redact: [999] },
    } as never);
    mockDb.order.findMany.mockResolvedValue([
      { id: "order_other", shopifyOrderId: "gid://shopify/Order/12345" },
    ] as never);

    await action({ request: makeRequest() } as never);

    expect(mockDb.order.deleteMany).not.toHaveBeenCalled();
  });
});
