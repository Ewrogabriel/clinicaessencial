import { Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PlanoItem } from "./types";
import type { UseFormReturn } from "react-hook-form";
import type { FormData } from "./types";

interface PlanSelectorSectionProps {
  planos: PlanoItem[];
  selectedPlanoId: string;
  onPlanoChange: (id: string) => void;
  selectedPlano: PlanoItem | null;
  planoSessoesRestantes: number | null;
}

export function PlanSelectorSection({ planos, selectedPlanoId, onPlanoChange, selectedPlano, planoSessoesRestantes }: PlanSelectorSectionProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2 bg-green-50/50">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-4 w-4 text-green-600" />
        <Label className="font-medium text-sm">Pacote de Sessões</Label>
      </div>
      <Select value={selectedPlanoId} onValueChange={onPlanoChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o pacote" />
        </SelectTrigger>
        <SelectContent>
          {planos.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-medium">{p.paciente_nome}</span>
              <span className="text-muted-foreground ml-2 text-xs">
                · {p.tipo_atendimento} · {p.sessoes_utilizadas}/{p.total_sessoes} sessões usadas
              </span>
            </SelectItem>
          ))}
          {planos.length === 0 && (
            <SelectItem value="_none" disabled>Nenhum pacote ativo encontrado</SelectItem>
          )}
        </SelectContent>
      </Select>
      {selectedPlanoId && selectedPlano && (
        <p className={cn(
          "text-xs mt-1",
          planoSessoesRestantes! <= 0 ? "text-destructive" : planoSessoesRestantes! <= 2 ? "text-amber-600" : "text-green-700"
        )}>
          {planoSessoesRestantes! <= 0
            ? "⚠️ Pacote esgotado — sem sessões disponíveis."
            : `✅ ${planoSessoesRestantes} sessão(ões) restante(s) neste pacote.`}
        </p>
      )}
    </div>
  );
}
