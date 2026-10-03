import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { getSubmissionsForExport, toResponseRow } from "./response.server";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    response: { findMany: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseResponse = {
  id: "resp_1",
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
  answerText: "Instagram",
  question: { label: "How did you hear about us?" },
};

describe("toResponseRow", () => {
  it("labels a real order by its order number", () => {
    const row = toResponseRow({
      ...baseResponse,
      order: { orderNumber: "1042", shopifyOrderId: "gid://shopify/Order/1" },
    });
    expect(row.orderLabel).toBe("#1042");
  });

  it("labels a not-yet-finalized order as Pending", () => {
    const row = toResponseRow({
      ...baseResponse,
      order: { orderNumber: null, shopifyOrderId: "pending:session_abc" },
    });
    expect(row.orderLabel).toBe("Pending");
  });

  it("falls back to the raw shopifyOrderId when there's no order number and it isn't pending", () => {
    const row = toResponseRow({
      ...baseResponse,
      order: { orderNumber: null, shopifyOrderId: "gid://shopify/Order/1" },
    });
    expect(row.orderLabel).toBe("gid://shopify/Order/1");
  });

  it("defaults a null answer to an empty string", () => {
    const row = toResponseRow({
      ...baseResponse,
      answerText: null,
      order: { orderNumber: "1042", shopifyOrderId: "gid://shopify/Order/1" },
    });
    expect(row.answer).toBe("");
  });

  it("serializes createdAt to an ISO string", () => {
    const row = toResponseRow({
      ...baseResponse,
      order: { orderNumber: "1042", shopifyOrderId: "gid://shopify/Order/1" },
    });
    expect(row.createdAt).toBe("2026-01-15T10:00:00.000Z");
  });
});

describe("getSubmissionsForExport", () => {
  it("returns empty when the shop doesn't exist", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const result = await getSubmissionsForExport("no-such-shop.myshopify.com");

    expect(result).toEqual({ questionLabels: [], rows: [] });
    expect(mockDb.response.findMany).not.toHaveBeenCalled();
  });

  it("pivots one row per submission, one column per question, in position order", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.response.findMany.mockResolvedValue([
      // submission A, question at position 1 - listed before position 0 to
      // confirm column order follows position, not first appearance.
      {
        submissionId: "sub_a",
        questionId: "q2",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        answerText: "Yes",
        order: { orderNumber: "1042", shopifyOrderId: "gid://shopify/Order/1" },
        question: { position: 1, label: "Would you recommend us?" },
      },
      {
        submissionId: "sub_a",
        questionId: "q1",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        answerText: "Instagram",
        order: { orderNumber: "1042", shopifyOrderId: "gid://shopify/Order/1" },
        question: { position: 0, label: "How did you hear about us?" },
      },
      // submission B answered only the first question.
      {
        submissionId: "sub_b",
        questionId: "q1",
        createdAt: new Date("2026-01-14T09:00:00.000Z"),
        answerText: "Google",
        order: { orderNumber: null, shopifyOrderId: "pending:session_xyz" },
        question: { position: 0, label: "How did you hear about us?" },
      },
    ] as never);

    const result = await getSubmissionsForExport("shop.myshopify.com");

    expect(result.questionLabels).toEqual([
      "How did you hear about us?",
      "Would you recommend us?",
    ]);
    expect(result.rows).toEqual([
      {
        submissionId: "sub_a",
        createdAt: "2026-01-15T10:00:00.000Z",
        orderLabel: "#1042",
        answers: {
          "How did you hear about us?": "Instagram",
          "Would you recommend us?": "Yes",
        },
      },
      {
        submissionId: "sub_b",
        createdAt: "2026-01-14T09:00:00.000Z",
        orderLabel: "Pending",
        answers: {
          "How did you hear about us?": "Google",
        },
      },
    ]);
  });

  it("disambiguates two questions that share the same label", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.response.findMany.mockResolvedValue([
      {
        submissionId: "sub_a",
        questionId: "q1",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        answerText: "Yes",
        order: { orderNumber: "1", shopifyOrderId: "gid://shopify/Order/1" },
        question: { position: 0, label: "Comments" },
      },
      {
        submissionId: "sub_a",
        questionId: "q2",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        answerText: "None",
        order: { orderNumber: "1", shopifyOrderId: "gid://shopify/Order/1" },
        question: { position: 1, label: "Comments" },
      },
    ] as never);

    const result = await getSubmissionsForExport("shop.myshopify.com");

    expect(result.questionLabels).toEqual(["Comments", "Comments (2)"]);
    expect(result.rows[0].answers).toEqual({
      Comments: "Yes",
      "Comments (2)": "None",
    });
  });

  it("defaults a null answer to an empty string", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.response.findMany.mockResolvedValue([
      {
        submissionId: "sub_a",
        questionId: "q1",
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        answerText: null,
        order: { orderNumber: "1", shopifyOrderId: "gid://shopify/Order/1" },
        question: { position: 0, label: "Comments" },
      },
    ] as never);

    const result = await getSubmissionsForExport("shop.myshopify.com");

    expect(result.rows[0].answers["Comments"]).toBe("");
  });
});
