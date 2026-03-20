import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, User, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WaitingEntry {
  id: string;
  pacientes?: { nome: string };
  tipo_atendimento: string;
  dia_semana?: number[];
  hora_preferida_inicio?: string;
  hora_preferida_fim?: string;
  created_at: string;
}

interface Slot {
  dia: string;
  horario: string;
  profissional: string;
}

interface Suggestion {
  slot: string;
  paciente_id?: string;
  paciente_nome: string;
  motivo: string;
  compatibilidade: number;
}

interface Props {
  waitingList: WaitingEntry[];
  availableSlots?: Slot[];
  onSelectPatient?: (pacienteNome: string, slot: string) => void;
}

export const AIWaitingListPriority = ({ waitingList, availableSlots = [], onSelectPatient }: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPriority = async () => {
    if (waitingList.length === 0) {
      toast.info("Nenhum paciente na lista de espera.");
      return;
    }
    
    setLoading(true);
    try {
      const simplifiedList = waitingList.slice(0, 10).map(e => ({
        nome: e.pacientes?.nome || "Paciente",
        tipo: e.tipo_atendimento,
        diasPreferidos: e.dia_semana,
        horarioInicio: e.hora_preferida_inicio,
        horarioFim: e.hora_preferida_fim,
        desdeDe: e.created_at
      }));

      const slots = availableSlots.length > 0 ? availableSlots : [
        { dia: "Segunda", horario: "08:00", profissional: "Disponível" },
        { dia: "Quarta", horario: "14:00", profissional: "Disponível" },
        { dia: "Sexta", horario: "10:00", profissional: "Disponível" }
      ];

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "waiting_list_priority",
          context: {
            waitingList: simplifiedList,
            slots
          }
        }
      });
      
      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (e: any) {
      toast.error("Erro ao priorizar: " + (e.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Priorização Inteligente
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchPriority}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {suggestions.length > 0 ? "Atualizar" : "Analisar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA sugere quais pacientes priorizar quando vagas abrirem.
        </p>
      </CardHeader>
      
      {suggestions.length > 0 && (
        <CardContent className="space-y-2">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onSelectPatient?.(s.paciente_nome, s.slot)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{s.paciente_nome}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {s.compatibilidade}% match
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.motivo}</p>
                <p className="text-xs text-primary mt-0.5">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {s.slot}
                </p>
              </div>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};
