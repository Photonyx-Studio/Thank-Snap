import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSubmissionsForExport } from "../models/response.server";
import { toCsv } from "../utils/csv.server";

/**
 * Downloads all of this shop's survey responses as a CSV, one row per
 * order/submission and one column per question - see
 * getSubmissionsForExport for why that pivot is safe (a deleted question's
 * answers are gone too, so there's no stale column to worry about).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const { questionLabels, rows } = await getSubmissionsForExport(
    session.shop,
  );

  const headers = ["Date", "Order", ...questionLabels];
  const csvRows = rows.map((row) => [
    row.createdAt,
    row.orderLabel,
    ...questionLabels.map((label) => row.answers[label] ?? ""),
  ]);

  const filename = `thank-snap-responses-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(toCsv(headers, csvRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
