import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { findShopBySessionToken } from "../models/shop.server";
import { toQuestionDTO } from "../models/survey.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);

  const shop = await findShopBySessionToken(sessionToken);
  if (!shop) {
    return cors(Response.json({ active: false }));
  }

  const survey = await db.survey.findFirst({ where: { shopId: shop.id } });
  if (!survey || survey.status !== "ACTIVE") {
    return cors(Response.json({ active: false }));
  }

  const questions = await db.question.findMany({
    where: { surveyId: survey.id },
    orderBy: { position: "asc" },
  });
  if (questions.length === 0) {
    return cors(Response.json({ active: false }));
  }

  return cors(
    Response.json({
      active: true,
      surveyId: survey.id,
      title: survey.title,
      description: survey.description,
      questions: questions.map(toQuestionDTO),
    }),
  );
};
