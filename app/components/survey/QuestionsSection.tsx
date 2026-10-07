import { useState } from "react";
import { QuestionEditor } from "./QuestionEditor";
import type { QuestionDraft } from "./types";

interface QuestionsSectionProps {
  questions: QuestionDraft[];
  onAdd: () => void;
  onChange: (key: string, patch: Partial<QuestionDraft>) => void;
  onRemove: (key: string) => void;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
  onAddOption: (key: string) => void;
  onUpdateOption: (key: string, index: number, value: string) => void;
  onRemoveOption: (key: string, index: number) => void;
}

export function QuestionsSection({
  questions,
  onAdd,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: QuestionsSectionProps) {
  // Collapsed by default once a question has real content, so a survey with
  // several configured questions reads as a scannable list instead of a wall
  // of open forms - explicitly toggled state (after the merchant opens or
  // closes one) always wins over that default.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  function isExpanded(question: QuestionDraft): boolean {
    return toggled[question.key] ?? question.label.trim() === "";
  }

  function toggleExpanded(question: QuestionDraft) {
    setToggled((prev) => ({ ...prev, [question.key]: !isExpanded(question) }));
  }

  return (
    <s-section heading="Questions">
      <s-stack direction="block" gap="base">
        {questions.map((question, qIndex) => (
          <QuestionEditor
            key={question.key}
            question={question}
            index={qIndex}
            isFirst={qIndex === 0}
            isLast={qIndex === questions.length - 1}
            expanded={isExpanded(question)}
            onToggleExpanded={() => toggleExpanded(question)}
            onChange={(patch) => onChange(question.key, patch)}
            onRemove={() => onRemove(question.key)}
            onMoveUp={() => onMoveUp(question.key)}
            onMoveDown={() => onMoveDown(question.key)}
            onAddOption={() => onAddOption(question.key)}
            onUpdateOption={(oIndex, value) =>
              onUpdateOption(question.key, oIndex, value)
            }
            onRemoveOption={(oIndex) => onRemoveOption(question.key, oIndex)}
          />
        ))}
        <s-button variant="secondary" icon="plus" onClick={onAdd}>
          Add question
        </s-button>
      </s-stack>
    </s-section>
  );
}
