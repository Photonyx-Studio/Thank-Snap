import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateSurvey } from "../models/survey.server";
import { getResponseStats } from "../models/stats.server";
import { getUsageStatus } from "../subscription.server";

// Nudge merchants toward upgrading before they actually hit the wall.
const USAGE_WARNING_THRESHOLD = 0.8;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [survey, stats, usage] = await Promise.all([
    getOrCreateSurvey(session.shop),
    getResponseStats(session.shop),
    getUsageStatus(session.shop),
  ]);
  return { ...survey, stats, usage };
};

export default function Index() {
  const { survey, questions, stats, usage } = useLoaderData<typeof loader>();
  const usageRatio =
    usage.orderCap !== null ? usage.currentCount / usage.orderCap : 0;
  // Nobody has ever seen the survey - most likely because it hasn't been
  // added to the checkout editor yet (installing the app never does this
  // automatically), rather than the store simply having no traffic.
  const likelyNotAddedToCheckout = stats.surveysShown === 0;

  return (
    <s-page heading="thank-snap">
      {likelyNotAddedToCheckout ? (
        <s-banner heading="One more step: add the survey to your Thank you page" tone="warning">
          <s-paragraph>
            Installing the app doesn&apos;t place the survey automatically.
            Open checkout settings, click <strong>Customize checkout</strong>,
            then switch the page selector at the top of that editor to{" "}
            <strong>Thank you page</strong> and add the thank-snap block
            there — not the checkout steps, which is a different page in
            the same editor.
          </s-paragraph>
          <s-link href="shopify:admin/settings/checkout">
            Open checkout settings
          </s-link>
        </s-banner>
      ) : null}

      {/* Two-stage warning: a critical banner once the survey has actually
          stopped (isOverCap), a softer one as it approaches the limit
          (USAGE_WARNING_THRESHOLD) so merchants can upgrade before it does. */}
      {usage.isOverCap ? (
        <s-banner heading="You've reached your plan's order limit" tone="critical">
          <s-paragraph>
            {usage.currentCount} / {usage.orderCap} orders this month - the
            survey has stopped showing on your Thank you page until you
            upgrade or next month starts.
          </s-paragraph>
          <s-link href="/app/billing">Upgrade your plan</s-link>
        </s-banner>
      ) : usage.orderCap !== null && usageRatio >= USAGE_WARNING_THRESHOLD ? (
        <s-banner heading="Approaching your plan's order limit" tone="warning">
          <s-paragraph>
            {usage.currentCount} / {usage.orderCap} orders this month.
            Upgrade before you hit the limit to keep the survey running
            without interruption.
          </s-paragraph>
          <s-link href="/app/billing">View plans</s-link>
        </s-banner>
      ) : null}

      <s-section heading="Thank you page survey">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={survey.active ? "success" : "neutral"}>
            {survey.active ? "Active" : "Off"}
          </s-badge>
          <s-text>{survey.title}</s-text>
        </s-stack>
        <s-paragraph>
          {questions.length} question{questions.length === 1 ? "" : "s"}
          {survey.description ? ` — ${survey.description}` : ""}
        </s-paragraph>
        <s-button href="/app/survey">Customize survey</s-button>
      </s-section>

      <s-section heading="Response rate">
        {stats.surveysShown === 0 ? (
          <s-paragraph>
            No one has seen the survey yet. If you haven&apos;t already, go
            to Settings → Checkout → Customize checkout, switch to the{" "}
            <strong>Thank you page</strong> template in that editor, and add
            the survey block there — it won&apos;t show to customers until
            you do.
          </s-paragraph>
        ) : (
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>{stats.responseRate}%</s-heading>
            <s-text tone="neutral">
              {stats.surveysAnswered} of {stats.surveysShown} customers who
              saw the survey answered it
            </s-text>
          </s-stack>
        )}
        <s-button href="/app/responses" variant="secondary">
          View responses
        </s-button>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-paragraph>
          Customers see this survey on the Thank you page after checkout,
          through the &ldquo;thank-you-survey&rdquo; checkout extension — but
          only once you&apos;ve added it there yourself, specifically on the{" "}
          <strong>Thank you page</strong> template (the checkout editor also
          covers the checkout steps themselves, which is a separate page in
          the same editor and not where this block goes). Their answers are
          saved and linked to the order.
        </s-paragraph>
        <s-link href="shopify:admin/settings/checkout">
          Open checkout settings
        </s-link>
        <s-paragraph>
          Response rate is measured against customers who actually saw the
          survey, not every order in the store — tracking all orders would
          need extra Shopify permissions that require approval for accessing
          customer data.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
