import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { action } from "./api.survey-view";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    order: { upsert: vi.fn() },
  },
}));

vi.mock("../shopify.server", () => ({
  authenticate: { public: { checkout: vi.fn() } },
}));

const mockDb = vi.mocked(db, true);
const mockAuthenticate = vi.mocked(authenticate.public.checkout);

const cors = (response: Response) => response;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticate.mockResolvedValue({
    sessionToken: { dest: "https://shop.myshopify.com" },
    cors,
  } as never);
});

function makeRequest(body: unknown) {
  return new Request("https://app.example.com/api/survey-view", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/survey-view", () => {
  it("rejects a request missing surveyId or orderId", async () => {
    const response = await action({ request: makeRequest({ surveyId: "survey_1" }) } as never);

    expect(response.status).toBe(400);
    expect(mockDb.shop.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown shop", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const response = await action({
      request: makeRequest({ surveyId: "survey_1", orderId: "gid://shopify/Order/1" }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns 404 when the survey doesn't belong to the shop", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1", surveys: [] } as never);

    const response = await action({
      request: makeRequest({ surveyId: "survey_1", orderId: "gid://shopify/Order/1" }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("upserts the order (idempotent across repeat views) and returns 204", async () => {
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      surveys: [{ id: "survey_1" }],
    } as never);
    mockDb.order.upsert.mockResolvedValue({ id: "order_1" } as never);

    const response = await action({
      request: makeRequest({ surveyId: "survey_1", orderId: "gid://shopify/Order/1", orderNumber: "#1001" }),
    } as never);

    expect(response.status).toBe(204);
    expect(mockDb.order.upsert).toHaveBeenCalledWith({
      where: { shopId_shopifyOrderId: { shopId: "shop_1", shopifyOrderId: "gid://shopify/Order/1" } },
      create: { shopId: "shop_1", shopifyOrderId: "gid://shopify/Order/1", orderNumber: "#1001" },
      update: {},
    });
  });
});
