import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  APP_URL,
  QuestionField,
  Survey,
  fetchSurveyConfig,
  recordSurveyView,
  submitSurveyResponse,
  useStorageState,
} from "./shared";
import type { AnswerValue, SurveyConfig } from "./types";

export default function () {
  render(<Attribution />, document.body);
}

function Attribution() {
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [configError, setConfigError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Store into local storage if the survey was completed by the customer,
  // so it doesn't resurface on a page refresh.
  const [surveySubmitted, setSurveySubmitted] = useStorageState<boolean>(
    "thank-you-survey-submitted",
  );

  useEffect(() => {
    if (APP_URL.includes("example.com")) return;
    fetchSurveyConfig()
      .then(setConfig)
      .catch((err) => {
        console.error("Failed to load survey config", err);
        setConfigError(err);
      });
  }, []);

  useEffect(() => {
    if (!config?.active) return;
    const orderId = shopify.orderConfirmation.value?.order?.id;
    if (!orderId) return;
    recordSurveyView({
      surveyId: config.surveyId,
      orderId,
      orderNumber: shopify.orderConfirmation.value?.number,
    }).catch((err) => console.error("Failed to record survey view", err));
  }, [config]);

  if (APP_URL.includes("example.com")) {
    return (
      <s-banner tone="warning" heading="thank-you-survey">
        Set APP_URL in extensions/thank-you-survey/src/shared.tsx to your
        app&apos;s URL before this survey can load.
      </s-banner>
    );
  }

  // Hides the survey while loading, on fetch failure, when the merchant has
  // turned it off, or once the buyer has already submitted it.
  if (
    configError ||
    !config?.active ||
    surveySubmitted.loading ||
    surveySubmitted.data === true
  ) {
    return null;
  }

  const requiredUnanswered = config.questions.some(
    (q) => q.required && !answers[q.id],
  );

  async function handleSubmit() {
    if (!config?.active) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const order = shopify.orderConfirmation.value;
      const answerList = config.questions
        .filter((q) => answers[q.id] !== undefined && answers[q.id] !== "")
        .map((q) => {
          const value = answers[q.id];
          return {
            questionId: q.id,
            answerValue: Array.isArray(value) ? value.join(", ") : value,
          };
        });

      if (answerList.length === 0) {
        setSubmitError("Please answer at least one question.");
        throw new Error("No answers provided");
      }

      await submitSurveyResponse({
        surveyId: config.surveyId,
        answers: answerList,
        orderId: order?.order?.id,
        orderNumber: order?.number,
      });
      setSurveySubmitted(true);
    } catch (err) {
      console.error("Failed to submit survey response", err);
      setSubmitError((current) => current ?? "Something went wrong. Please try again.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Survey
      title={config.title}
      description={config.description}
      onSubmit={handleSubmit}
      loading={loading}
      disabled={requiredUnanswered}
    >
      <s-stack gap="base">
        {config.questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) =>
              setAnswers((prev) => ({ ...prev, [question.id]: value }))
            }
          />
        ))}
      </s-stack>
      {submitError ? <s-text tone="critical">{submitError}</s-text> : null}
    </Survey>
  );
}
