import db from "./db.server";
import { fetchActiveSubscription } from "./partner-api.server";
import { findPlanTier } from "./billing.server";
import type { authenticate } from "./shopify.server";

type AdminContext = Awaited<ReturnType<typeof authenticate.admin>>;

// Shopify's own guidance: cache only a *confirmed* active subscription, with
// a short expiry - a merchant who just approved a plan is checked
// immediately (nothing to cache yet), and a cancellation or freeze is picked
// up the next time the cache expires.
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Ensures the shop has an active Shopify App Pricing subscription, and
 * returns a redirect Response to the hosted plan selection page if not -
 * the caller must `return` it from the loader. Returns `null` when the shop
 * is already subscribed and nothing further is needed.
 */
export async function requireActiveSubscription({
  admin,
  session,
  redirect,
}: Pick<AdminContext, "admin" | "session" | "redirect">): Promise<Response | null> {
  const shop = await db.shop.upsert({
    where: { shopDomain: session.shop },
    create: { shopDomain: session.shop },
    update: {},
  });

  const cacheIsFresh =
    shop.subscriptionActive &&
    shop.subscriptionCheckedAt !== null &&
    Date.now() - shop.subscriptionCheckedAt.getTime() < CACHE_TTL_MS;

  if (cacheIsFresh) return null;

  const shopGidResponse = await admin.graphql(`#graphql
    query ShopGid { shop { id } }
  `);
  const {
    data: {
      shop: { id: shopGid },
    },
  } = await shopGidResponse.json();

  const subscription = await fetchActiveSubscription(shopGid);

  await db.shop.update({
    where: { id: shop.id },
    data: {
      subscriptionActive: Boolean(subscription),
      subscriptionPlanHandle: subscription?.items[0]?.handle ?? null,
      subscriptionTrialEndsAt: subscription?.trialEndsAt
        ? new Date(subscription.trialEndsAt)
        : null,
      subscriptionCurrentPeriodEnd: subscription?.currentBillingCycle?.endTime
        ? new Date(subscription.currentBillingCycle.endTime)
        : null,
      subscriptionCheckedAt: new Date(),
    },
  });

  if (subscription) return null;

  return redirect(await getPlanSelectionUrl(admin, session.shop), {
    target: "_top", // required - the URL is outside the app's own scope
  });
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export interface UsageStatus {
  planHandle: string | null;
  planName: string | null;
  /** null = no recognized plan, i.e. not enforced (fail open - see PLAN_TIERS). */
  orderCap: number | null;
  currentCount: number;
  /** ISO date - the current calendar month (UTC) this count covers. */
  periodStart: string;
  isOverCap: boolean;
}

interface ShopUsageFields {
  id: string;
  subscriptionPlanHandle: string | null;
  usagePeriodStart: Date | null;
  usagePeriodOrderCount: number;
  usageCheckedAt: Date | null;
}

/**
 * Same as getUsageStatus, but for a Shop row the caller already has (e.g.
 * api.active-survey's own shop lookup) - avoids a second round trip on
 * checkout's hottest path just to re-fetch what's already in hand.
 */
export async function getUsageStatusFromShop(
  shop: ShopUsageFields,
): Promise<UsageStatus> {
  const periodStart = startOfMonthUtc(new Date());

  const cacheIsFresh =
    shop.usageCheckedAt !== null &&
    Date.now() - shop.usageCheckedAt.getTime() < CACHE_TTL_MS &&
    shop.usagePeriodStart !== null &&
    shop.usagePeriodStart.getTime() === periodStart.getTime();

  let currentCount = shop.usagePeriodOrderCount;

  if (!cacheIsFresh) {
    currentCount = await db.order.count({
      where: { shopId: shop.id, createdAt: { gte: periodStart } },
    });

    await db.shop.update({
      where: { id: shop.id },
      data: {
        usagePeriodStart: periodStart,
        usagePeriodOrderCount: currentCount,
        usageCheckedAt: new Date(),
      },
    });
  }

  const tier = findPlanTier(shop.subscriptionPlanHandle);

  return {
    planHandle: shop.subscriptionPlanHandle,
    planName: tier?.name ?? null,
    orderCap: tier?.orderCap ?? null,
    currentCount,
    periodStart: periodStart.toISOString(),
    isOverCap: tier !== null && currentCount >= tier.orderCap,
  };
}

/**
 * This shop's order count for the current calendar month against its
 * plan's included-orders cap, cached with the same TTL/reasoning as
 * requireActiveSubscription. Fetches the shop itself - if the caller
 * already has it loaded (e.g. api.active-survey's own shop lookup), use
 * getUsageStatusFromShop instead to skip the extra round trip.
 *
 * An unrecognized or missing plan handle yields orderCap: null (not
 * enforced) rather than blocking - see findPlanTier's docblock.
 */
export async function getUsageStatus(shopDomain: string): Promise<UsageStatus> {
  const shop = await db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });
  return getUsageStatusFromShop(shop);
}

/** Shopify's hosted page where merchants view and change their plan. */
export async function getPlanSelectionUrl(
  admin: AdminContext["admin"],
  shopDomain: string,
): Promise<string> {
  const storeHandle = shopDomain.replace(".myshopify.com", "");

  const appHandleResponse = await admin.graphql(`#graphql
    query AppHandle { app { handle } }
  `);
  const {
    data: {
      app: { handle: appHandle },
    },
  } = await appHandleResponse.json();

  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}
