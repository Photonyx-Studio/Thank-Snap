import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import * as Sentry from "@sentry/react-router";
import { authenticate } from "../shopify.server";
import { shopDomainFromSessionToken } from "../models/shop.server";
import db from "../db.server";
import { billOverageIfNeeded } from "../usage-billing.server";

// This route only ever receives POST requests from the extension, but a
// browser's CORS preflight for that POST arrives as an OPTIONS request —
// and without a loader present, that OPTIONS request never reaches
// authenticate.public.checkout()'s built-in preflight handling (it throws a
// 204 + CORS-headers Response when request.method === "OPTIONS"), so the
// browser's preflight check fails before the real POST is ever attempted.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.checkout(request);
  return new Response(null, { status: 405 });
};

interface SurveyViewBody {
  surveyId: string;
  orderId?: string;
  orderNumber?: string;
}

/**
 * Records that a survey was shown to a buyer on the Thank you page, whether
 * or not they answer it. This is what the response-rate widget's denominator
 * is built from — deliberately not a full order sync (which would need
 * read_orders + an orders webhook, and Shopify requires Protected Customer
 * Data approval for that). The order id/number here come from the checkout
 * extension's own OrderConfirmationApi, which isn't protected customer data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);

  const body = (await request.json()) as SurveyViewBody;
  const { surveyId, orderId, orderNumber } = body;

  if (!surveyId || !orderId) {
    return cors(Response.json({ error: "surveyId and orderId are required" }, { status: 400 }));
  }

  // One query (shop -> the matching survey) instead of two sequential round
  // trips - this fires on every Thank you page view, so it counts toward
  // Shopify's checkout performance score.
  const shop = await db.shop.findUnique({
    where: { shopDomain: shopDomainFromSessionToken(sessionToken) },
    include: { surveys: { where: { id: surveyId }, take: 1, select: { id: true } } },
  });

  if (!shop || shop.surveys.length === 0) {
    return cors(Response.json({ error: "Unknown survey" }, { status: 404 }));
  }

  const order = await db.order.upsert({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
    create: {
      shopId: shop.id,
      shopifyOrderId: orderId,
      orderNumber: orderNumber ?? null,
      reporterSid: sessionToken.sid,
    },
    update: {},
  });

  // orderId is unverified buyer-supplied data (see the docblock above) - a
  // captured session token replayed with fabricated order ids would
  // otherwise let a buyer rack up real overage charges on the merchant's
  // Shopify bill for orders that never happened. `sid` is unique per buyer
  // checkout session, so the same sid already attached to a *different*
  // order means this token is being replayed, not legitimately reloading
  // the same Thank you page - withhold billing (not the survey-view record
  // itself, which only affects the response-rate widget) in that case.
  const reusedSid = await db.order.findFirst({
    where: { shopId: shop.id, reporterSid: sessionToken.sid, id: { not: order.id } },
    select: { id: true },
  });

  if (reusedSid) {
    Sentry.captureMessage("Checkout session token reused across distinct orders", {
      level: "warning",
      tags: { area: "usage-billing" },
      extra: { shopId: shop.id, orderId: order.id },
    });
  } else {
    // Past the plan's included orders, each shown survey is a usage charge.
    // Awaited (not fire-and-forget) so a serverless runtime can't freeze it
    // mid-request - the buyer never waits on this response anyway.
    await billOverageIfNeeded(shop, order);
  }

  return cors(new Response(null, { status: 204 }));
};
