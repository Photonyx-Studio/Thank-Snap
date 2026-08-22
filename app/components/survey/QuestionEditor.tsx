import type { QuestionTypeValue } from "../../models/survey.server";
import { OptionRow } from "./OptionRow";
import { QUESTION_TYPE_LABELS, type QuestionDraft } from "./types";

interface QuestionEditorProps {
  question: QuestionDraft;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddOption: () => void;
  onUpdateOption: (index: number, value: string) => void;
  onRemoveOption: (index: number) => void;
}

export function QuestionEditor({
  question,
  index,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: QuestionEditorProps) {
  const showOptions =
    question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE";

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-text type="strong">Question {index + 1}</s-text>
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              variant="tertiary"
              accessibilityLabel="Move question up"
              disabled={isFirst}
              onClick={onMoveUp}
            >
              ↑
            </s-button>
            <s-button
              variant="tertiary"
              accessibilityLabel="Move question down"
              disabled={isLast}
              onClick={onMoveDown}
            >
              ↓
            </s-button>
            <s-button variant="tertiary" tone="critical" onClick={onRemove}>
              Remove
            </s-button>
          </s-stack>
        </s-stack>

        <s-select
          label="Question type"
          value={question.type}
          onChange={(e) =>
            onChange({ type: e.currentTarget.value as QuestionTypeValue })
          }
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <s-option key={value} value={value}>
              {label}
            </s-option>
          ))}
        </s-select>

        <s-text-field
          label="Question text"
          value={question.label}
          onChange={(e) => onChange({ label: e.currentTarget.value ?? "" })}
        ></s-text-field>

        <s-checkbox
          label="Required"
          checked={question.required}
          onChange={() => onChange({ required: !question.required })}
        ></s-checkbox>

        {showOptions && (
          <s-stack direction="block" gap="base">
            <s-text>Answer options</s-text>
            {question.options.map((option, oIndex) => (
              <OptionRow
                key={oIndex}
                label={`Option ${oIndex + 1}`}
                value={option}
                onChange={(value) => onUpdateOption(oIndex, value)}
                onRemove={() => onRemoveOption(oIndex)}
              />
            ))}
            <s-button variant="secondary" onClick={onAddOption}>
              Add option
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
