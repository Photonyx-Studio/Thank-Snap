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
import { createFeedback, listFeedbackForShop } from "../models/feedback.server";
import type { FeedbackTypeValue } from "../models/feedbackTypes";
import { FeedbackForm } from "../components/feedback/FeedbackForm";
import { FeedbackHistory } from "../components/feedback/FeedbackHistory";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const submissions = await listFeedbackForShop(session.shop);
  return { submissions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const type = String(formData.get("type")) as FeedbackTypeValue;
  const message = String(formData.get("message") ?? "");
  const contactEmail = String(formData.get("contactEmail") ?? "");

  if (!message.trim()) {
    return { ok: false, error: "Message is required" };
  }

  await createFeedback(session.shop, { type, message, contactEmail });

  return { ok: true };
};

export default function FeedbackPage() {
  const { submissions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [type, setType] = useState<FeedbackTypeValue>("BUG");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Thanks for the feedback!");
      setMessage("");
      setContactEmail("");
    }
  }, [fetcher.data, shopify]);

  // A toast that auto-dismisses isn't appropriate for an error a merchant
  // needs to act on - shown as a persistent banner next to the form instead,
  // so it stays until they either fix the problem or navigate away.
  const submitError =
    fetcher.data && !fetcher.data.ok
      ? (fetcher.data.error ?? "Something went wrong. Please try again.")
      : null;

  function handleSubmit() {
    fetcher.submit({ type, message, contactEmail }, { method: "POST" });
  }

  return (
    <s-page heading="Contact us">
      <s-link slot="breadcrumb-actions" href="/app">
        Home
      </s-link>

      <s-section heading="Suggest a feature or report a bug">
        <s-paragraph>
          Tell us what&apos;s not working, or what you wish this app could do
          —
          we read every submission.
        </s-paragraph>
        {submitError ? (
          <s-banner tone="critical" heading="Couldn't send your feedback">
            <s-paragraph>{submitError}</s-paragraph>
          </s-banner>
        ) : null}
        <FeedbackForm
          type={type}
          onTypeChange={setType}
          message={message}
          onMessageChange={setMessage}
          contactEmail={contactEmail}
          onContactEmailChange={setContactEmail}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </s-section>

      <s-section heading="Your past submissions">
        <FeedbackHistory submissions={submissions} />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
