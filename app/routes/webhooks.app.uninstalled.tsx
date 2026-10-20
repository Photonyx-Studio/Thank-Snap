import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Uninstalling cancels the app subscription, so forget the cached one -
  // otherwise a reinstall within the cache TTL would skip Shopify's plan
  // approval page and keep the old plan without the merchant re-approving
  // the charge. Runs regardless of `session` (this webhook can be
  // redelivered) and is a no-op for a shop with no row.
  await db.shop.updateMany({
    where: { shopDomain: shop },
    data: {
      subscriptionActive: false,
      subscriptionPlanHandle: null,
      subscriptionTrialEndsAt: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionCancelAtEndOfCycle: false,
      subscriptionPendingPlanHandle: null,
      subscriptionCheckedAt: null,
    },
  });

  return new Response();
};
