import { FEEDBACK_TYPE_LABELS, type FeedbackRow } from "../../models/feedbackTypes";

interface FeedbackHistoryProps {
  submissions: FeedbackRow[];
}

export function FeedbackHistory({ submissions }: FeedbackHistoryProps) {
  if (submissions.length === 0) {
    return (
      <s-paragraph tone="neutral">
        You haven&apos;t sent any feedback yet.
      </s-paragraph>
    );
  }

  return (
    <s-table variant="auto">
      <s-table-header-row>
        <s-table-header listSlot="primary">Date</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Message</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {submissions.map((submission) => (
          <s-table-row key={submission.id}>
            <s-table-cell>
              {new Date(submission.createdAt).toLocaleString()}
            </s-table-cell>
            <s-table-cell>{FEEDBACK_TYPE_LABELS[submission.type]}</s-table-cell>
            <s-table-cell>{submission.message}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
