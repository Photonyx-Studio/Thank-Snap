import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

interface CustomersDataRequestPayload {
  orders_requested?: number[];
  customer?: { id: number; email?: string; phone?: string };
  data_request?: { id: number };
}

// Mandatory compliance webhook - required for every public app, regardless
// of whether it uses protected customer data. This app never stores a
// customer's name, email, or phone against survey responses (see
// models/stats.server.ts), so there's no personal data here to compile for
// the store owner - just acknowledge the request.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const { data_request } = payload as CustomersDataRequestPayload;

  console.log(
    `Received ${topic} webhook for ${shop}: data request ${data_request?.id} - no customer-identifying data is stored by this app`,
  );

  return new Response();
};
