import db from "../db.server";
import { percentage } from "../utils/percentage";
import { toResponseRow, type ResponseRow } from "./response.server";
import type { DateRange } from "./dateRange";

/** The trend chart's window when "All time" is selected — the KPI tiles and
 * breakdown stay truly unbounded, but a daily chart over a store's entire
 * history would grow without limit, so the chart itself is capped here. */
const ALL_TIME_TREND_WINDOW_DAYS = 90;

export interface AttributionOption {
  option: string;
  count: number;
  percentage: number;
}

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string;
  shown: number;
  answered: number;
}

export interface DashboardData {
  stats: {
    surveysShown: number;
    surveysAnswered: number;
    responseRate: number | null;
  };
  attributionQuestionLabel: string | null;
  breakdown: AttributionOption[];
  topChannel: AttributionOption | null;
  trend: TrendPoint[];
  recentResponses: ResponseRow[];
}

const EMPTY_DASHBOARD: DashboardData = {
  stats: { surveysShown: 0, surveysAnswered: 0, responseRate: null },
  attributionQuestionLabel: null,
  breakdown: [],
  topChannel: null,
  trend: [],
  recentResponses: [],
};

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Buckets orders into daily {shown, answered} counts, filling every day in
 * [from, to] with zeros so the trend chart has no gaps. */
export function bucketOrdersByDay(
  orders: { createdAt: Date; hasResponse: boolean }[],
  from: Date,
  to: Date,
): TrendPoint[] {
  const byDay = new Map<string, TrendPoint>();

  const cursor = new Date(toDayKey(from));
  const end = new Date(toDayKey(to));
  while (cursor <= end) {
    const key = toDayKey(cursor);
    byDay.set(key, { date: key, shown: 0, answered: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const order of orders) {
    const key = toDayKey(order.createdAt);
    const point = byDay.get(key);
    if (!point) continue; // outside the window (shouldn't happen given the query's own filter)
    point.shown += 1;
    if (order.hasResponse) point.answered += 1;
  }

  return Array.from(byDay.values());
}

function trendWindow(range: DateRange): { from: Date; to: Date } {
  if (range.from) return { from: range.from, to: range.to };
  const from = new Date(range.to);
  from.setDate(from.getDate() - ALL_TIME_TREND_WINDOW_DAYS);
  return { from, to: range.to };
}

export async function getDashboardData(
  shopDomain: string,
  range: DateRange,
): Promise<DashboardData> {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return EMPTY_DASHBOARD;

  const survey = await db.survey.findFirst({ where: { shopId: shop.id } });
  if (!survey) return EMPTY_DASHBOARD;

  const createdAtWhere = range.from ? { gte: range.from, lte: range.to } : undefined;

  const attributionQuestion = await db.question.findFirst({
    where: { surveyId: survey.id, type: { in: ["SINGLE_CHOICE", "MULTIPLE_CHOICE"] } },
    orderBy: { position: "asc" },
  });

  const window = trendWindow(range);

  const [surveysShown, surveysAnswered, grouped, recentResponsesRaw, orders] = await Promise.all([
    db.order.count({ where: { shopId: shop.id, createdAt: createdAtWhere } }),
    db.order.count({
      where: { shopId: shop.id, createdAt: createdAtWhere, responses: { some: {} } },
    }),
    attributionQuestion
      ? db.response.groupBy({
          by: ["answerText"],
          where: { questionId: attributionQuestion.id, createdAt: createdAtWhere },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    db.response.findMany({
      where: { survey: { shopId: shop.id }, createdAt: createdAtWhere },
      include: { order: true, question: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Independent of the four queries above, so it runs in the same
    // round-trip batch rather than adding a sequential DB hit to the page's
    // critical path.
    db.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: window.from, lte: window.to } },
      select: { createdAt: true, _count: { select: { responses: true } } },
    }),
  ]);

  const totalAnswers = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const breakdown: AttributionOption[] = grouped
    .map((g) => ({
      option: g.answerText ?? "(no answer)",
      count: g._count._all,
      percentage: percentage(g._count._all, totalAnswers) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const trend = bucketOrdersByDay(
    orders.map((o) => ({ createdAt: o.createdAt, hasResponse: o._count.responses > 0 })),
    window.from,
    window.to,
  );

  return {
    stats: {
      surveysShown,
      surveysAnswered,
      responseRate: percentage(surveysAnswered, surveysShown),
    },
    attributionQuestionLabel: attributionQuestion?.label ?? null,
    breakdown,
    topChannel: breakdown[0] ?? null,
    trend,
    recentResponses: recentResponsesRaw.map(toResponseRow),
  };
}
