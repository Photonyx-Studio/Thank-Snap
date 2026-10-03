import { FEEDBACK_TYPE_LABELS, type FeedbackTypeValue } from "../../models/feedbackTypes";

interface FeedbackFormProps {
  type: FeedbackTypeValue;
  onTypeChange: (value: FeedbackTypeValue) => void;
  message: string;
  onMessageChange: (value: string) => void;
  contactEmail: string;
  onContactEmailChange: (value: string) => void;
  onSubmit: () => void;
  isSaving: boolean;
}

export function FeedbackForm({
  type,
  onTypeChange,
  message,
  onMessageChange,
  contactEmail,
  onContactEmailChange,
  onSubmit,
  isSaving,
}: FeedbackFormProps) {
  return (
    <s-stack direction="block" gap="base">
      <s-select
        label="What kind of feedback is this?"
        value={type}
        onChange={(e) => onTypeChange(e.currentTarget.value as FeedbackTypeValue)}
      >
        {Object.entries(FEEDBACK_TYPE_LABELS).map(([value, label]) => (
          <s-option key={value} value={value}>
            {label}
          </s-option>
        ))}
      </s-select>

      <s-text-area
        label="Tell us what's going on"
        placeholder="A bug you ran into, or a feature you wish this app had..."
        rows={5}
        value={message}
        onChange={(e) => onMessageChange(e.currentTarget.value ?? "")}
      ></s-text-area>

      <s-email-field
        label="Your email (optional)"
        placeholder="you@example.com"
        value={contactEmail}
        onChange={(e) => onContactEmailChange(e.currentTarget.value ?? "")}
      ></s-email-field>

      <s-button
        variant="primary"
        onClick={onSubmit}
        disabled={message.trim().length === 0}
        {...(isSaving ? { loading: true } : {})}
      >
        Send feedback
      </s-button>
    </s-stack>
  );
}
