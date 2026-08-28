import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findShopBySessionToken } from "../models/shop.server";
import db from "../db.server";

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

  const shop = await findShopBySessionToken(sessionToken);
  const survey = shop
    ? await db.survey.findFirst({ where: { id: surveyId, shopId: shop.id } })
    : null;

  if (!shop || !survey) {
    return cors(Response.json({ error: "Unknown survey" }, { status: 404 }));
  }

  await db.order.upsert({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId: orderId } },
    create: {
      shopId: shop.id,
      shopifyOrderId: orderId,
      orderNumber: orderNumber ?? null,
    },
    update: {},
  });

  return cors(new Response(null, { status: 204 }));
};
