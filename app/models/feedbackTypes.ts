// Deliberately not *.server.ts: FeedbackForm.tsx/FeedbackHistory.tsx are
// plain components (not route modules), so they need these in the client
// bundle. Importing them from feedback.server.ts would drag its Prisma
// import along — see dateRange.ts for the same pattern.
export type FeedbackTypeValue = "BUG" | "FEATURE_REQUEST" | "OTHER";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackTypeValue, string> = {
  BUG: "Bug report",
  FEATURE_REQUEST: "Feature request",
  OTHER: "Other",
};

export interface FeedbackRow {
  id: string;
  type: FeedbackTypeValue;
  message: string;
  contactEmail: string | null;
  createdAt: string;
}
