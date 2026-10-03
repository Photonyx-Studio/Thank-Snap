import db from "../db.server";

// Pinged on a schedule (see .github/workflows/keep-warm.yml) to keep the
// Vercel function and Prisma/DB connection warm, so merchants opening the
// app from the Shopify admin don't hit a cold start.
export const loader = async () => {
  await db.$queryRaw`SELECT 1`;
  return new Response("ok", { status: 200 });
};
