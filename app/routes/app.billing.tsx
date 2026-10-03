import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { getPlanSelectionUrl, getUsageStatus } from "../subscription.server";
import { findPlanTier, PLAN_FEATURES, PLAN_TIERS } from "../billing.server";

// The merchant-facing /app/billing page: current plan + this month's usage
// against its order cap, every tier on offer (PLAN_TIERS), and the shared
// feature list (PLAN_FEATURES) every tier includes. Plan changes themselves
// happen on Shopify's own hosted page (manageUrl); this route only reads
// and displays state.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [shop, manageUrl, usage] = await Promise.all([
    db.shop.findUnique({ where: { shopDomain: session.shop } }),
    getPlanSelectionUrl(admin, session.shop),
    getUsageStatus(session.shop),
  ]);

  const isInTrial = Boolean(
    shop?.subscriptionTrialEndsAt && shop.subscriptionTrialEndsAt.getTime() > Date.now(),
  );
  const currentTier = findPlanTier(shop?.subscriptionPlanHandle);

  return {
    tiers: PLAN_TIERS,
    features: PLAN_FEATURES,
    manageUrl,
    usage,
    subscription: shop?.subscriptionActive
      ? {
          planHandle: shop.subscriptionPlanHandle,
          planName: currentTier?.name ?? null,
          price: currentTier?.price ?? null,
          isInTrial,
          trialEndsOn: shop.subscriptionTrialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: shop.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillingPage() {
  const { tiers, features, subscription, manageUrl, usage } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Billing">
      <s-section heading="Current plan">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={subscription ? "success" : "neutral"}>
            {subscription
              ? subscription.isInTrial
                ? "Free trial"
                : "Active"
              : "No active plan"}
          </s-badge>
          <s-heading>
            {subscription?.planName ?? "No plan selected"}
            {subscription?.price ? ` - $${subscription.price.amount} / month` : ""}
          </s-heading>
        </s-stack>

        {subscription?.isInTrial && subscription.trialEndsOn ? (
          <s-paragraph>
            You&apos;re in your free trial - it ends on{" "}
            {formatDate(subscription.trialEndsOn)}. You won&apos;t be
            charged until then.
          </s-paragraph>
        ) : subscription?.currentPeriodEnd ? (
          <s-paragraph>
            Renews on {formatDate(subscription.currentPeriodEnd)}.
          </s-paragraph>
        ) : (
          <s-paragraph>
            You don&apos;t have an active subscription yet.
          </s-paragraph>
        )}

        {usage.orderCap !== null ? (
          <s-text tone={usage.isOverCap ? "critical" : "neutral"}>
            {usage.currentCount} / {usage.orderCap} orders used this month
            {usage.isOverCap
              ? " - the survey has stopped showing on your Thank you page until you upgrade or next month starts."
              : ""}
          </s-text>
        ) : null}

        <s-button href={manageUrl} target="_top" variant="secondary">
          {subscription ? "Manage plan" : "Choose a plan"}
        </s-button>
      </s-section>

      <s-section heading="Plans">
        {/* One card per tier; the subscribed tier (if any) is highlighted
            via background, not a separate badge-only treatment, so it
            reads at a glance in a row of otherwise-identical cards. */}
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          {tiers.map((tier) => (
            <s-box
              key={tier.handle}
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background={
                tier.handle === subscription?.planHandle
                  ? "strong"
                  : "subdued"
              }
            >
              <s-stack direction="block" gap="small">
                <s-heading>{tier.name}</s-heading>
                <s-text>
                  {tier.price.amount === 0 ? "Free" : `$${tier.price.amount} / month`}
                </s-text>
                <s-text tone="neutral">
                  Up to {tier.orderCap.toLocaleString()} orders/month
                </s-text>
                {tier.handle === subscription?.planHandle ? (
                  <s-badge tone="success">Current plan</s-badge>
                ) : null}
              </s-stack>
            </s-box>
          ))}
        </s-grid>

        <s-heading>What&apos;s included in every plan</s-heading>
        <s-unordered-list>
          {features.map((feature) => (
            <s-list-item key={feature}>{feature}</s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Managing your subscription">
        <s-paragraph>
          Plan changes and cancellations are handled by Shopify - use the
          &ldquo;Manage plan&rdquo; button to view or change your plan at
          any time.
        </s-paragraph>
        <s-paragraph>
          Order usage resets at the start of each calendar month. If you go
          over your plan&apos;s included orders, the survey stops appearing
          on your Thank you page until you upgrade or the next month starts
          - nothing else in the app is affected.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
