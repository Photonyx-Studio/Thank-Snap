import type { QuestionTypeValue } from "../../models/survey.server";

/** A question as edited in the builder UI, before it's saved. */
export interface QuestionDraft {
  key: string;
  id?: string;
  label: string;
  type: QuestionTypeValue;
  options: string[];
  required: boolean;
}

export const QUESTION_TYPE_LABELS: Record<QuestionTypeValue, string> = {
  SINGLE_CHOICE: "Single choice",
  MULTIPLE_CHOICE: "Multiple choice",
  TEXT: "Short text",
  RATING: "Rating (1-5)",
};

export function makeQuestionKey(): string {
  return Math.random().toString(36).slice(2);
}

export function blankQuestion(): QuestionDraft {
  return {
    key: makeQuestionKey(),
    label: "",
    type: "SINGLE_CHOICE",
    options: ["", ""],
    required: false,
  };
}
