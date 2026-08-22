import { useEffect, useState } from "react";
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
import { SURVEY_TEMPLATES, type SurveyTemplate } from "../models/survey-templates";
import { QuestionEditor } from "../components/survey/QuestionEditor";
import { TemplateCard } from "../components/survey/TemplateCard";
import { blankQuestion, makeQuestionKey, type QuestionDraft } from "../components/survey/types";

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
  const { survey, questions: initialQuestions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description);
  const [active, setActive] = useState(survey.active);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions.map((q) => ({ ...q, key: q.id })),
  );

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Survey saved");
    }
  }, [fetcher.data, shopify]);

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function moveQuestion(key: string, direction: -1 | 1) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateOption(key: string, index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) }
          : q,
      ),
    );
  }

  function addOption(key: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, options: [...q.options, ""] } : q)),
    );
  }

  function removeOption(key: string, index: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.filter((_, i) => i !== index) }
          : q,
      ),
    );
  }

  function applyTemplate(template: SurveyTemplate) {
    setDescription(template.description);
    setQuestions([
      {
        key: makeQuestionKey(),
        label: template.questionLabel,
        type: "SINGLE_CHOICE",
        options: template.options,
        required: false,
      },
    ]);
    setActive(true);
    shopify.toast.show(`"${template.name}" applied — click Save to publish`);
  }

  function handleSave() {
    fetcher.submit(
      {
        payload: JSON.stringify({
          title,
          description,
          active,
          questions: questions.map(({ id, label, type, options, required }) => ({
            id,
            label,
            type,
            options,
            required,
          })),
        }),
      },
      { method: "POST" },
    );
  }

  return (
    <s-page heading="Customize survey">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Start from a template">
        <s-paragraph>
          Don&apos;t want to write your own question? Pick a ready-made
          survey below — it replaces your current questions below, which you
          can still tweak, or just hit Save as-is.
        </s-paragraph>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          {SURVEY_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={
                questions.length === 1 &&
                questions[0].label === template.questionLabel
              }
              onApply={() => applyTemplate(template)}
            />
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Thank you page survey">
        <s-paragraph>
          Or build your own — add as many questions as you like, mixing
          question types.
        </s-paragraph>

        <s-switch
          label="Show survey on the Thank you page"
          checked={active}
          onChange={() => setActive((a) => !a)}
        ></s-switch>

        <s-text-field
          label="Survey heading"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value ?? "")}
        ></s-text-field>

        <s-text-area
          label="Survey description"
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.currentTarget.value ?? "")}
        ></s-text-area>
      </s-section>

      <s-section heading="Questions">
        <s-stack direction="block" gap="base">
          {questions.map((question, qIndex) => (
            <QuestionEditor
              key={question.key}
              question={question}
              index={qIndex}
              isFirst={qIndex === 0}
              isLast={qIndex === questions.length - 1}
              onChange={(patch) => updateQuestion(question.key, patch)}
              onRemove={() => removeQuestion(question.key)}
              onMoveUp={() => moveQuestion(question.key, -1)}
              onMoveDown={() => moveQuestion(question.key, 1)}
              onAddOption={() => addOption(question.key)}
              onUpdateOption={(oIndex, value) => updateOption(question.key, oIndex, value)}
              onRemoveOption={(oIndex) => removeOption(question.key, oIndex)}
            />
          ))}
          <s-button variant="secondary" onClick={addQuestion}>
            Add question
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="About this survey">
        <s-paragraph>
          This survey renders on the Thank you page through the
          &ldquo;thank-you-survey&rdquo; checkout extension. Turn it off above
          to hide it without removing the extension block from the checkout
          editor.
        </s-paragraph>
        <s-paragraph>
          Removing a question also removes any responses already collected
          for it.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
