import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export interface FeatureFlagData {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  plano_minimo: string | null;
  categoria: string | null;
}

interface FeatureFlagToggleProps {
  flag: FeatureFlagData;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}

export function FeatureFlagToggle({ flag, onToggle }: FeatureFlagToggleProps) {
  const [pending, setPending] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setPending(true);
    try {
      await onToggle(flag.id, checked);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{flag.nome}</span>
          {flag.plano_minimo && (
            <Badge variant="outline" className="text-xs">
              {flag.plano_minimo}
            </Badge>
          )}
          {flag.categoria && (
            <Badge variant="secondary" className="text-xs capitalize">
              {flag.categoria}
            </Badge>
          )}
        </div>
        {flag.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5">{flag.descricao}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch
          checked={flag.ativo}
          onCheckedChange={handleToggle}
          disabled={pending}
          aria-label={`Toggle ${flag.nome}`}
        />
      </div>
    </div>
  );
}
