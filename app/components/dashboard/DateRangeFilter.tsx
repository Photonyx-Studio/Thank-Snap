import { useNavigate } from "react-router";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "../../models/dateRange";

interface DateRangeFilterProps {
  value: DateRangeKey;
}

export function DateRangeFilter({ value }: DateRangeFilterProps) {
  const navigate = useNavigate();

  return (
    <s-select
      label="Date range"
      value={value}
      onChange={(e) => navigate(`/app/dashboard?range=${e.currentTarget.value}`)}
    >
      {DATE_RANGE_OPTIONS.map((option) => (
        <s-option key={option.value} value={option.value}>
          {option.label}
        </s-option>
      ))}
    </s-select>
  );
}
