const APP_EVENTS_API_VERSION = "2026-07";
const TOKEN_URL = "https://api.shopify.com/auth/access_token";
const EVENTS_URL = `https://api.shopify.com/app/${APP_EVENTS_API_VERSION}/events`;
// Shopify rejects requests without one with a 403 ("You do not have
// permission to access this website").
const USER_AGENT = "thank-snap";

// Tokens last 60 minutes - refresh a few minutes early so one never expires
// mid-request.
const TOKEN_TTL_MS = 55 * 60 * 1000;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be set to send App Events",
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) {
    throw new Error(`App Events token request failed: ${response.status}`);
  }

  const { access_token } = (await response.json()) as { access_token: string };
  cachedToken = { value: access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return access_token;
}

export interface BillingEvent {
  /** gid://shopify/Shop/<id> */
  shopGid: string;
  /** Must match a usage meter's handle in the Partner Dashboard. */
  eventHandle: string;
  /**
   * Max 64 chars. Shopify dedupes billing events on this permanently, so a
   * retry with the same key can never double-charge - and a genuinely new
   * charge must never reuse one.
   */
  idempotencyKey: string;
  /** Units to add to the meter (negative reverses earlier usage). */
  value: number;
}

/**
 * Reports one usage event to the App Events API, which Shopify App Pricing
 * turns into a charge on the merchant's Shopify invoice. Throws on any
 * non-2xx response.
 *
 * A 202 only means Shopify received it - billing validation (e.g. a meter
 * handle that doesn't exist on the shop's plan) happens asynchronously and
 * failures only show in the Dev Dashboard's logs (App Billing Event filter).
 */
export async function sendBillingEvent(event: BillingEvent): Promise<void> {
  const send = async () =>
    fetch(EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify({
        shop_id: event.shopGid,
        event_handle: event.eventHandle,
        timestamp: new Date().toISOString(),
        idempotency_key: event.idempotencyKey,
        attributes: { value: event.value },
      }),
    });

  let response = await send();

  // A revoked/rotated token - drop it and retry once with a fresh one.
  if (response.status === 401) {
    cachedToken = null;
    response = await send();
  }

  if (!response.ok) {
    throw new Error(
      `App Events request failed: ${response.status} ${await response.text()}`,
    );
  }
}

/** Test-only: forget the cached access token. */
export function resetAppEventsTokenCache() {
  cachedToken = null;
}
