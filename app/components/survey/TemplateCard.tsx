import type { SurveyTemplate } from "../../models/survey-templates";

interface TemplateCardProps {
  template: SurveyTemplate;
  isSelected: boolean;
  onApply: () => void;
}

export function TemplateCard({ template, isSelected, onApply }: TemplateCardProps) {
  return (
    <s-box
      padding="large"
      border="base"
      borderRadius="base"
      background={isSelected ? "strong" : "subdued"}
    >
      <s-stack direction="block" gap="base">
        <s-stack
          direction="inline"
          gap="base"
          alignItems="center"
          justifyContent="space-between"
        >
          <s-text type="strong">
            {template.icon} {template.name}
          </s-text>
          {isSelected ? (
            <s-badge tone="success">Selected</s-badge>
          ) : (
            <s-badge tone="info">{template.options.length} options</s-badge>
          )}
        </s-stack>
        <s-text tone="neutral">&ldquo;{template.questionLabel}&rdquo;</s-text>
        <s-button
          variant={isSelected ? "secondary" : "primary"}
          inlineSize="fill"
          onClick={onApply}
        >
          {isSelected ? "Applied" : "Use this template"}
        </s-button>
      </s-stack>
    </s-box>
  );
}
