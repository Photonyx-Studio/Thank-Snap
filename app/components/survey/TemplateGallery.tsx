import type { SurveyTemplate } from "../../models/survey-templates";
import { TemplateCard } from "./TemplateCard";

interface TemplateGalleryProps {
  templates: SurveyTemplate[];
  isTemplateSelected: (template: SurveyTemplate) => boolean;
  onApply: (template: SurveyTemplate) => void;
}

export function TemplateGallery({
  templates,
  isTemplateSelected,
  onApply,
}: TemplateGalleryProps) {
  return (
    <s-section heading="Start from a template">
      <s-paragraph>
        Don&apos;t want to write your own question? Pick a ready-made survey
        below — it replaces your current questions below, which you can
        still tweak, or just hit Save as-is.
      </s-paragraph>
      <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr, 1fr" gap="base">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={isTemplateSelected(template)}
              onApply={() => onApply(template)}
            />
          ))}
        </s-grid>
      </s-query-container>
    </s-section>
  );
}
