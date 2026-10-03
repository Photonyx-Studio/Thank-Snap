import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory compliance webhook - required for every public app. Shopify
// sends this 48 hours after uninstall, so it's safe to erase the shop's
// data immediately. Survey/Question/Order/Response/Feedback all key off
// Shop with onDelete: Cascade, so deleting the Shop row is enough.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await db.shop.deleteMany({ where: { shopDomain: shop } });

  return new Response();
};
