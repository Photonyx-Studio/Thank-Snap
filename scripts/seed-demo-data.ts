/**
 * Populates ONE shop's Survey/Order/Response (and a few Feedback) rows with
 * realistic fake data, purely so the Dashboard/Responses/Feedback pages have
 * something to show for App Store listing screenshots.
 *
 * Deliberately NOT a route, NOT imported by anything under app/ - this never
 * ships in the build, never runs as part of the app, and only ever touches
 * the one shop domain you pass it (upsert/delete are always scoped to that
 * shop's id, never to other shops' rows).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-data.ts <shop-domain> [--reset] [--dry-run]
 *
 *   <shop-domain>  required, e.g. thanksnap-demo.myshopify.com
 *   --reset        delete this shop's existing Survey/Order/Response rows
 *                  first, so re-running doesn't pile up duplicates
 *   --dry-run      print what would be created/deleted, write nothing
 *
 * To remove the fake data later: re-run with --reset --dry-run false... or
 * just `--reset` alone, which deletes and recreates. To remove it with
 * nothing left behind, delete the Survey this script created (cascades its
 * Questions + Responses) and the Orders it created (cascades their
 * Responses) - both are printed at the end of a real run, or just delete
 * the Shop row entirely if this shop has nothing else of value.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ATTRIBUTION_QUESTION = "How did you hear about us?";
const ATTRIBUTION_OPTIONS: { label: string; weight: number }[] = [
  { label: "Instagram", weight: 35 },
  { label: "Google search", weight: 25 },
  { label: "Friend or family", weight: 20 },
  { label: "Email newsletter", weight: 12 },
  { label: "TikTok", weight: 8 },
];

const SATISFACTION_QUESTION = "How likely are you to shop with us again?";
const SATISFACTION_OPTIONS: { label: string; weight: number }[] = [
  { label: "Very likely", weight: 48 },
  { label: "Likely", weight: 30 },
  { label: "Neutral", weight: 14 },
  { label: "Unlikely", weight: 6 },
  { label: "Very unlikely", weight: 2 },
];

const FEEDBACK_SAMPLES: { type: "BUG" | "FEATURE_REQUEST" | "OTHER"; message: string; contactEmail: string | null }[] = [
  {
    type: "FEATURE_REQUEST",
    message: "Would love the ability to export responses straight to Google Sheets instead of CSV.",
    contactEmail: "merchant@example.com",
  },
  {
    type: "OTHER",
    message: "Just wanted to say the setup was really smooth - took under 5 minutes to get the survey live.",
    contactEmail: null,
  },
];

const DAYS_OF_HISTORY = 75;
const ORDERS_PER_DAY_MIN = 2;
const ORDERS_PER_DAY_MAX = 9;
const RESPONSE_RATE = 0.68; // fraction of orders that get a submission
const SECOND_QUESTION_COMPLETION_RATE = 0.8; // of those who respond, how many also answer Q2

function weightedPick<T extends { label: string; weight: number }>(options: T[]): string {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.label;
  }
  return options[options.length - 1].label;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

async function main() {
  const args = process.argv.slice(2);
  const shopDomain = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const reset = args.includes("--reset");

  if (!shopDomain) {
    console.error("Usage: npx tsx scripts/seed-demo-data.ts <shop-domain> [--reset] [--dry-run]");
    process.exit(1);
  }
  if (!shopDomain.endsWith(".myshopify.com")) {
    console.error(`Refusing to run against "${shopDomain}" - expected a *.myshopify.com domain.`);
    process.exit(1);
  }

  console.log(`Target shop: ${shopDomain}${dryRun ? " (dry run - nothing will be written)" : ""}`);

  const shop = await prisma.shop.findUnique({ where: { shopDomain } });

  if (reset) {
    if (!shop) {
      console.log("No existing Shop row for this domain - nothing to reset.");
    } else {
      const orderCount = await prisma.order.count({ where: { shopId: shop.id } });
      const surveyCount = await prisma.survey.count({ where: { shopId: shop.id } });
      console.log(`--reset: would delete ${orderCount} orders and ${surveyCount} survey(s) (cascades their questions/responses).`);
      if (!dryRun) {
        await prisma.order.deleteMany({ where: { shopId: shop.id } });
        await prisma.survey.deleteMany({ where: { shopId: shop.id } });
        console.log("Deleted.");
      }
    }
  }

  if (dryRun) {
    const totalOrders = Math.round(((ORDERS_PER_DAY_MIN + ORDERS_PER_DAY_MAX) / 2) * DAYS_OF_HISTORY);
    console.log(`Would create ~1 survey (2 questions), ~${totalOrders} orders, ~${Math.round(totalOrders * RESPONSE_RATE)} of them with responses, and ${FEEDBACK_SAMPLES.length} feedback submissions.`);
    await prisma.$disconnect();
    return;
  }

  const dbShop = await prisma.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  const survey = await prisma.survey.create({
    data: {
      shopId: dbShop.id,
      title: "Post-purchase survey",
      description: "Help us understand where our customers come from.",
      status: "ACTIVE",
      questions: {
        create: [
          {
            label: ATTRIBUTION_QUESTION,
            type: "SINGLE_CHOICE",
            options: ATTRIBUTION_OPTIONS.map((o) => o.label),
            position: 0,
            required: true,
          },
          {
            label: SATISFACTION_QUESTION,
            type: "SINGLE_CHOICE",
            options: SATISFACTION_OPTIONS.map((o) => o.label),
            position: 1,
            required: false,
          },
        ],
      },
    },
    include: { questions: true },
  });

  const attributionQuestion = survey.questions.find((q) => q.label === ATTRIBUTION_QUESTION)!;
  const satisfactionQuestion = survey.questions.find((q) => q.label === SATISFACTION_QUESTION)!;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let orderSeq = randomInt(10000, 20000);
  let ordersCreated = 0;
  let responsesCreated = 0;

  for (let dayOffset = DAYS_OF_HISTORY; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);

    // A gentle upward trend toward "today" so the chart reads as a growing
    // store, rather than flat/random noise.
    const growthFactor = 0.6 + 0.4 * (1 - dayOffset / DAYS_OF_HISTORY);
    const ordersToday = Math.max(1, Math.round(randomInt(ORDERS_PER_DAY_MIN, ORDERS_PER_DAY_MAX) * growthFactor));

    for (let i = 0; i < ordersToday; i++) {
      const createdAt = new Date(day);
      createdAt.setHours(randomInt(8, 21), randomInt(0, 59), randomInt(0, 59), 0);

      orderSeq += 1;
      const order = await prisma.order.create({
        data: {
          shopId: dbShop.id,
          shopifyOrderId: `gid://shopify/Order/${orderSeq}`,
          orderNumber: String(orderSeq),
          totalPrice: randomInt(1800, 18000) / 100,
          currency: "USD",
          orderCreatedAt: createdAt,
          createdAt,
        },
      });
      ordersCreated += 1;

      if (Math.random() < RESPONSE_RATE) {
        const submissionId = `demo-${order.id}`;
        const responseCreatedAt = new Date(createdAt.getTime() + randomInt(5, 90) * 60_000);

        await prisma.response.create({
          data: {
            submissionId,
            orderId: order.id,
            surveyId: survey.id,
            questionId: attributionQuestion.id,
            answerText: weightedPick(ATTRIBUTION_OPTIONS),
            createdAt: responseCreatedAt,
          },
        });
        responsesCreated += 1;

        if (Math.random() < SECOND_QUESTION_COMPLETION_RATE) {
          await prisma.response.create({
            data: {
              submissionId,
              orderId: order.id,
              surveyId: survey.id,
              questionId: satisfactionQuestion.id,
              answerText: weightedPick(SATISFACTION_OPTIONS),
              createdAt: responseCreatedAt,
            },
          });
          responsesCreated += 1;
        }
      }
    }
  }

  for (const feedback of FEEDBACK_SAMPLES) {
    await prisma.feedback.create({
      data: {
        shopId: dbShop.id,
        type: feedback.type,
        message: feedback.message,
        contactEmail: feedback.contactEmail,
      },
    });
  }

  console.log(`Done. Created survey ${survey.id}, ${ordersCreated} orders, ${responsesCreated} responses, ${FEEDBACK_SAMPLES.length} feedback submissions.`);
  console.log(`To remove: npx tsx scripts/seed-demo-data.ts ${shopDomain} --reset`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
