import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppEventsTokenCache, sendBillingEvent } from "./app-events.server";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const event = {
  shopGid: "gid://shopify/Shop/5678",
  eventHandle: "extra_order",
  idempotencyKey: "order-abc",
  value: 1,
};

beforeEach(() => {
  fetchMock.mockReset();
  resetAppEventsTokenCache();
  vi.stubEnv("SHOPIFY_API_KEY", "client-id");
  vi.stubEnv("SHOPIFY_API_SECRET", "client-secret");
});

const tokenResponse = (token: string) =>
  Response.json({ access_token: token, token_type: "Bearer" });

describe("sendBillingEvent", () => {
  it("gets a client-credentials token, then posts the event with it", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok_1"))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    await sendBillingEvent(event);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://api.shopify.com/auth/access_token");
    expect(JSON.parse(tokenInit.body)).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      grant_type: "client_credentials",
    });

    const [eventUrl, eventInit] = fetchMock.mock.calls[1];
    expect(eventUrl).toBe("https://api.shopify.com/app/2026-07/events");
    expect(eventInit.headers.Authorization).toBe("Bearer tok_1");
    expect(eventInit.headers["User-Agent"]).toBeTruthy();
    expect(JSON.parse(eventInit.body)).toMatchObject({
      shop_id: "gid://shopify/Shop/5678",
      event_handle: "extra_order",
      idempotency_key: "order-abc",
      attributes: { value: 1 },
    });
  });

  it("reuses the cached token across events", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok_1"))
      .mockResolvedValue(new Response(null, { status: 202 }));

    await sendBillingEvent(event);
    await sendBillingEvent({ ...event, idempotencyKey: "order-def" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes the token once on a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok_old"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(tokenResponse("tok_new"))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    await sendBillingEvent(event);

    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer tok_new");
  });

  it("throws on a rejected event", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok_1"))
      .mockResolvedValueOnce(new Response('{"success":false}', { status: 403 }));

    await expect(sendBillingEvent(event)).rejects.toThrow("403");
  });
});
