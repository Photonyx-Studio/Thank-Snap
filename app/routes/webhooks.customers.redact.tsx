import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

interface CustomersRedactPayload {
  orders_to_redact?: number[];
}

// Mandatory compliance webhook - required for every public app. Deletes any
// Order (and, via cascade, its Response rows) tied to one of the redacted
// customer's orders.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const { orders_to_redact } = payload as CustomersRedactPayload;

  console.log(`Received ${topic} webhook for ${shop}`);

  if (orders_to_redact?.length) {
    const dbShop = await db.shop.findUnique({ where: { shopDomain: shop } });

    if (dbShop) {
      // shopifyOrderId is stored as the order GID the checkout extension
      // reads from shopify.orderConfirmation (e.g. "gid://shopify/Order/299938"),
      // while this payload carries the legacy numeric order ID - compare the
      // numeric suffix for an exact match, not endsWith: a substring match
      // would also hit an unrelated order whose id happens to end in the
      // same digits (e.g. GID .../1299938 vs redacted id 299938).
      const orders = await db.order.findMany({
        where: { shopId: dbShop.id },
        select: { id: true, shopifyOrderId: true },
      });
      const redactedIds = new Set(orders_to_redact.map(String));
      const idsToDelete = orders
        .filter((order) =>
          redactedIds.has(order.shopifyOrderId.split("/").pop() ?? ""),
        )
        .map((order) => order.id);

      if (idsToDelete.length > 0) {
        await db.order.deleteMany({ where: { id: { in: idsToDelete } } });
      }
    }
  }

  return new Response();
};
