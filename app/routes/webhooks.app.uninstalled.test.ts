import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { action } from "./webhooks.app.uninstalled";

vi.mock("../db.server", () => ({
  default: {
    session: { deleteMany: vi.fn() },
    shop: { updateMany: vi.fn() },
  },
}));

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

const mockDb = vi.mocked(db, true);
const mockWebhook = vi.mocked(authenticate.webhook);

const expectedReset = {
  where: { shopDomain: "shop.myshopify.com" },
  data: {
    subscriptionActive: false,
    subscriptionPlanHandle: null,
    subscriptionTrialEndsAt: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionCancelAtEndOfCycle: false,
    subscriptionPendingPlanHandle: null,
    subscriptionCheckedAt: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("app/uninstalled webhook", () => {
  it("deletes sessions and clears the cached subscription, so a reinstall must re-approve a plan", async () => {
    mockWebhook.mockResolvedValue({
      shop: "shop.myshopify.com",
      session: { id: "s1" },
      topic: "APP_UNINSTALLED",
    } as never);

    await action({ request: new Request("https://app.example.com") } as never);

    expect(mockDb.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: "shop.myshopify.com" },
    });
    expect(mockDb.shop.updateMany).toHaveBeenCalledWith(expectedReset);
  });

  it("still clears the cached subscription on a redelivery after sessions are gone", async () => {
    mockWebhook.mockResolvedValue({
      shop: "shop.myshopify.com",
      session: undefined,
      topic: "APP_UNINSTALLED",
    } as never);

    await action({ request: new Request("https://app.example.com") } as never);

    expect(mockDb.session.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.shop.updateMany).toHaveBeenCalledWith(expectedReset);
  });
});
