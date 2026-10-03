import db from "../db.server";
import type { FeedbackRow, FeedbackTypeValue } from "./feedbackTypes";

export interface FeedbackSubmission {
  type: FeedbackTypeValue;
  message: string;
  contactEmail: string;
}

export async function createFeedback(shopDomain: string, submission: FeedbackSubmission) {
  const shop = await db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  await db.feedback.create({
    data: {
      shopId: shop.id,
      type: submission.type,
      message: submission.message.trim(),
      contactEmail: submission.contactEmail.trim() || null,
    },
  });
}

export async function listFeedbackForShop(shopDomain: string): Promise<FeedbackRow[]> {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return [];

  const rows = await db.feedback.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
  }));
}
