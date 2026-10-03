import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getDashboardData } from "../models/dashboard.server";
import { resolveDateRange } from "../models/dateRange";
import { DateRangeFilter } from "../components/dashboard/DateRangeFilter";
import { StatTiles } from "../components/dashboard/StatTiles";
import { TopChannelHighlight } from "../components/dashboard/TopChannelHighlight";
import { AttributionBreakdownChart } from "../components/dashboard/AttributionBreakdownChart";
import { ResponsesTrendChart } from "../components/dashboard/ResponsesTrendChart";
import { RecentResponsesList } from "../components/dashboard/RecentResponsesList";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const range = resolveDateRange(url.searchParams.get("range"));
  const data = await getDashboardData(session.shop, range);
  return { range: range.key, ...data };
};

export default function DashboardPage() {
  const { range, stats, attributionQuestionLabel, breakdown, topChannel, trend, recentResponses } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Dashboard">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>

      <s-section heading="Overview">
        <DateRangeFilter value={range} />
        <StatTiles
          responseRate={stats.responseRate}
          surveysShown={stats.surveysShown}
          surveysAnswered={stats.surveysAnswered}
        />
      </s-section>

      <s-section heading="Attribution breakdown">
        {attributionQuestionLabel ? (
          <s-paragraph tone="neutral">{attributionQuestionLabel}</s-paragraph>
        ) : (
          <s-paragraph tone="neutral">
            Add a single- or multiple-choice question to your survey to see a
            channel breakdown here.
          </s-paragraph>
        )}
        <AttributionBreakdownChart breakdown={breakdown} />
      </s-section>

      <s-section heading="Responses over time">
        <ResponsesTrendChart trend={trend} />
      </s-section>

      <s-section heading="Recent responses">
        <RecentResponsesList rows={recentResponses} />
        <s-button href="/app/responses" variant="secondary">
          View all responses
        </s-button>
      </s-section>

      <s-section slot="aside" heading="Top channel">
        <TopChannelHighlight topChannel={topChannel} />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
