import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateSurvey } from "../models/survey.server";
import { getResponseStats } from "../models/stats.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [survey, stats] = await Promise.all([
    getOrCreateSurvey(session.shop),
    getResponseStats(session.shop),
  ]);
  return { ...survey, stats };
};

export default function Index() {
  const { survey, questions, stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="thank-snap">
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
            No one has seen the survey yet. This fills in once customers
            start reaching the Thank you page.
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
          through the &ldquo;thank-you-survey&rdquo; checkout extension. Their
          answers are saved and linked to the order.
        </s-paragraph>
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
