import db from "../db.server";

export interface ResponseStats {
  /** Orders where the survey was shown to the buyer (an Order row exists). */
  surveysShown: number;
  /** Of those, how many had at least one answer submitted. */
  surveysAnswered: number;
  responseRate: number | null;
}

/**
 * Response rate is measured as "of buyers who saw the survey, how many
 * answered it" — not "of all store orders". Tracking every store order
 * would need the read_orders scope plus an orders webhook, both of which
 * require Shopify's Protected Customer Data approval since order payloads
 * carry customer PII. This avoids that entirely: Order rows here are only
 * ever created from data the checkout extension already has legitimate
 * access to (OrderConfirmationApi's order id/number, not protected), either
 * when the survey is shown (api.survey-view) or answered (api.response).
 */
export async function getResponseStats(shopDomain: string): Promise<ResponseStats> {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) {
    return { surveysShown: 0, surveysAnswered: 0, responseRate: null };
  }

  const [surveysShown, surveysAnswered] = await Promise.all([
    db.order.count({ where: { shopId: shop.id } }),
    db.order.count({ where: { shopId: shop.id, responses: { some: {} } } }),
  ]);

  return {
    surveysShown,
    surveysAnswered,
    responseRate:
      surveysShown > 0 ? Math.round((surveysAnswered / surveysShown) * 1000) / 10 : null,
  };
}
