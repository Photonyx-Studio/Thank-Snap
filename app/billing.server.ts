import { BillingInterval } from "@shopify/shopify-app-react-router/server";
import type { BillingConfigSubscriptionLineItemPlan } from "@shopify/shopify-api";

export const STARTER_PLAN = "Starter";

export const STARTER_PLAN_PRICE = { amount: 19, currencyCode: "USD" };
export const STARTER_PLAN_TRIAL_DAYS = 14;

export const STARTER_PLAN_FEATURES = [
  "Unlimited survey questions - single choice, multiple choice, open text, and rating",
  "Premade survey templates to start from",
  "Drag-and-drop question builder with reordering",
  "One-click checkout page integration on the Thank you page",
  "Full response history with every answer, linked to the order",
  "Response-rate tracking widget on the app home page",
];

export const billingConfig: Record<
  string,
  BillingConfigSubscriptionLineItemPlan
> = {
  [STARTER_PLAN]: {
    trialDays: STARTER_PLAN_TRIAL_DAYS,
    lineItems: [
      {
        amount: STARTER_PLAN_PRICE.amount,
        currencyCode: STARTER_PLAN_PRICE.currencyCode,
        interval: BillingInterval.Every30Days,
      },
    ],
  },
};
