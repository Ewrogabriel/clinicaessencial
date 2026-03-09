import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, X, ChevronDown, ChevronUp, Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Suggestion {
  type: "meta" | "desafio";
  titulo: string;
  descricao: string;
  metric_type: string;
  target_value: number;
  pontos_recompensa: number;
  icone: string;
  duracao_dias: number;
}

interface Props {
  tipo: "profissional" | "paciente";
}

export const AISuggestionsPanel = ({ tipo }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("gamification-suggestions", {
        body: { tipo },
      });
      if (error) throw error;
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      } else {
        toast.error("Nenhuma sugestão retornada.");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar sugestões: " + (e.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const acceptSuggestion = async (index: number) => {
    const s = suggestions[index];
    if (!s || !user?.id) return;
    setAccepting(index);

    const now = new Date();
    const end = new Date(now.getTime() + s.duracao_dias * 24 * 60 * 60 * 1000);
    const dataInicio = now.toISOString().split("T")[0];
    const dataFim = end.toISOString().split("T")[0];

    try {
      if (s.type === "meta") {
        const { error } = await supabase.from("professional_goals").insert([{
          titulo: s.titulo,
          descricao: s.descricao,
          meta_tipo: s.metric_type,
          meta_valor: s.target_value,
          pontos_recompensa: s.pontos_recompensa,
          data_inicio: dataInicio,
          data_fim: dataFim,
          ativo: true,
          created_by: user.id,
          tipo: "individual",
        }]);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["professional-goals"] });
      } else {
        const { error } = await supabase.from("challenges").insert([{
          titulo: s.titulo,
          descricao: s.descricao,
          icone: s.icone,
          tipo,
          metric_type: s.metric_type,
          meta: { target: s.target_value, metric: s.metric_type },
          pontos_recompensa: s.pontos_recompensa,
          data_inicio: dataInicio,
          data_fim: dataFim,
          ativo: true,
        }]);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["challenges-admin"] });
      }

      toast.success(`${s.type === "meta" ? "Meta" : "Desafio"} "${s.titulo}" criado com sucesso!`);
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
    } catch (e: any) {
      toast.error("Erro ao aceitar sugestão: " + e.message);
    } finally {
      setAccepting(null);
    }
  };

  const rejectSuggestion = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
    toast.info("Sugestão descartada.");
  };

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugestões da IA
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSuggestions}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Gerando..." : suggestions.length > 0 ? "Gerar Novas" : "Gerar Sugestões"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA analisa as métricas do sistema e sugere metas e desafios para {tipo === "paciente" ? "pacientes" : "profissionais"}.
        </p>
      </CardHeader>

      {suggestions.length > 0 && (
        <CardContent className="space-y-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-4 space-y-3 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{s.icone}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{s.titulo}</p>
                      <Badge variant={s.type === "meta" ? "default" : "secondary"} className="text-[10px]">
                        {s.type === "meta" ? <><Target className="h-3 w-3 mr-1" />Meta</> : <><Trophy className="h-3 w-3 mr-1" />Desafio</>}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.pontos_recompensa} pts • {s.duracao_dias} dias
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  {expanded === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {expanded === i && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                  <p>{s.descricao}</p>
                  <p className="text-xs font-medium">Métrica: <span className="text-foreground">{s.metric_type}</span> • Alvo: <span className="text-foreground">{s.target_value}</span></p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={() => acceptSuggestion(i)}
                  disabled={accepting === i}
                >
                  {accepting === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Aceitar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => rejectSuggestion(i)}
                  disabled={accepting === i}
                >
                  <X className="h-3 w-3" />
                  Recusar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
};
