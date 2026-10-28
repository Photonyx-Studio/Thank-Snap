// Plan billing (price, trial length, order cap) is defined here AND in the
// Partner Dashboard under Shopify App Pricing - the dashboard is what
// actually charges merchants, this is what the app displays and enforces
// against. Keep `handle` in sync with each plan's plan_handle there; a
// handle that doesn't match anything configured there falls back to
// unlimited (see getUsageStatus in subscription.server.ts) rather than
// silently blocking a paying merchant over a typo.
//
// The live handles are the plan name lowercased (confirmed against
// production: real shops are on "seed" and "starter", not "tier-1"/"tier-2"
// as previously written here) - Partner Dashboard slugs plan_handle from the
// plan's display name rather than using whatever handle you type, so these
// must track each plan's `name` below, not an arbitrary string.
export interface PlanTier {
  handle: string;
  name: string;
  price: { amount: number; currencyCode: string };
  /** Orders-with-survey-shown included per calendar month. */
  orderCap: number;
  /**
   * Per-order charge once orderCap is used up, billed through the
   * OVERAGE_METER_HANDLE usage meter (see usage-billing.server.ts). Must
   * match that meter's fixed price on this plan in the Partner Dashboard.
   * Omit it and the plan hard-caps instead: the survey stops showing at
   * orderCap until next month.
   */
  overagePrice?: { amount: number; currencyCode: string };
}

// The usage meter's handle - must match the meter configured on every plan
// above that has an overagePrice, in the Partner Dashboard's pricing
// settings (fixed pricing, one unit per order over the plan's cap).
export const OVERAGE_METER_HANDLE = "extra_order";

export const PLAN_TIERS: PlanTier[] = [
  {
    handle: "seed",
    name: "Seed",
    price: { amount: 0, currencyCode: "USD" },
    orderCap: 100,
    overagePrice: { amount: 0.02, currencyCode: "USD" },
  },
  {
    handle: "starter",
    name: "Starter",
    price: { amount: 19, currencyCode: "USD" },
    orderCap: 1000,
    overagePrice: { amount: 0.02, currencyCode: "USD" },
  },
  {
    handle: "growth",
    name: "Growth",
    price: { amount: 49, currencyCode: "USD" },
    orderCap: 5000,
    overagePrice: { amount: 0.02, currencyCode: "USD" },
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

/**
 * The plan's own item in a subscription's items - Shopify App Pricing lists
 * usage meters as items too (by their meter handle), so items[0] isn't
 * guaranteed to be the plan once a plan has a meter.
 */
export function findPlanItemHandle(
  items: { handle: string | null }[] | null | undefined,
): string | null {
  if (!items?.length) return null;
  const planItem =
    items.find((item) => findPlanTier(item.handle) !== null) ??
    items.find((item) => item.handle !== OVERAGE_METER_HANDLE);
  return planItem?.handle ?? null;
}

export function findPlanTier(handle: string | null | undefined): PlanTier | null {
  if (!handle) return null;
  return PLAN_TIERS.find((tier) => tier.handle === handle) ?? null;
}
