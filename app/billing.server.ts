// Plan billing (price, trial length, order cap) is defined here AND in the
// Partner Dashboard under Shopify App Pricing - the dashboard is what
// actually charges merchants, this is what the app displays and enforces
// against. Keep `handle` in sync with each plan's plan_handle there; a
// handle that doesn't match anything configured there falls back to
// unlimited (see getUsageStatus in subscription.server.ts) rather than
// silently blocking a paying merchant over a typo.
export interface PlanTier {
  handle: string;
  name: string;
  price: { amount: number; currencyCode: string };
  /** Orders-with-survey-shown included per calendar month. */
  orderCap: number;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    handle: "tier-1",
    name: "Seed",
    price: { amount: 0, currencyCode: "USD" },
    orderCap: 100,
  },
  {
    handle: "tier-2",
    name: "Starter",
    price: { amount: 19, currencyCode: "USD" },
    orderCap: 1000,
  },
  {
    handle: "tier-3",
    name: "Growth",
    price: { amount: 49, currencyCode: "USD" },
    orderCap: 5000,
  },
];

// Shared by every tier - shown on the Billing page under each plan.
export const PLAN_FEATURES = [
  "Unlimited survey questions - single choice, multiple choice, open text, rating, and yes/no",
  "Premade survey templates to start from",
  "Drag-and-drop question builder with reordering",
  "One-click checkout page integration on the Thank you page",
  "Full response history with every answer, linked to the order",
  "CSV export of every response, one row per order",
  "Response-rate tracking widget on the app home page",
];

export function findPlanTier(handle: string | null | undefined): PlanTier | null {
  if (!handle) return null;
  return PLAN_TIERS.find((tier) => tier.handle === handle) ?? null;
}
