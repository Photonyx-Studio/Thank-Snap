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
        <s-button variant="secondary" onClick={onAdd}>
          Add question
        </s-button>
      </s-stack>
    </s-section>
  );
}
