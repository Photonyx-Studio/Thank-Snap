import { useState } from "react";
import type { SurveyTemplate } from "../../models/survey-templates";
import { blankQuestion, makeQuestionKey, type QuestionDraft } from "./types";

interface SurveyBuilderInit {
  title: string;
  description: string;
  active: boolean;
  questions: QuestionDraft[];
}

/** All state and mutations for the survey builder page — kept independent
 * of App Bridge/routing so it stays reusable and easy to reason about. */
export function useSurveyBuilder(initial: SurveyBuilderInit) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [active, setActive] = useState(initial.active);
  const [questions, setQuestions] = useState<QuestionDraft[]>(initial.questions);

  function toggleActive() {
    setActive((a) => !a);
  }

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function moveQuestion(key: string, direction: -1 | 1) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateOption(key: string, index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) }
          : q,
      ),
    );
  }

  function addOption(key: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, options: [...q.options, ""] } : q)),
    );
  }

  function removeOption(key: string, index: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.filter((_, i) => i !== index) }
          : q,
      ),
    );
  }

  function reset() {
    setTitle(initial.title);
    setDescription(initial.description);
    setActive(initial.active);
    setQuestions(initial.questions);
  }

  function applyTemplate(template: SurveyTemplate) {
    setDescription(template.description);
    setQuestions([
      {
        key: makeQuestionKey(),
        label: template.questionLabel,
        type: "SINGLE_CHOICE",
        options: template.options,
        required: false,
      },
    ]);
    setActive(true);
  }

  function toPayload() {
    return {
      title,
      description,
      active,
      questions: questions.map(({ id, label, type, options, required }) => ({
        id,
        label,
        type,
        options,
        required,
      })),
    };
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    active,
    toggleActive,
    questions,
    updateQuestion,
    removeQuestion,
    addQuestion,
    moveQuestion,
    updateOption,
    addOption,
    removeOption,
    applyTemplate,
    toPayload,
    reset,
  };
}
