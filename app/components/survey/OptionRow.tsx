interface OptionRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
}

export function OptionRow({ label, value, onChange, onRemove }: OptionRowProps) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      <s-text-field
        label={label}
        labelAccessibilityVisibility="exclusive"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value ?? "")}
      ></s-text-field>
      <s-button variant="tertiary" tone="critical" onClick={onRemove}>
        Remove
      </s-button>
    </s-stack>
  );
}
