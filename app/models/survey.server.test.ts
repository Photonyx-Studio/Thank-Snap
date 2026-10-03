import { beforeEach, describe, expect, it, vi } from "vitest";
import db from "../db.server";
import {
  DEFAULT_OPTIONS,
  DEFAULT_QUESTION_LABEL,
  DEFAULT_SURVEY_DESCRIPTION,
  DEFAULT_SURVEY_TITLE,
  getOrCreateSurvey,
  updateSurvey,
} from "./survey.server";

vi.mock("../db.server", () => ({
  default: {
    shop: { upsert: vi.fn() },
    survey: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    question: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreateSurvey", () => {
  it("creates a default survey and question for a brand-new shop", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue(null);
    mockDb.survey.create.mockResolvedValue({
      id: "survey_1",
      title: DEFAULT_SURVEY_TITLE,
      description: DEFAULT_SURVEY_DESCRIPTION,
      status: "ACTIVE",
    } as never);
    mockDb.question.findMany.mockResolvedValue([]);
    mockDb.question.create.mockResolvedValue({
      id: "q_1",
      label: DEFAULT_QUESTION_LABEL,
      type: "SINGLE_CHOICE",
      options: DEFAULT_OPTIONS,
      required: false,
    } as never);

    const result = await getOrCreateSurvey("shop.myshopify.com");

    expect(mockDb.survey.create).toHaveBeenCalledWith({
      data: {
        shopId: "shop_1",
        title: DEFAULT_SURVEY_TITLE,
        description: DEFAULT_SURVEY_DESCRIPTION,
        status: "ACTIVE",
      },
    });
    expect(mockDb.question.create).toHaveBeenCalledWith({
      data: {
        surveyId: "survey_1",
        label: DEFAULT_QUESTION_LABEL,
        type: "SINGLE_CHOICE",
        options: DEFAULT_OPTIONS,
        position: 0,
      },
    });
    expect(result).toEqual({
      survey: { title: DEFAULT_SURVEY_TITLE, description: DEFAULT_SURVEY_DESCRIPTION, active: true },
      questions: [
        { id: "q_1", label: DEFAULT_QUESTION_LABEL, type: "SINGLE_CHOICE", options: DEFAULT_OPTIONS, required: false },
      ],
    });
  });

  it("returns an existing survey/questions untouched", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({
      id: "survey_1",
      title: "Custom heading",
      description: "Custom desc",
      status: "DRAFT",
    } as never);
    mockDb.question.findMany.mockResolvedValue([
      { id: "q_1", label: "How did you hear about us?", type: "SINGLE_CHOICE", options: ["A", "B"], required: true },
    ] as never);

    const result = await getOrCreateSurvey("shop.myshopify.com");

    expect(mockDb.survey.create).not.toHaveBeenCalled();
    expect(mockDb.question.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      survey: { title: "Custom heading", description: "Custom desc", active: false },
      questions: [
        { id: "q_1", label: "How did you hear about us?", type: "SINGLE_CHOICE", options: ["A", "B"], required: true },
      ],
    });
  });

  it("self-heals the legacy single-question 'attribution' placeholder", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({
      id: "survey_1",
      title: "Old question text stored on the survey",
      description: null,
      status: "ACTIVE",
    } as never);
    mockDb.question.findMany.mockResolvedValue([
      { id: "q_1", label: "attribution", type: "SINGLE_CHOICE", options: [], required: false },
    ] as never);
    mockDb.survey.update.mockResolvedValue({
      id: "survey_1",
      title: DEFAULT_SURVEY_TITLE,
      description: DEFAULT_SURVEY_DESCRIPTION,
      status: "ACTIVE",
    } as never);
    mockDb.question.update.mockResolvedValue({
      id: "q_1",
      label: "Old question text stored on the survey",
      type: "SINGLE_CHOICE",
      options: [],
      required: false,
    } as never);

    const result = await getOrCreateSurvey("shop.myshopify.com");

    expect(mockDb.survey.update).toHaveBeenCalledWith({
      where: { id: "survey_1" },
      data: { title: DEFAULT_SURVEY_TITLE, description: DEFAULT_SURVEY_DESCRIPTION },
    });
    expect(mockDb.question.update).toHaveBeenCalledWith({
      where: { id: "q_1" },
      data: { label: "Old question text stored on the survey" },
    });
    expect(result.survey).toEqual({
      title: DEFAULT_SURVEY_TITLE,
      description: DEFAULT_SURVEY_DESCRIPTION,
      active: true,
    });
    expect(result.questions[0].label).toBe("Old question text stored on the survey");
  });
});

describe("updateSurvey", () => {
  it("no-ops when the shop has no survey yet", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue(null);

    await updateSurvey("shop.myshopify.com", {
      title: "T",
      description: "D",
      active: true,
      questions: [],
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("updates existing questions, creates new ones, deletes removed ones, and trims input", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({ id: "survey_1" } as never);
    mockDb.question.findMany.mockResolvedValue([
      { id: "q_keep" },
      { id: "q_remove" },
    ] as never);
    mockDb.survey.update.mockResolvedValue({} as never);
    mockDb.question.update.mockResolvedValue({} as never);
    mockDb.question.create.mockResolvedValue({} as never);
    mockDb.question.deleteMany.mockResolvedValue({ count: 1 } as never);
    mockDb.$transaction.mockImplementation(((ops: unknown[]) => Promise.all(ops)) as never);

    await updateSurvey("shop.myshopify.com", {
      title: "  My Title  ",
      description: "  desc  ",
      active: true,
      questions: [
        {
          id: "q_keep",
          label: "  Updated label  ",
          type: "SINGLE_CHOICE",
          options: [" A ", "", " B "],
          required: true,
        },
        { label: "", type: "TEXT", options: ["ignored"], required: false },
      ],
    });

    expect(mockDb.survey.update).toHaveBeenCalledWith({
      where: { id: "survey_1" },
      data: { title: "My Title", description: "desc", status: "ACTIVE" },
    });
    expect(mockDb.question.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["q_remove"] } } });
    expect(mockDb.question.update).toHaveBeenCalledWith({
      where: { id: "q_keep" },
      data: { label: "Updated label", type: "SINGLE_CHOICE", options: ["A", "B"], required: true, position: 0 },
    });
    // Blank label falls back to "Question <position + 1>"; non-choice types never persist options.
    expect(mockDb.question.create).toHaveBeenCalledWith({
      data: { label: "Question 2", type: "TEXT", options: [], required: false, position: 1, surveyId: "survey_1" },
    });
  });

  it("sets status to DRAFT when active is false", async () => {
    mockDb.shop.upsert.mockResolvedValue({ id: "shop_1" } as never);
    mockDb.survey.findFirst.mockResolvedValue({ id: "survey_1" } as never);
    mockDb.question.findMany.mockResolvedValue([]);
    mockDb.survey.update.mockResolvedValue({} as never);
    mockDb.$transaction.mockImplementation(((ops: unknown[]) => Promise.all(ops)) as never);

    await updateSurvey("shop.myshopify.com", {
      title: "T",
      description: "D",
      active: false,
      questions: [],
    });

    expect(mockDb.survey.update).toHaveBeenCalledWith({
      where: { id: "survey_1" },
      data: { title: "T", description: "D", status: "DRAFT" },
    });
  });
});
