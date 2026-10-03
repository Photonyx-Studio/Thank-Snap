interface StatTilesProps {
  responseRate: number | null;
  surveysShown: number;
  surveysAnswered: number;
}

export function StatTiles({ responseRate, surveysShown, surveysAnswered }: StatTilesProps) {
  return (
    <s-query-container>
      <s-grid
        gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr, 1fr"
        gap="base"
      >
        <StatTile label="Response rate" value={responseRate === null ? "—" : `${responseRate}%`} />
        <StatTile label="Surveys shown" value={String(surveysShown)} />
        <StatTile label="Surveys answered" value={String(surveysAnswered)} />
      </s-grid>
    </s-query-container>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-text tone="neutral">{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}
