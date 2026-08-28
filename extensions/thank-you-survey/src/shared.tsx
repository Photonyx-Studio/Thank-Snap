/* eslint-disable react/prop-types -- internal components, no runtime prop validation needed */
import "@shopify/ui-extensions/preact";
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type {
  AnswerValue,
  Question,
  RecordSurveyViewParams,
  SubmitSurveyResponseParams,
  SurveyConfig,
} from "./types";

/**
 * Narrows a change event's `currentTarget` to the real custom element type
 * (e.g. `s-text-field`, `s-choice-list`), matching the package's own
 * `CallbackEvent` pattern. Plain `Event` typing leaves `currentTarget` as a
 * bare `EventTarget` with no `.value`/`.values`.
 */
type FieldChangeEvent<Tag extends keyof HTMLElementTagNameMap> = Event & {
  currentTarget: HTMLElementTagNameMap[Tag];
};

// Your app's URL, used to send survey responses to the backend. Pointed at
// the permanent production deployment rather than a local dev tunnel — the
// extension can be previewed via `npm run dev` (bypasses the checkout
// editor/app-version requirements) while still talking to the real,
// always-on backend, so this no longer needs updating every dev session.
export const APP_URL = "https://app.thanksnap.com";

interface StorageState<T> {
  data: T | undefined;
  loading: boolean;
}

/**
 * Returns a piece of state that is persisted in local storage, and a function to update it.
 */
export function useStorageState<T>(key: string): [StorageState<T>, (value: T) => void] {
  const { storage } = shopify;
  const [data, setData] = useState<T | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function queryStorage() {
      const value = await storage.read<T>(key);
      setData(value ?? undefined);
      setLoading(false);
    }
    queryStorage();
  }, [setData, setLoading, storage, key]);

  const setStorage = useCallback(
    (value: T) => {
      storage.write(key, value);
    },
    [storage, key],
  );

  return [{ data, loading }, setStorage];
}

/**
 * Fetches the merchant's configured survey for this shop, authenticated with
 * a checkout session token. Returns `{ active: false }` if there's no active
 * survey to show.
 */
export async function fetchSurveyConfig(): Promise<SurveyConfig> {
  const token = await shopify.sessionToken.get();
  const response = await fetch(`${APP_URL}/api/active-survey`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Survey config fetch failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Sends a survey response (one or more answers) to the app backend,
 * authenticated with a checkout session token so the server can verify the
 * request came from Shopify.
 */
export async function submitSurveyResponse(
  params: SubmitSurveyResponseParams,
): Promise<{ submissionId: string }> {
  const token = await shopify.sessionToken.get();
  const response = await fetch(`${APP_URL}/api/response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Survey submission failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Records that the survey was shown to this buyer, regardless of whether
 * they answer it — this is what the admin dashboard's response-rate widget
 * is measured against. Fire-and-forget: failures here shouldn't block the
 * survey from rendering.
 */
export async function recordSurveyView(params: RecordSurveyViewParams): Promise<void> {
  const token = await shopify.sessionToken.get();
  await fetch(`${APP_URL}/api/survey-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
}

const RATING_VALUES = ["1", "2", "3", "4", "5"];

interface QuestionFieldProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

/**
 * Renders the right input control for a question's type. `s-choice-list`
 * always takes a `values` array, even in single-select mode.
 */
export function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  if (question.type === "TEXT") {
    return (
      <s-text-field
        label={question.label}
        value={typeof value === "string" ? value : ""}
        onChange={(event: FieldChangeEvent<"s-text-field">) =>
          onChange(event.currentTarget.value ?? "")
        }
      ></s-text-field>
    );
  }

  if (question.type === "RATING") {
    const selected = typeof value === "string" ? value : undefined;
    return (
      <s-choice-list
        label={question.label}
        name={question.id}
        values={selected ? [selected] : []}
        onChange={(event: FieldChangeEvent<"s-choice-list">) =>
          onChange(event.currentTarget.values[0])
        }
      >
        {RATING_VALUES.map((n) => (
          <s-choice key={n} value={n}>
            {n}
          </s-choice>
        ))}
      </s-choice-list>
    );
  }

  if (question.type === "MULTIPLE_CHOICE") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <s-choice-list
        label={question.label}
        name={question.id}
        multiple
        values={selected}
        onChange={(event: FieldChangeEvent<"s-choice-list">) =>
          onChange(event.currentTarget.values)
        }
      >
        {question.options.map((option) => (
          <s-choice key={option} value={option}>
            {option}
          </s-choice>
        ))}
      </s-choice-list>
    );
  }

  // SINGLE_CHOICE
  const selected = typeof value === "string" ? value : undefined;
  return (
    <s-choice-list
      label={question.label}
      name={question.id}
      values={selected ? [selected] : []}
      onChange={(event: FieldChangeEvent<"s-choice-list">) =>
        onChange(event.currentTarget.values[0])
      }
    >
      {question.options.map((option) => (
        <s-choice key={option} value={option}>
          {option}
        </s-choice>
      ))}
    </s-choice-list>
  );
}

interface SurveyProps {
  title: string;
  description: string;
  onSubmit: () => Promise<void>;
  children: ComponentChildren;
  loading: boolean;
  disabled: boolean;
}

export function Survey({ title, description, onSubmit, children, loading, disabled }: SurveyProps) {
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    try {
      await onSubmit();
      setSubmitted(true);
    } catch {
      // onSubmit is responsible for surfacing its own error message; a
      // thrown/rejected onSubmit just means "don't mark this submitted".
    }
  }

  if (submitted) {
    return (
      <s-box border="base" padding="base" borderRadius="base">
        <s-stack gap="base">
          <s-heading>Thanks for your feedback!</s-heading>
          <s-text>Your response has been submitted</s-text>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box border="base" padding="base" borderRadius="base">
      <s-stack gap="base">
        <s-heading>{title}</s-heading>
        <s-text>{description}</s-text>
        {children}
        <s-button
          variant="secondary"
          onClick={handleSubmit}
          loading={loading}
          disabled={disabled}
        >
          Submit feedback
        </s-button>
      </s-stack>
    </s-box>
  );
}
