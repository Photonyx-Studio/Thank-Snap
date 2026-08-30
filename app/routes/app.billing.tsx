import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  STARTER_PLAN,
  STARTER_PLAN_FEATURES,
  STARTER_PLAN_PRICE,
  STARTER_PLAN_TRIAL_DAYS,
} from "../billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // isTest matches the flag used in app.tsx's billing.require() call - keep
  // them in sync so this page reflects the same subscription that's gating
  // access to the rest of the app.
  const { appSubscriptions } = await billing.check({
    plans: [STARTER_PLAN],
    isTest: true,
  });
  const subscription = appSubscriptions[0];

  let trialEndsOn: string | null = null;
  let isInTrial = false;
  if (subscription) {
    const trialEnd = new Date(
      new Date(subscription.createdAt).getTime() +
        subscription.trialDays * 24 * 60 * 60 * 1000,
    );
    isInTrial = trialEnd.getTime() > Date.now();
    trialEndsOn = trialEnd.toISOString();
  }

  return {
    price: STARTER_PLAN_PRICE,
    trialDays: STARTER_PLAN_TRIAL_DAYS,
    features: STARTER_PLAN_FEATURES,
    subscription: subscription
      ? {
          status: subscription.status,
          isTest: subscription.test,
          currentPeriodEnd: subscription.currentPeriodEnd,
          isInTrial,
          trialEndsOn,
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
  const { price, features, subscription } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Billing">
      <s-section heading="Starter plan">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={subscription ? "success" : "neutral"}>
            {subscription
              ? subscription.isInTrial
                ? "Free trial"
                : "Active"
              : "No active plan"}
          </s-badge>
          <s-heading>
            ${price.amount} / month
          </s-heading>
          {subscription?.isTest ? (
            <s-badge tone="warning">Test charge</s-badge>
          ) : null}
        </s-stack>

        {subscription?.isInTrial && subscription.trialEndsOn ? (
          <s-paragraph>
            You're in your free trial - it ends on{" "}
            {formatDate(subscription.trialEndsOn)}. You won't be charged
            until then.
          </s-paragraph>
        ) : subscription ? (
          <s-paragraph>
            Renews on {formatDate(subscription.currentPeriodEnd)}.
          </s-paragraph>
        ) : (
          <s-paragraph>
            You don't have an active subscription yet.
          </s-paragraph>
        )}

        <s-heading>What's included</s-heading>
        <s-unordered-list>
          {features.map((feature) => (
            <s-list-item key={feature}>{feature}</s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Managing your subscription">
        <s-paragraph>
          You can cancel or change your plan at any time from your Shopify
          admin's app billing settings.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
