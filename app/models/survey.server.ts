import db from "../db.server";
import { SURVEY_TEMPLATES } from "./survey-templates";

export const DEFAULT_SURVEY_TITLE = "Quick feedback";
export const DEFAULT_SURVEY_DESCRIPTION =
  "We'd love your feedback after your purchase.";

// The default question a survey is created with matches the first premade
// template, so there's one place ("Classic attribution" in
// survey-templates.ts) that defines that content instead of two.
const [defaultTemplate] = SURVEY_TEMPLATES;
export const DEFAULT_QUESTION_LABEL = defaultTemplate.questionLabel;
export const DEFAULT_OPTIONS = defaultTemplate.options;

export type QuestionTypeValue =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TEXT"
  | "RATING";

export interface QuestionDTO {
  id: string;
  label: string;
  type: QuestionTypeValue;
  options: string[];
  required: boolean;
}

export interface QuestionPayload {
  id?: string;
  label: string;
  type: QuestionTypeValue;
  options: string[];
  required: boolean;
}

export interface SurveyPayload {
  title: string;
  description: string;
  active: boolean;
  questions: QuestionPayload[];
}

export function toQuestionDTO(question: {
  id: string;
  label: string;
  type: string;
  options: unknown;
  required: boolean;
}): QuestionDTO {
  return {
    id: question.id,
    label: question.label,
    type: question.type as QuestionTypeValue,
    options: Array.isArray(question.options) ? (question.options as string[]) : [],
    required: question.required,
  };
}

export async function getOrCreateSurvey(shopDomain: string) {
  const shop = await db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  let survey = await db.survey.findFirst({ where: { shopId: shop.id } });
  if (!survey) {
    survey = await db.survey.create({
      data: {
        shopId: shop.id,
        title: DEFAULT_SURVEY_TITLE,
        description: DEFAULT_SURVEY_DESCRIPTION,
        status: "ACTIVE",
      },
    });
  }

  let questions = await db.question.findMany({
    where: { surveyId: survey.id },
    orderBy: { position: "asc" },
  });

  if (questions.length === 0) {
    const created = await db.question.create({
      data: {
        surveyId: survey.id,
        label: DEFAULT_QUESTION_LABEL,
        type: "SINGLE_CHOICE",
        options: DEFAULT_OPTIONS,
        position: 0,
      },
    });
    questions = [created];
  } else if (questions.length === 1 && questions[0].label === "attribution") {
    // One-time backfill: earlier versions of this app stored the question
    // text on Survey.title and used a placeholder "attribution" label on the
    // single Question row. Move the real text onto the question and give the
    // survey a generic heading, matching the current multi-question model.
    const [placeholder] = questions;
    const [updatedSurvey, updatedQuestion] = await Promise.all([
      db.survey.update({
        where: { id: survey.id },
        data: { title: DEFAULT_SURVEY_TITLE, description: DEFAULT_SURVEY_DESCRIPTION },
      }),
      db.question.update({
        where: { id: placeholder.id },
        data: { label: survey.title },
      }),
    ]);
    survey = updatedSurvey;
    questions = [updatedQuestion];
  }

  return {
    survey: {
      title: survey.title,
      description: survey.description ?? "",
      active: survey.status === "ACTIVE",
    },
    questions: questions.map(toQuestionDTO),
  };
}

export async function updateSurvey(shopDomain: string, payload: SurveyPayload) {
  const shop = await db.shop.upsert({
    where: { shopDomain },
    create: { shopDomain },
    update: {},
  });

  const survey = await db.survey.findFirst({ where: { shopId: shop.id } });
  if (!survey) return;

  const title = payload.title.trim() || DEFAULT_SURVEY_TITLE;
  const description = payload.description.trim();
  const status = payload.active ? "ACTIVE" : "DRAFT";

  const existing = await db.question.findMany({ where: { surveyId: survey.id } });
  const existingIds = new Set(existing.map((q) => q.id));
  const incomingIds = new Set(
    payload.questions.filter((q) => q.id).map((q) => q.id as string),
  );

  const toDeleteIds = existing
    .filter((q) => !incomingIds.has(q.id))
    .map((q) => q.id);

  await db.$transaction([
    db.survey.update({ where: { id: survey.id }, data: { title, description, status } }),
    ...(toDeleteIds.length
      ? [db.question.deleteMany({ where: { id: { in: toDeleteIds } } })]
      : []),
    ...payload.questions.map((q, index) => {
      const label = q.label.trim() || `Question ${index + 1}`;
      const isChoiceType = q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE";
      const options = isChoiceType
        ? q.options.map((o) => o.trim()).filter(Boolean)
        : [];
      const data = {
        label,
        type: q.type,
        options,
        required: q.required,
        position: index,
      };
      return q.id && existingIds.has(q.id)
        ? db.question.update({ where: { id: q.id }, data })
        : db.question.create({ data: { ...data, surveyId: survey.id } });
    }),
  ]);
}
