export function AboutSurveyAside() {
  return (
    <s-section slot="aside" heading="About this survey">
      <s-paragraph>
        This survey renders on the Thank you page through the
        &ldquo;thank-you-survey&rdquo; checkout extension — add it once in
        Settings → Checkout → Customize checkout. Once it&apos;s there, turn
        it off above any time to hide it without removing the block.
      </s-paragraph>
      <s-link href="shopify:admin/settings/checkout">
        Go to checkout settings
      </s-link>
      <s-paragraph>
        Removing a question also removes any responses already collected for
        it.
      </s-paragraph>
    </s-section>
  );
}
