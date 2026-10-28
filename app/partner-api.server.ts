const PARTNER_API_VERSION = "2026-07"; // appSubscriptionCancel needs 2026-07+

function partnerApiCredentials() {
  const organizationId = process.env.SHOPIFY_PARTNER_ORG_ID;
  const accessToken = process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;
  const appGid = process.env.SHOPIFY_APP_GID;

  if (!organizationId || !accessToken || !appGid) {
    throw new Error(
      "SHOPIFY_PARTNER_ORG_ID, SHOPIFY_PARTNER_API_ACCESS_TOKEN, and SHOPIFY_APP_GID must all be set to check Shopify App Pricing subscriptions",
    );
  }

  return { organizationId, accessToken, appGid };
}

async function partnerApiRequest<T>(query: string, variables: object): Promise<T> {
  const { organizationId, accessToken } = partnerApiCredentials();

  const response = await fetch(
    `https://partners.shopify.com/${organizationId}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const { data, errors } = (await response.json()) as { data?: T; errors?: unknown };

  // Throw on throttling or other failures so the caller doesn't treat a
  // failed request as a benign result (e.g. "no subscription") and either
  // gates out a paying merchant or tells one their cancellation went
  // through when it didn't.
  if (!response.ok || errors) {
    throw new Error(
      `Partner API request failed: ${JSON.stringify(errors ?? response.status)}`,
    );
  }

  return data as T;
}

export interface ActiveSubscription {
  billingPeriod: string;
  /** True once the merchant has cancelled - access lasts until the cycle ends. */
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  currentBillingCycle: { startTime: string; endTime: string } | null;
  /** The plan item plus one item per usage meter, each by its handle. */
  items: { handle: string | null }[];
  /** A plan change scheduled for the end of the current cycle, if any. */
  pendingUpdate: { items: { handle: string | null }[] } | null;
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
  const { appGid } = partnerApiCredentials();

  const { activeSubscription } = await partnerApiRequest<{
    activeSubscription: ActiveSubscription | null;
  }>(
    `#graphql
      query ActiveSubscription($appId: ID!, $shopId: ID!) {
        activeSubscription(appId: $appId, shopId: $shopId) {
          billingPeriod
          cancelAtEndOfCycle
          trialEndsAt
          currentBillingCycle { startTime endTime }
          items { handle }
          pendingUpdate { items { handle } }
        }
      }
    `,
    { appId: appGid, shopId: shopGid },
  );

  return activeSubscription;
}

/**
 * Cancels the shop's Shopify App Pricing subscription for this app via the
 * Partner API's `appSubscriptionCancel` mutation - the merchant-facing
 * "Cancel subscription" button on the Billing page. Deferred (not
 * immediate): access and the order cap continue until the current billing
 * cycle ends, matching `cancelAtEndOfCycle` as already modeled by
 * refreshSubscription, rather than cutting the merchant off mid-cycle.
 *
 * Requires the Partner API client to have the "View financials" permission
 * in the Partner Dashboard - without it this throws a permission error.
 */
export async function cancelActiveSubscription(shopGid: string): Promise<void> {
  const { appGid } = partnerApiCredentials();

  const { appSubscriptionCancel } = await partnerApiRequest<{
    appSubscriptionCancel: { userErrors: { field: string[]; message: string }[] };
  }>(
    `#graphql
      mutation CancelAppSubscription(
        $appId: ID!
        $shopId: ID!
        $prorate: Boolean!
        $skipFinalUsageCharge: Boolean!
        $deferCancellation: Boolean!
      ) {
        appSubscriptionCancel(
          appId: $appId
          shopId: $shopId
          prorate: $prorate
          skipFinalUsageCharge: $skipFinalUsageCharge
          deferCancellation: $deferCancellation
        ) {
          userErrors { field message }
        }
      }
    `,
    {
      appId: appGid,
      shopId: shopGid,
      prorate: false,
      skipFinalUsageCharge: false,
      deferCancellation: true,
    },
  );

  if (appSubscriptionCancel.userErrors.length > 0) {
    throw new Error(
      `appSubscriptionCancel failed: ${JSON.stringify(appSubscriptionCancel.userErrors)}`,
    );
  }
}
