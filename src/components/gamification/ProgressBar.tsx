import { Progress } from "@/components/ui/progress";

interface Props {
  current: number;
  total: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
}

export const ProgressBar = ({ current, total, label, color, showPercentage = true }: Props) => {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="font-medium ml-auto">
              {current}/{total} ({percentage}%)
            </span>
          )}
        </div>
      )}
      <Progress
        value={percentage}
        className="h-2"
        style={color ? ({ "--progress-color": color } as React.CSSProperties) : undefined}
      />
    </div>
  );
};
