interface SurveyDetailsSectionProps {
  active: boolean;
  onToggleActive: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}

export function SurveyDetailsSection({
  active,
  onToggleActive,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
}: SurveyDetailsSectionProps) {
  return (
    <s-section heading="Thank you page survey">
      <s-paragraph>
        Or build your own — add as many questions as you like, mixing
        question types.
      </s-paragraph>

      <s-switch
        label="Show survey on the Thank you page"
        checked={active}
        onChange={onToggleActive}
      ></s-switch>

      <s-text-field
        label="Survey heading"
        value={title}
        onChange={(e) => onTitleChange(e.currentTarget.value ?? "")}
      ></s-text-field>

      <s-text-area
        label="Survey description"
        value={description}
        rows={2}
        onChange={(e) => onDescriptionChange(e.currentTarget.value ?? "")}
      ></s-text-area>
    </s-section>
  );
}
