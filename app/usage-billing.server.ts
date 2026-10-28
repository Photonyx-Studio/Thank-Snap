import * as Sentry from "@sentry/react-router";
import type { Order, Shop } from "@prisma/client";
import db from "./db.server";
import { sendBillingEvent } from "./app-events.server";
import { findPlanTier, OVERAGE_METER_HANDLE } from "./billing.server";
import { fetchAndCacheShopGid, startOfMonthUtc } from "./subscription.server";

type ShopForBilling = Pick<
  Shop,
  "id" | "shopDomain" | "shopGid" | "subscriptionActive" | "subscriptionPlanHandle"
>;
type OrderForBilling = Pick<Order, "id" | "createdAt" | "overageBilledAt">;

/**
 * Bills one OVERAGE_METER_HANDLE unit for `order` if it's past the shop's
 * plan's included orders this month (PlanTier.orderCap). Called each time
 * the survey is shown (api.survey-view), which is what orderCap counts.
 *
 * Never throws - a billing failure is reported to Sentry but must not break
 * the buyer-facing request. Retrying is always safe: the idempotency key is
 * the order's own id, which Shopify dedupes permanently, so the same order
 * can't be charged twice.
 */
export async function billOverageIfNeeded(
  shop: ShopForBilling,
  order: OrderForBilling,
): Promise<void> {
  try {
    if (order.overageBilledAt || !shop.subscriptionActive) return;

    const tier = findPlanTier(shop.subscriptionPlanHandle);
    if (!tier?.overagePrice) return;

    // Only orders from this month count against this month's cap - a
    // reloaded Thank you page for an older order isn't new usage.
    const periodStart = startOfMonthUtc(new Date());
    if (order.createdAt < periodStart) return;

    // This order's position within the month, counted live rather than from
    // the cached usage count - billing has to be exact, and the cache can be
    // up to CACHE_TTL_MS behind. Stable across retries for the same order.
    //
    // Ordered by (createdAt, id) rather than createdAt alone: two orders can
    // share the same createdAt (same DB timestamp tick under concurrent
    // traffic), and a plain `createdAt <= order.createdAt` count would give
    // every tied row the same inclusive count - so if a tie straddles the
    // cap, all of them bill, not just the one(s) actually past it. `id` only
    // needs to be a stable tiebreaker, not chronological, to make each row's
    // position unique.
    const position = await getOrderPosition(shop.id, periodStart, order);
    if (position <= tier.orderCap) return;

    await sendBillingEvent({
      shopGid: shop.shopGid ?? (await fetchAndCacheShopGid(shop)),
      eventHandle: OVERAGE_METER_HANDLE,
      idempotencyKey: `order-${order.id}`,
      value: 1,
    });

    await db.order.update({
      where: { id: order.id },
      data: { overageBilledAt: new Date() },
    });
  } catch (error) {
    console.error("Failed to bill overage order", { orderId: order.id, error });
    Sentry.captureException(error, {
      tags: { area: "usage-billing" },
      extra: { shopId: shop.id, orderId: order.id },
    });
  }
}

async function getOrderPosition(
  shopId: string,
  periodStart: Date,
  order: OrderForBilling,
): Promise<number> {
  const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Order"
    WHERE "shopId" = ${shopId}
      AND "createdAt" >= ${periodStart}
      AND (
        "createdAt" < ${order.createdAt}
        OR ("createdAt" = ${order.createdAt} AND "id" <= ${order.id})
      )
  `;
  return Number(count);
}

