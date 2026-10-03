import { useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateSurvey, updateSurvey } from "../models/survey.server";
import {
  SURVEY_TEMPLATES,
  type SurveyTemplate,
} from "../models/survey-templates";
import { useSurveyBuilder } from "../components/survey/useSurveyBuilder";
import { TemplateGallery } from "../components/survey/TemplateGallery";
import { SurveyDetailsSection } from "../components/survey/SurveyDetailsSection";
import { QuestionsSection } from "../components/survey/QuestionsSection";
import { AboutSurveyAside } from "../components/survey/AboutSurveyAside";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getOrCreateSurvey(session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const payload = JSON.parse(String(formData.get("payload")));

  await updateSurvey(session.shop, payload);

  return { ok: true };
};

export default function SurveyPage() {
  const { survey, questions: initialQuestions } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const builder = useSurveyBuilder({
    title: survey.title,
    description: survey.description,
    active: survey.active,
    questions: initialQuestions.map((q) => ({ ...q, key: q.id })),
  });

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Survey saved");
    }
  }, [fetcher.data, shopify]);

  function handleApplyTemplate(template: SurveyTemplate) {
    builder.applyTemplate(template);
    shopify.toast.show(`"${template.name}" applied — click Save to publish`);
  }

  function handleSave() {
    fetcher.submit(
      { payload: JSON.stringify(builder.toPayload()) },
      { method: "POST" },
    );
  }

  // The contextual save bar (data-save-bar) only auto-detects changes on the
  // native input/change events of individual form fields - it has no way to
  // notice a question being added, removed, reordered, or replaced by a
  // template, since none of those are a single field's value changing. This
  // hidden input bridges those React-state-only changes into a native
  // "input" event so the save bar still shows up for them, following
  // Shopify's own documented pattern for React-controlled save bar forms.
  const payloadSignature = JSON.stringify(builder.toPayload());
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = signatureInputRef.current;
    if (!input || input.value === payloadSignature) return;
    input.value = payloadSignature;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, [payloadSignature]);

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSave();
  }

  return (
    <s-page heading="Customize survey">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>

      <form data-save-bar data-discard-confirmation onSubmit={handleFormSubmit} onReset={builder.reset}>
        <input ref={signatureInputRef} type="hidden" name="surveyPayloadSignature" defaultValue="" />

        <TemplateGallery
          templates={SURVEY_TEMPLATES}
          isTemplateSelected={(template) =>
            builder.questions.length === 1 &&
            builder.questions[0].label === template.questionLabel
          }
          onApply={handleApplyTemplate}
        />

        <SurveyDetailsSection
          active={builder.active}
          onToggleActive={builder.toggleActive}
          title={builder.title}
          onTitleChange={builder.setTitle}
          description={builder.description}
          onDescriptionChange={builder.setDescription}
        />

        <QuestionsSection
          questions={builder.questions}
          onAdd={builder.addQuestion}
          onChange={builder.updateQuestion}
          onRemove={builder.removeQuestion}
          onMoveUp={(key) => builder.moveQuestion(key, -1)}
          onMoveDown={(key) => builder.moveQuestion(key, 1)}
          onAddOption={builder.addOption}
          onUpdateOption={builder.updateOption}
          onRemoveOption={builder.removeOption}
        />
      </form>

      <AboutSurveyAside />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
