import type { QuestionDraft } from "./types";

const RATING_VALUES = ["1", "2", "3", "4", "5"];

// Mirrors updateSurvey's fallbacks (DEFAULT_SURVEY_TITLE, "Question N") so
// the preview shows what will actually be saved - duplicated rather than
// imported because survey.server.ts is server-only.
const FALLBACK_TITLE = "Quick feedback";

interface SurveyPreviewProps {
  title: string;
  description: string;
  active: boolean;
  questions: QuestionDraft[];
}

/**
 * Live preview of the Thank you page survey, updated as the merchant edits
 * (Built for Shopify 4.2.6). Rendered in the page's aside column so it sits
 * beside the editor on desktop. Mirrors the checkout extension's layout
 * (extensions/thank-you-survey/src/shared.tsx: Survey + QuestionField) using
 * the admin's equivalent components - the buyer's real styling comes from
 * the store's checkout branding, so this is a guide to content and order,
 * not a pixel-exact render.
 */
export function SurveyPreview({ title, description, active, questions }: SurveyPreviewProps) {
  return (
    <s-section slot="aside" heading="Preview">
      <s-stack direction="block" gap="base">
        {active ? null : (
          <s-text tone="neutral">
            The survey is off, so buyers won&apos;t see it until you turn it
            on.
          </s-text>
        )}
        <s-box border="base" padding="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-heading>{title.trim() || FALLBACK_TITLE}</s-heading>
            {description.trim() ? <s-text>{description.trim()}</s-text> : null}
            {questions.length === 0 ? (
              <s-text tone="neutral">Add a question to see it here.</s-text>
            ) : (
              questions.map((question, index) => (
                <PreviewQuestion key={question.key} question={question} index={index} />
              ))
            )}
            <s-button variant="secondary" disabled>
              Submit feedback
            </s-button>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}

function PreviewQuestion({ question, index }: { question: QuestionDraft; index: number }) {
  const label = question.label.trim() || `Question ${index + 1}`;
  const name = `preview-${question.key}`;

  if (question.type === "TEXT") {
    return <s-text-field label={label} name={name}></s-text-field>;
  }

  const options =
    question.type === "RATING"
      ? RATING_VALUES
      : question.options.map((option) => option.trim()).filter(Boolean);

  return (
    <s-choice-list
      label={label}
      name={name}
      multiple={question.type === "MULTIPLE_CHOICE"}
    >
      {options.map((option) => (
        <s-choice key={option} value={option}>
          {option}
        </s-choice>
      ))}
    </s-choice-list>
  );
}
