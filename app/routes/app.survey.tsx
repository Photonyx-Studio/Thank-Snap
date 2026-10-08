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

const SAVE_BAR_ID = "survey-save-bar";

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

  // The save bar's automatic `data-save-bar` detection only picks up native
  // input/change events on individual fields - it has no way to notice a
  // question being added, removed, reordered, or replaced by a template
  // (none of those are a single field's value changing), and a hidden-input
  // bridge meant to paper over that turned out not to reliably trigger it
  // either (confirmed: applying a template never showed a save bar at all).
  // This builder has several of exactly those "custom dirty state"
  // mutations, so it uses the save bar's other documented pattern instead -
  // a <ui-save-bar> driven explicitly by comparing the current payload
  // against the one last loaded/saved.
  const lastSavedPayloadRef = useRef(JSON.stringify(builder.toPayload()));
  const currentPayload = JSON.stringify(builder.toPayload());
  const isDirty = currentPayload !== lastSavedPayloadRef.current;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show(SAVE_BAR_ID);
    } else {
      shopify.saveBar.hide(SAVE_BAR_ID);
    }
  }, [isDirty, shopify]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      lastSavedPayloadRef.current = currentPayload;
      shopify.toast.show("Survey saved");
    }
    // currentPayload is intentionally excluded - this should only react to
    // a save actually completing (fetcher.data changing), not recompute its
    // "last saved" meaning on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleDiscard() {
    builder.reset();
  }

  return (
    <s-page heading="Customize survey">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>

      <ui-save-bar id={SAVE_BAR_ID} discardConfirmation>
        <button variant="primary" onClick={handleSave}>
          Save
        </button>
        <button onClick={handleDiscard}>Discard</button>
      </ui-save-bar>

      <s-stack direction="block" gap="base">
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
      </s-stack>

      <AboutSurveyAside />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
