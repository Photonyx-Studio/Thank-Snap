// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SurveyTemplate } from "../../models/survey-templates";
import { useSurveyBuilder } from "./useSurveyBuilder";

const initial = {
  title: "Quick feedback",
  description: "We'd love your feedback.",
  active: true,
  questions: [
    { key: "q1", id: "q1", label: "How did you hear about us?", type: "SINGLE_CHOICE" as const, options: ["Google", "Friend"], required: false },
    { key: "q2", id: "q2", label: "Any comments?", type: "TEXT" as const, options: [], required: false },
  ],
};

function setup() {
  return renderHook(() => useSurveyBuilder(initial));
}

describe("useSurveyBuilder", () => {
  it("initializes from the given survey/questions", () => {
    const { result } = setup();
    expect(result.current.title).toBe(initial.title);
    expect(result.current.description).toBe(initial.description);
    expect(result.current.active).toBe(true);
    expect(result.current.questions).toEqual(initial.questions);
  });

  it("toggles active", () => {
    const { result } = setup();
    act(() => result.current.toggleActive());
    expect(result.current.active).toBe(false);
    act(() => result.current.toggleActive());
    expect(result.current.active).toBe(true);
  });

  it("updates a question by key without touching others", () => {
    const { result } = setup();
    act(() => result.current.updateQuestion("q1", { label: "Where did you find us?" }));
    expect(result.current.questions[0].label).toBe("Where did you find us?");
    expect(result.current.questions[1]).toEqual(initial.questions[1]);
  });

  it("adds a blank question", () => {
    const { result } = setup();
    act(() => result.current.addQuestion());
    expect(result.current.questions).toHaveLength(3);
    const added = result.current.questions[2];
    expect(added.label).toBe("");
    expect(added.type).toBe("SINGLE_CHOICE");
    expect(added.options).toEqual(["", ""]);
  });

  it("removes a question by key", () => {
    const { result } = setup();
    act(() => result.current.removeQuestion("q1"));
    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0].key).toBe("q2");
  });

  it("moves a question up/down and is a no-op past the boundary", () => {
    const { result } = setup();
    act(() => result.current.moveQuestion("q2", -1));
    expect(result.current.questions.map((q) => q.key)).toEqual(["q2", "q1"]);

    act(() => result.current.moveQuestion("q2", -1)); // already first, no-op
    expect(result.current.questions.map((q) => q.key)).toEqual(["q2", "q1"]);

    act(() => result.current.moveQuestion("q1", 1)); // already last, no-op
    expect(result.current.questions.map((q) => q.key)).toEqual(["q2", "q1"]);
  });

  it("adds, updates, and removes an option on the right question only", () => {
    const { result } = setup();

    act(() => result.current.addOption("q1"));
    expect(result.current.questions[0].options).toEqual(["Google", "Friend", ""]);
    expect(result.current.questions[1].options).toEqual([]);

    act(() => result.current.updateOption("q1", 2, "Instagram"));
    expect(result.current.questions[0].options).toEqual(["Google", "Friend", "Instagram"]);

    act(() => result.current.removeOption("q1", 0));
    expect(result.current.questions[0].options).toEqual(["Friend", "Instagram"]);
  });

  it("applies a template: replaces questions, sets description, forces active on", () => {
    const { result } = setup();
    act(() => result.current.toggleActive()); // start from inactive to prove it gets forced back on

    const template: SurveyTemplate = {
      id: "social-first",
      name: "Social-first",
      icon: "📱",
      description: "A social-focused survey",
      questionLabel: "Which platform brought you here?",
      options: ["Instagram", "TikTok", "Facebook"],
    };
    act(() => result.current.applyTemplate(template));

    expect(result.current.description).toBe(template.description);
    expect(result.current.active).toBe(true);
    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0]).toMatchObject({
      label: template.questionLabel,
      type: "SINGLE_CHOICE",
      options: template.options,
      required: false,
    });
  });

  it("serializes to a save payload without the UI-only 'key' field", () => {
    const { result } = setup();
    const payload = result.current.toPayload();

    expect(payload).toEqual({
      title: initial.title,
      description: initial.description,
      active: true,
      questions: [
        { id: "q1", label: "How did you hear about us?", type: "SINGLE_CHOICE", options: ["Google", "Friend"], required: false },
        { id: "q2", label: "Any comments?", type: "TEXT", options: [], required: false },
      ],
    });
    expect(payload.questions.some((q) => "key" in q)).toBe(false);
  });
});
