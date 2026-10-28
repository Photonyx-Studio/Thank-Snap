import type { ActionFunctionArgs } from "react-router";
import * as Sentry from "@sentry/react-router";
import db from "../db.server";
import { resyncSubscriptionForShop } from "../subscription.server";

// Shopify App Pricing sends no webhook for any subscription change,
// including cancellation (confirmed against shopify.dev - there's no topic
// to subscribe to here). The only other signal is the merchant's own
// welcome-link redirect after approving a plan, which refreshSubscription
// already handles. A merchant who cancels (or is moved to a different
// plan) outside that redirect - and never reopens the embedded admin
// afterwards - would otherwise keep a stale `subscriptionActive: true`
// forever, leaving both the buyer-facing survey and overage billing
// running against a subscription that no longer exists.
//
// This polls the Partner API for shops the admin hasn't refreshed recently,
// on a schedule (see .github/workflows/resync-subscriptions.yml), paced
// well under the Partner API's shared 4 req/s rate limit so it doesn't
// starve live admin/checkout traffic using the same quota.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_SHOPS_PER_RUN = 200;
const DELAY_BETWEEN_CALLS_MS = 300; // ~3.3 req/s

export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
  const shops = await db.shop.findMany({
    where: {
      subscriptionActive: true,
      OR: [{ subscriptionCheckedAt: null }, { subscriptionCheckedAt: { lt: staleBefore } }],
    },
    select: { id: true, shopDomain: true, shopGid: true },
    take: MAX_SHOPS_PER_RUN,
  });

  let resynced = 0;
  for (const shop of shops) {
    try {
      await resyncSubscriptionForShop(shop);
      resynced++;
    } catch (error) {
      console.error("Failed to resync subscription", { shopId: shop.id, error });
      Sentry.captureException(error, {
        tags: { area: "subscription-resync" },
        extra: { shopId: shop.id },
      });
    }
    // Pace calls even after a failure - a shop that errors shouldn't let
    // the loop burn through the rest faster than the shared rate limit.
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
  }

  return Response.json({ checked: shops.length, resynced });
};
