import { BillingInterval } from "@shopify/shopify-app-react-router/server";
import type { BillingConfigSubscriptionLineItemPlan } from "@shopify/shopify-api";

export const STARTER_PLAN = "Starter";

export const billingConfig: Record<
  string,
  BillingConfigSubscriptionLineItemPlan
> = {
  [STARTER_PLAN]: {
    trialDays: 14,
    lineItems: [
      {
        amount: 19,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
    ],
  },
};
