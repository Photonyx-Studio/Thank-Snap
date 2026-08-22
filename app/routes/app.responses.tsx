import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) {
    return { rows: [], page, hasNextPage: false, hasPreviousPage: false };
  }

  const [responses, totalCount] = await Promise.all([
    db.response.findMany({
      where: { survey: { shopId: shop.id } },
      include: { order: true, question: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.response.count({ where: { survey: { shopId: shop.id } } }),
  ]);

  return {
    rows: responses.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      orderLabel: r.order.orderNumber
        ? `#${r.order.orderNumber}`
        : r.order.shopifyOrderId.startsWith("pending:")
          ? "Pending"
          : r.order.shopifyOrderId,
      questionLabel: r.question.label,
      answer: r.answerText ?? "",
    })),
    page,
    hasNextPage: page * PAGE_SIZE < totalCount,
    hasPreviousPage: page > 1,
  };
};

export default function ResponsesPage() {
  const { rows, page, hasNextPage, hasPreviousPage } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Responses">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>

      <s-section heading="All responses">
        {rows.length === 0 ? (
          <s-paragraph>No responses yet.</s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Order</s-table-header>
              <s-table-header>Question</s-table-header>
              <s-table-header>Answer</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    {new Date(row.createdAt).toLocaleString()}
                  </s-table-cell>
                  <s-table-cell>{row.orderLabel}</s-table-cell>
                  <s-table-cell>{row.questionLabel}</s-table-cell>
                  <s-table-cell>{row.answer}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button
            variant="secondary"
            href={`/app/responses?page=${page - 1}`}
            disabled={!hasPreviousPage}
          >
            Previous
          </s-button>
          <s-text>Page {page}</s-text>
          <s-button
            variant="secondary"
            href={`/app/responses?page=${page + 1}`}
            disabled={!hasNextPage}
          >
            Next
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
