import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { shopDomainFromSessionToken } from "../models/shop.server";
import { toQuestionDTO } from "../models/survey.server";
import { getUsageStatusFromShop } from "../subscription.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);

  // One query (shop -> its active survey -> its questions) instead of three
  // sequential round trips - this fires on every Thank you page load and
  // gates whether the survey renders at all, so it's this app's most
  // latency-sensitive endpoint for Shopify's checkout performance score.
  const shop = await db.shop.findUnique({
    where: { shopDomain: shopDomainFromSessionToken(sessionToken) },
    include: {
      surveys: {
        where: { status: "ACTIVE" },
        take: 1,
        include: { questions: { orderBy: { position: "asc" } } },
      },
    },
  });

  const survey = shop?.surveys[0];
  if (!survey || survey.questions.length === 0) {
    return cors(Response.json({ active: false }));
  }

  // Stop showing the survey once the shop is past its plan's included
  // monthly orders - an unrecognized/missing plan handle fails open (see
  // getUsageStatusFromShop), so this only ever blocks a shop we're
  // confident has actually hit its cap.
  const usage = await getUsageStatusFromShop(shop);
  if (usage.isOverCap) {
    return cors(Response.json({ active: false }));
  }

  return cors(
    Response.json({
      active: true,
      surveyId: survey.id,
      title: survey.title,
      description: survey.description,
      questions: survey.questions.map(toQuestionDTO),
    }),
  );
};
