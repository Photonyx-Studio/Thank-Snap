interface SurveyDetailsSectionProps {
  active: boolean;
  onToggleActive: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}

/** Deliberately an s-box, not an s-section - see the comment in
 * TemplateGallery.tsx. s-section only gets its card/spacing styling as a
 * direct child of s-page; nested inside this page's <form> (needed for the
 * native save-bar/FormData flow), every s-section in sequence collapses
 * into one continuous card with no gap between them. s-box doesn't have
 * that dependency, so every section in this form uses it instead. */
export function SurveyDetailsSection({
  active,
  onToggleActive,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
}: SurveyDetailsSectionProps) {
  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="base">
        <s-heading>Thank you page survey</s-heading>

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
      </s-stack>
    </s-box>
  );
}
