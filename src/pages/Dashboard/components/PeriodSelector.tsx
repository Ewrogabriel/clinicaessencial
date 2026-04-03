import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_OPTIONS = [
  { label: "Hoje", value: "today" },
  { label: "Últimos 7 dias", value: "7days" },
  { label: "Últimos 30 dias", value: "30days" },
  { label: "Este mês", value: "month" },
  { label: "Este ano", value: "year" },
];

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
  options?: Array<{ label: string; value: string }>;
}

export function PeriodSelector({ value, onChange, options }: PeriodSelectorProps) {
  const opts = options || DEFAULT_OPTIONS;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
