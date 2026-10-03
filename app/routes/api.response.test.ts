import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { action } from "./api.response";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    order: { upsert: vi.fn() },
    response: { createMany: vi.fn() },
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
    sessionToken: { dest: "https://shop.myshopify.com", sid: "session_abc" },
    cors,
  } as never);
});

function makeRequest(body: unknown) {
  return new Request("https://app.example.com/api/response", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/response", () => {
  it("rejects a request with no surveyId or answers", async () => {
    const response = await action({ request: makeRequest({}) } as never);

    expect(response.status).toBe(400);
    expect(mockDb.shop.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a shop that has never opened the admin app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const response = await action({
      request: makeRequest({ surveyId: "survey_1", answers: [{ questionId: "q_1", answerValue: "yes" }] }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns 404 when the survey doesn't belong to the requesting shop", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1", surveys: [] } as never);

    const response = await action({
      request: makeRequest({ surveyId: "someone-elses-survey", answers: [{ questionId: "q_1", answerValue: "yes" }] }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("drops answers to questions that don't belong to the survey, and 400s if none are left", async () => {
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      surveys: [{ id: "survey_1", questions: [] }], // no matching question rows
    } as never);

    const response = await action({
      request: makeRequest({ surveyId: "survey_1", answers: [{ questionId: "bogus", answerValue: "yes" }] }),
    } as never);

    expect(response.status).toBe(400);
    expect(mockDb.response.createMany).not.toHaveBeenCalled();
  });

  it("records valid answers under one submissionId, keyed to the given order", async () => {
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      surveys: [{ id: "survey_1", questions: [{ id: "q_1" }] }],
    } as never);
    mockDb.order.upsert.mockResolvedValue({ id: "order_1" } as never);
    mockDb.response.createMany.mockResolvedValue({ count: 1 } as never);

    const response = await action({
      request: makeRequest({
        surveyId: "survey_1",
        orderId: "gid://shopify/Order/1",
        orderNumber: "#1001",
        answers: [{ questionId: "q_1", answerValue: "Instagram" }],
      }),
    } as never);

    expect(response.status).toBe(201);
    expect(mockDb.order.upsert).toHaveBeenCalledWith({
      where: { shopId_shopifyOrderId: { shopId: "shop_1", shopifyOrderId: "gid://shopify/Order/1" } },
      create: { shopId: "shop_1", shopifyOrderId: "gid://shopify/Order/1", orderNumber: "#1001" },
      update: {},
    });
    expect(mockDb.response.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: "order_1",
          surveyId: "survey_1",
          questionId: "q_1",
          answerText: "Instagram",
        }),
      ],
    });
    const body = await response.json();
    expect(body.submissionId).toEqual(expect.any(String));
  });

  it("falls back to a pending order id when the extension has no real order id yet", async () => {
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      surveys: [{ id: "survey_1", questions: [{ id: "q_1" }] }],
    } as never);
    mockDb.order.upsert.mockResolvedValue({ id: "order_1" } as never);
    mockDb.response.createMany.mockResolvedValue({ count: 1 } as never);

    await action({
      request: makeRequest({
        surveyId: "survey_1",
        answers: [{ questionId: "q_1", answerValue: "Instagram" }],
      }),
    } as never);

    expect(mockDb.order.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopId_shopifyOrderId: { shopId: "shop_1", shopifyOrderId: "pending:session_abc" } },
      }),
    );
  });
});
