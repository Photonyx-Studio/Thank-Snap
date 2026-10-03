import type { AttributionOption } from "../../models/dashboard.server";

interface TopChannelHighlightProps {
  topChannel: AttributionOption | null;
}

export function TopChannelHighlight({ topChannel }: TopChannelHighlightProps) {
  if (!topChannel) {
    return (
      <s-box padding="base" border="base" borderRadius="base" background="subdued">
        <s-text tone="neutral">No attribution answers yet in this range.</s-text>
      </s-box>
    );
  }

  return (
    <s-box padding="base" border="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="base">
        <s-text tone="neutral">Top channel</s-text>
        <s-heading>{topChannel.option}</s-heading>
        <s-text>
          {topChannel.percentage}% of answers ({topChannel.count})
        </s-text>
      </s-stack>
    </s-box>
  );
}
