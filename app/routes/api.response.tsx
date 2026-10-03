import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { shopDomainFromSessionToken } from "../models/shop.server";
import db from "../db.server";

// This route only ever receives POST requests from the extension, but a
// browser's CORS preflight for that POST arrives as an OPTIONS request —
// and without a loader present, that OPTIONS request never reaches
// authenticate.public.checkout()'s built-in preflight handling (it throws a
// 204 + CORS-headers Response when request.method === "OPTIONS"), so the
// browser's preflight check fails before the real POST is ever attempted.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.checkout(request);
  return new Response(null, { status: 405 });
};

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

  // One query (shop -> matching survey -> matching questions) instead of
  // three sequential round trips - this fires on every survey submission,
  // so it counts toward Shopify's checkout performance score.
  const shop = await db.shop.findUnique({
    where: { shopDomain: shopDomainFromSessionToken(sessionToken) },
    include: {
      surveys: {
        where: { id: surveyId },
        take: 1,
        include: {
          questions: { where: { id: { in: answers.map((a) => a.questionId) } } },
        },
      },
    },
  });
  const survey = shop?.surveys[0];

  if (!shop || !survey) {
    return cors(Response.json({ error: "Unknown survey" }, { status: 404 }));
  }

  const validQuestionIds = new Set(survey.questions.map((q) => q.id));
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
