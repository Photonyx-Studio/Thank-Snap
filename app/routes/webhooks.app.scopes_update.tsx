import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    // `current` is normally always present on this topic, but a payload
    // shaped differently than expected shouldn't crash the handler - an
    // unhandled throw here is an immediate, permanently-failing webhook
    // (the payload never changes on retry).
    const current = payload.current;
    if (session && Array.isArray(current)) {
        await db.session.update({
            where: {
                id: session.id
            },
            data: {
                scope: current.join(","),
            },
        });
    }
    return new Response();
};
