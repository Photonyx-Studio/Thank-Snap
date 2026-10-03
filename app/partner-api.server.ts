const PARTNER_API_VERSION = "2026-07";

export interface ActiveSubscription {
  billingPeriod: string;
  trialEndsAt: string | null;
  currentBillingCycle: { startTime: string; endTime: string } | null;
  items: { handle: string }[];
}

/**
 * Queries the Partner API's Active Subscription API - the source of truth
 * for Shopify App Pricing subscriptions (unlike the legacy Billing API,
 * this status doesn't come from the GraphQL Admin API). Returns `null` only
 * when the shop has no Shopify App Pricing contract for this app; throws on
 * throttling or any other failure so a rate-limited request never gets
 * misread as "no subscription" and blocks a paying merchant.
 *
 * The Partner API is rate-limited to 4 requests/second per client, shared
 * across every merchant using this app - callers must cache a *confirmed*
 * active subscription rather than calling this on every request. See
 * subscription.server.ts.
 */
export async function fetchActiveSubscription(
  shopGid: string,
): Promise<ActiveSubscription | null> {
  const organizationId = process.env.SHOPIFY_PARTNER_ORG_ID;
  const accessToken = process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;
  const appGid = process.env.SHOPIFY_APP_GID;

  if (!organizationId || !accessToken || !appGid) {
    throw new Error(
      "SHOPIFY_PARTNER_ORG_ID, SHOPIFY_PARTNER_API_ACCESS_TOKEN, and SHOPIFY_APP_GID must all be set to check Shopify App Pricing subscriptions",
    );
  }

  const response = await fetch(
    `https://partners.shopify.com/${organizationId}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `#graphql
          query ActiveSubscription($appId: ID!, $shopId: ID!) {
            activeSubscription(appId: $appId, shopId: $shopId) {
              billingPeriod
              trialEndsAt
              currentBillingCycle { startTime endTime }
              items { handle }
            }
          }
        `,
        variables: { appId: appGid, shopId: shopGid },
      }),
    },
  );

  const { data, errors } = (await response.json()) as {
    data?: { activeSubscription: ActiveSubscription | null };
    errors?: unknown;
  };

  // Throw on throttling or other failures so the caller doesn't treat a
  // failed check as "no subscription" and gate out a paying merchant.
  if (!response.ok || errors) {
    throw new Error(
      `Partner API request failed: ${JSON.stringify(errors ?? response.status)}`,
    );
  }

  return data?.activeSubscription ?? null;
}
