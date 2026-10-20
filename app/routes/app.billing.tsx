import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import {
  getPlanSelectionUrl,
  getUsageStatus,
  refreshSubscription,
} from "../subscription.server";
import { findPlanTier, PLAN_FEATURES, PLAN_TIERS } from "../billing.server";

// The merchant-facing /app/billing page: current plan + this month's usage
// against its order cap, every tier on offer (PLAN_TIERS), and the shared
// feature list (PLAN_FEATURES) every tier includes. Plan changes themselves
// happen on Shopify's own hosted page (manageUrl); this route only reads
// and displays state.
//
// Point each plan's welcome link in the Partner Dashboard here
// (/app/billing): Shopify appends plan_handle after the merchant approves
// a plan, which this page uses to confirm the change.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Always read the live subscription here, never the cache: this is where
  // a merchant checks that a plan change took effect, including when they
  // come back from Shopify's plan page some other way than the welcome
  // link. It's a rarely-visited page (and deliberately not eagerly
  // preloaded in app.tsx), so the Partner API's shared rate limit isn't a
  // concern.
  const planHandle = new URL(request.url).searchParams.get("plan_handle");
  await refreshSubscription({ admin, session, planHandle, force: true });

  const [shop, manageUrl, usage] = await Promise.all([
    db.shop.findUnique({ where: { shopDomain: session.shop } }),
    getPlanSelectionUrl(admin, session.shop),
    getUsageStatus(session.shop),
  ]);

  const isInTrial = Boolean(
    shop?.subscriptionTrialEndsAt && shop.subscriptionTrialEndsAt.getTime() > Date.now(),
  );
  const currentTier = findPlanTier(shop?.subscriptionPlanHandle);
  const pendingTier = findPlanTier(shop?.subscriptionPendingPlanHandle);

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
          cancelAtEndOfCycle: shop.subscriptionCancelAtEndOfCycle,
          pendingPlanName: shop.subscriptionPendingPlanHandle
            ? (pendingTier?.name ?? shop.subscriptionPendingPlanHandle)
            : null,
        }
      : null,
    // Only confirm the plan Shopify redirected back with if it's really
    // the one now active - never claim a change the Partner API doesn't show.
    justSubscribed:
      Boolean(planHandle) &&
      shop?.subscriptionActive === true &&
      shop.subscriptionPlanHandle === planHandle,
  };
};

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BillingPage() {
  const { tiers, features, subscription, manageUrl, usage, justSubscribed } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Billing">
      {justSubscribed && subscription?.planName ? (
        <s-banner heading={`You're on the ${subscription.planName} plan`} tone="success">
          <s-paragraph>
            Thanks for subscribing - your new plan and order limit are
            active now.
          </s-paragraph>
        </s-banner>
      ) : null}

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

        {subscription?.cancelAtEndOfCycle && subscription.currentPeriodEnd ? (
          <s-paragraph>
            Your plan is cancelled and ends on{" "}
            {formatDate(subscription.currentPeriodEnd)}. You can keep using
            it until then, or choose a plan again to stay subscribed.
          </s-paragraph>
        ) : subscription?.isInTrial && subscription.trialEndsOn ? (
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

        {subscription?.pendingPlanName && !subscription.cancelAtEndOfCycle ? (
          <s-paragraph>
            Your plan changes to {subscription.pendingPlanName}
            {subscription.currentPeriodEnd
              ? ` on ${formatDate(subscription.currentPeriodEnd)}`
              : " at the end of this billing cycle"}
            .
          </s-paragraph>
        ) : null}

        {usage.orderCap === null ? null : usage.overagePrice !== null ? (
          <s-text tone={usage.isOverCap ? "caution" : "neutral"}>
            {Math.min(usage.currentCount, usage.orderCap).toLocaleString()} /{" "}
            {usage.orderCap.toLocaleString()} included orders used this month
            {usage.overageCount > 0
              ? ` - plus ${usage.overageCount.toLocaleString()} extra order${usage.overageCount === 1 ? "" : "s"} at ${formatMoney(usage.overagePrice)} each (about ${formatMoney(usage.overageCount * usage.overagePrice)}), added to your Shopify bill.`
              : ""}
          </s-text>
        ) : (
          <s-text tone={usage.isOverCap ? "critical" : "neutral"}>
            {usage.currentCount} / {usage.orderCap} orders used this month
            {usage.isOverCap
              ? " - the survey has stopped showing on your Thank you page until you upgrade or next month starts."
              : ""}
          </s-text>
        )}

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
                  {tier.orderCap.toLocaleString()} orders/month included
                </s-text>
                {tier.overagePrice ? (
                  <s-text tone="neutral">
                    then {formatMoney(tier.overagePrice.amount)} per extra order
                  </s-text>
                ) : null}
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
          Included orders reset at the start of each calendar month. If you
          go over them, the survey keeps showing on your Thank you page and
          each extra order is charged at your plan&apos;s per-order rate on
          your regular Shopify bill. Upgrading lowers what you pay if
          you&apos;re regularly over.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
