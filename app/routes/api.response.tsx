import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findShopBySessionToken } from "../models/shop.server";
import db from "../db.server";

interface SurveyResponseBody {
  surveyId: string;
  answers: { questionId: string; answerValue: string }[];
  orderId?: string;
  orderNumber?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);

  const body = (await request.json()) as SurveyResponseBody;
  const { surveyId, answers, orderId, orderNumber } = body;

  if (!surveyId || !answers?.length) {
    return cors(
      Response.json(
        { error: "surveyId and at least one answer are required" },
        { status: 400 },
      ),
    );
  }

  const shop = await findShopBySessionToken(sessionToken);

  const survey = shop
    ? await db.survey.findFirst({ where: { id: surveyId, shopId: shop.id } })
    : null;

  if (!shop || !survey) {
    return cors(Response.json({ error: "Unknown survey" }, { status: 404 }));
  }

  const questions = await db.question.findMany({
    where: { surveyId: survey.id, id: { in: answers.map((a) => a.questionId) } },
  });
  const validQuestionIds = new Set(questions.map((q) => q.id));
  const validAnswers = answers.filter(
    (a) => validQuestionIds.has(a.questionId) && a.answerValue,
  );

  if (validAnswers.length === 0) {
    return cors(Response.json({ error: "No valid answers" }, { status: 400 }));
  }

  // The Thank you page is shown before the order is fully created, so orderId
  // may be absent. Fall back to a per-checkout-session placeholder so the
  // response can still be recorded and reconciled with the order later.
  const shopifyOrderId = orderId ?? `pending:${sessionToken.sid ?? crypto.randomUUID()}`;

  const order = await db.order.upsert({
    where: { shopId_shopifyOrderId: { shopId: shop.id, shopifyOrderId } },
    create: {
      shopId: shop.id,
      shopifyOrderId,
      orderNumber: orderNumber ?? null,
    },
    update: {},
  });

  const submissionId = crypto.randomUUID();
  await db.response.createMany({
    data: validAnswers.map((a) => ({
      submissionId,
      orderId: order.id,
      surveyId: survey.id,
      questionId: a.questionId,
      answerText: a.answerValue,
    })),
  });

  return cors(Response.json({ submissionId }, { status: 201 }));
};
