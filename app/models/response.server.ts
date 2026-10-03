import db from "../db.server";

export interface ResponseRow {
  id: string;
  createdAt: string;
  orderLabel: string;
  questionLabel: string;
  answer: string;
}

interface ResponseWithRelations {
  id: string;
  createdAt: Date;
  answerText: string | null;
  order: { orderNumber: string | null; shopifyOrderId: string };
  question: { label: string };
}

function formatOrderLabel(order: {
  orderNumber: string | null;
  shopifyOrderId: string;
}): string {
  if (order.orderNumber) return `#${order.orderNumber}`;
  return order.shopifyOrderId.startsWith("pending:")
    ? "Pending"
    : order.shopifyOrderId;
}

/** Shared by the responses table and the dashboard's recent-responses list. */
export function toResponseRow(response: ResponseWithRelations): ResponseRow {
  return {
    id: response.id,
    createdAt: response.createdAt.toISOString(),
    orderLabel: formatOrderLabel(response.order),
    questionLabel: response.question.label,
    answer: response.answerText ?? "",
  };
}

export interface SubmissionExportRow {
  submissionId: string;
  createdAt: string;
  orderLabel: string;
  /** Keyed by the same (deduped) labels as `questionLabels`. */
  answers: Record<string, string>;
}

export interface SubmissionsExport {
  /** Column order: the shop's current questions, by position. */
  questionLabels: string[];
  rows: SubmissionExportRow[];
}

/**
 * Pivots this shop's Response rows (one row per question answer) into one
 * row per submission - what a merchant actually wants in a spreadsheet: one
 * order per row, one column per question. A question deleted from the
 * survey cascades to delete its Response rows too (see updateSurvey), so
 * there's never a surviving answer for a column that isn't in the current
 * survey - the column set here is exactly "questions with at least one
 * surviving answer," ordered by each question's current position.
 */
export async function getSubmissionsForExport(
  shopDomain: string,
): Promise<SubmissionsExport> {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return { questionLabels: [], rows: [] };

  const responses = await db.response.findMany({
    where: { survey: { shopId: shop.id } },
    include: { order: true, question: true },
    orderBy: { createdAt: "desc" },
  });

  // First-seen-by-position question, in column order. Labels are
  // disambiguated (rare, but two questions can share the same text) by
  // appending " (2)", " (3)", etc. to a later duplicate.
  const questionsSeen = new Map<string, { position: number; label: string }>();
  for (const r of responses) {
    if (!questionsSeen.has(r.questionId)) {
      questionsSeen.set(r.questionId, {
        position: r.question.position,
        label: r.question.label,
      });
    }
  }
  const orderedQuestionIds = [...questionsSeen.keys()].sort(
    (a, b) => questionsSeen.get(a)!.position - questionsSeen.get(b)!.position,
  );

  const labelByQuestionId = new Map<string, string>();
  const usedLabels = new Set<string>();
  for (const questionId of orderedQuestionIds) {
    const baseLabel = questionsSeen.get(questionId)!.label;
    let label = baseLabel;
    for (let suffix = 2; usedLabels.has(label); suffix++) {
      label = `${baseLabel} (${suffix})`;
    }
    usedLabels.add(label);
    labelByQuestionId.set(questionId, label);
  }
  const questionLabels = orderedQuestionIds.map(
    (id) => labelByQuestionId.get(id)!,
  );

  const bySubmission = new Map<string, SubmissionExportRow>();
  for (const r of responses) {
    let row = bySubmission.get(r.submissionId);
    if (!row) {
      row = {
        submissionId: r.submissionId,
        createdAt: r.createdAt.toISOString(),
        orderLabel: formatOrderLabel(r.order),
        answers: {},
      };
      bySubmission.set(r.submissionId, row);
    }
    row.answers[labelByQuestionId.get(r.questionId)!] = r.answerText ?? "";
  }

  return { questionLabels, rows: [...bySubmission.values()] };
}
