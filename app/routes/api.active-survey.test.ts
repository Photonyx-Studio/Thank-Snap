import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { loader } from "./api.active-survey";

vi.mock("../db.server", () => ({
  default: {
    shop: { findUnique: vi.fn(), update: vi.fn() },
    order: { count: vi.fn() },
  },
}));

vi.mock("../shopify.server", () => ({
  authenticate: { public: { checkout: vi.fn() } },
}));

const mockDb = vi.mocked(db, true);
const mockAuthenticate = vi.mocked(authenticate.public.checkout);

// Identity CORS wrapper — the real one attaches Access-Control headers, which
// don't matter for asserting the JSON payload/status these tests check.
const cors = (response: Response) => response;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticate.mockResolvedValue({
    sessionToken: { dest: "https://shop.myshopify.com" },
    cors,
  } as never);
});

function makeRequest() {
  return new Request("https://app.example.com/api/active-survey");
}

describe("GET /api/active-survey", () => {
  it("reports inactive for a shop that's never opened the admin app", async () => {
    mockDb.shop.findUnique.mockResolvedValue(null);

    const response = await loader({ request: makeRequest() } as never);

    expect(await response.json()).toEqual({ active: false });
  });

  it("reports inactive when the shop has no active survey", async () => {
    mockDb.shop.findUnique.mockResolvedValue({ id: "shop_1", surveys: [] } as never);

    const response = await loader({ request: makeRequest() } as never);

    expect(await response.json()).toEqual({ active: false });
  });

  it("reports inactive when the active survey has no questions", async () => {
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      surveys: [{ id: "survey_1", status: "ACTIVE", questions: [] }],
    } as never);

    const response = await loader({ request: makeRequest() } as never);

    expect(await response.json()).toEqual({ active: false });
  });

  it("returns the active survey and its questions", async () => {
    mockDb.order.count.mockResolvedValue(0 as never);
    mockDb.shop.update.mockResolvedValue({} as never);
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      subscriptionPlanHandle: null,
      usagePeriodStart: null,
      usagePeriodOrderCount: 0,
      usageCheckedAt: null,
      surveys: [
        {
          id: "survey_1",
          status: "ACTIVE",
          title: "Quick feedback",
          description: "We'd love your feedback.",
          questions: [
            {
              id: "q_1",
              label: "How did you hear about us?",
              type: "SINGLE_CHOICE",
              options: ["Google", "Friend"],
              required: true,
            },
          ],
        },
      ],
    } as never);

    const response = await loader({ request: makeRequest() } as never);

    expect(await response.json()).toEqual({
      active: true,
      surveyId: "survey_1",
      title: "Quick feedback",
      description: "We'd love your feedback.",
      questions: [
        { id: "q_1", label: "How did you hear about us?", type: "SINGLE_CHOICE", options: ["Google", "Friend"], required: true },
      ],
    });
  });

  it("reports inactive once the shop is past its plan's order cap, even with a valid survey", async () => {
    mockDb.order.count.mockResolvedValue(1000 as never); // tier-2's cap
    mockDb.shop.update.mockResolvedValue({} as never);
    mockDb.shop.findUnique.mockResolvedValue({
      id: "shop_1",
      subscriptionPlanHandle: "tier-2",
      usagePeriodStart: null,
      usagePeriodOrderCount: 0,
      usageCheckedAt: null,
      surveys: [
        {
          id: "survey_1",
          status: "ACTIVE",
          title: "Quick feedback",
          description: "",
          questions: [
            {
              id: "q_1",
              label: "How did you hear about us?",
              type: "SINGLE_CHOICE",
              options: ["Google", "Friend"],
              required: true,
            },
          ],
        },
      ],
    } as never);

    const response = await loader({ request: makeRequest() } as never);

    expect(await response.json()).toEqual({ active: false });
  });
});
