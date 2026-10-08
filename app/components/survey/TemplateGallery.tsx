import { useState } from "react";
import type { SurveyTemplate } from "../../models/survey-templates";
import { TemplateCard } from "./TemplateCard";

interface TemplateGalleryProps {
  templates: SurveyTemplate[];
  isTemplateSelected: (template: SurveyTemplate) => boolean;
  onApply: (template: SurveyTemplate) => void;
}

/** Collapsed by default - most merchants land here to edit an already-
 * configured survey, not to browse templates, so this stays out of the way
 * until asked for instead of being the first wall of cards on the page. */
export function TemplateGallery({
  templates,
  isTemplateSelected,
  onApply,
}: TemplateGalleryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <s-section>
      <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
        <s-box>
          <s-heading>Start from a template</s-heading>
          <s-paragraph tone="neutral">
            Replace your current questions with a ready-made survey.
          </s-paragraph>
        </s-box>
        <s-button
          accessibilityLabel={expanded ? "Hide templates" : "Browse templates"}
          variant="tertiary"
          icon={expanded ? "chevron-up" : "chevron-down"}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Hide" : "Browse"}
        </s-button>
      </s-grid>

      <s-box paddingBlockStart="base" display={expanded ? "auto" : "none"}>
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
      </s-box>
    </s-section>
  );
}
