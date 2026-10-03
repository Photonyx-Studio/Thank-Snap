import type { ResponseRow } from "../../models/response.server";

interface RecentResponsesListProps {
  rows: ResponseRow[];
}

export function RecentResponsesList({ rows }: RecentResponsesListProps) {
  if (rows.length === 0) {
    return <s-paragraph tone="neutral">No responses in this range yet.</s-paragraph>;
  }

  return (
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
            <s-table-cell>{new Date(row.createdAt).toLocaleString()}</s-table-cell>
            <s-table-cell>{row.orderLabel}</s-table-cell>
            <s-table-cell>{row.questionLabel}</s-table-cell>
            <s-table-cell>{row.answer}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
