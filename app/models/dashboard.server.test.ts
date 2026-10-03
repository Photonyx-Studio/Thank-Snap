import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { bucketOrdersByDay, getDashboardData } from "./dashboard.server";
import { resolveDateRange } from "./dateRange";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn() },
    survey: { findFirst: vi.fn() },
    question: { findFirst: vi.fn() },
    order: { count: vi.fn(), findMany: vi.fn() },
    response: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bucketOrdersByDay", () => {
  it("fills every day in the window with zeros, even with no orders", () => {
    const points = bucketOrdersByDay([], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-03T00:00:00Z"));
    expect(points).toEqual([
      { date: "2026-01-01", shown: 0, answered: 0 },
      { date: "2026-01-02", shown: 0, answered: 0 },
      { date: "2026-01-03", shown: 0, answered: 0 },
    ]);
  });

  it("counts shown for every order and answered only for orders with a response", () => {
    const points = bucketOrdersByDay(
      [
        { createdAt: new Date("2026-01-01T08:00:00Z"), hasResponse: true },
        { createdAt: new Date("2026-01-01T20:00:00Z"), hasResponse: false },
        { createdAt: new Date("2026-01-02T12:00:00Z"), hasResponse: true },
      ],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-02T00:00:00Z"),
    );
    expect(points).toEqual([
      { date: "2026-01-01", shown: 2, answered: 1 },
      { date: "2026-01-02", shown: 1, answered: 1 },
    ]);
  });
});

describe("getDashboardData", () => {
  const range = resolveDateRange("30d");

  it("returns the empty dashboard for a shop that's never opened the admin app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const data = await getDashboardData("no-shop.myshopify.com", range);

    expect(data.stats).toEqual({ surveysShown: 0, surveysAnswered: 0, responseRate: null });
    expect(data.breakdown).toEqual([]);
    expect(data.topChannel).toBeNull();
    expect(mockDb.survey.findFirst).not.toHaveBeenCalled();
  });

  it("returns the empty dashboard when the shop has no survey yet", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue(null);

    const data = await getDashboardData("shop.myshopify.com", range);

    expect(data.attributionQuestionLabel).toBeNull();
    expect(data.recentResponses).toEqual([]);
  });

  it("leaves the attribution breakdown empty when the survey has no choice-type question", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({ id: "survey_1" } as never);
    mockDb.question.findFirst.mockResolvedValue(null);
    mockDb.order.count.mockResolvedValue(5);
    mockDb.response.findMany.mockResolvedValue([]);
    mockDb.order.findMany.mockResolvedValue([]);

    const data = await getDashboardData("shop.myshopify.com", range);

    expect(mockDb.response.groupBy).not.toHaveBeenCalled();
    expect(data.breakdown).toEqual([]);
    expect(data.topChannel).toBeNull();
    expect(data.stats.surveysShown).toBe(5);
  });

  it("ranks the breakdown by count and surfaces the top channel", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({ id: "survey_1" } as never);
    mockDb.question.findFirst.mockResolvedValue({
      id: "q_1",
      label: "How did you hear about us?",
    } as never);
    mockDb.order.count.mockResolvedValueOnce(20).mockResolvedValueOnce(10);
    mockDb.response.groupBy.mockResolvedValue([
      { answerText: "Instagram", _count: { _all: 3 } },
      { answerText: "Google", _count: { _all: 7 } },
    ] as never);
    mockDb.response.findMany.mockResolvedValue([]);
    mockDb.order.findMany.mockResolvedValue([]);

    const data = await getDashboardData("shop.myshopify.com", range);

    expect(data.attributionQuestionLabel).toBe("How did you hear about us?");
    expect(data.breakdown).toEqual([
      { option: "Google", count: 7, percentage: 70 },
      { option: "Instagram", count: 3, percentage: 30 },
    ]);
    expect(data.topChannel).toEqual({ option: "Google", count: 7, percentage: 70 });
    expect(data.stats).toEqual({ surveysShown: 20, surveysAnswered: 10, responseRate: 50 });
  });

  it("labels a null answerText as '(no answer)'", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({ id: "survey_1" } as never);
    mockDb.question.findFirst.mockResolvedValue({ id: "q_1", label: "Rate us" } as never);
    mockDb.order.count.mockResolvedValue(0);
    mockDb.response.groupBy.mockResolvedValue([
      { answerText: null, _count: { _all: 2 } },
    ] as never);
    mockDb.response.findMany.mockResolvedValue([]);
    mockDb.order.findMany.mockResolvedValue([]);

    const data = await getDashboardData("shop.myshopify.com", range);

    expect(data.breakdown).toEqual([{ option: "(no answer)", count: 2, percentage: 100 }]);
  });
});
