import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Lightbulb, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KpiData {
  pacientesAtivos?: number;
  sessoesRealizadas?: number;
  taxaFaltas?: number;
  faturamento?: number;
  despesas?: number;
  novosPacientes?: number;
  churnRisk?: number;
  ocupacao?: number;
}

interface Insight {
  tipo: "positivo" | "alerta" | "oportunidade" | "neutro";
  titulo: string;
  descricao: string;
  icone: string;
}

interface Props {
  kpiData: KpiData;
}

const tipoStyles = {
  positivo: { bg: "bg-green-50 border-green-200", icon: TrendingUp, color: "text-green-600" },
  alerta: { bg: "bg-red-50 border-red-200", icon: AlertTriangle, color: "text-red-600" },
  oportunidade: { bg: "bg-blue-50 border-blue-200", icon: Lightbulb, color: "text-blue-600" },
  neutro: { bg: "bg-muted border-muted", icon: Info, color: "text-muted-foreground" }
};

export const AIKpiInsights = ({ kpiData }: Props) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [resumo, setResumo] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: "kpi_insights",
          context: kpiData
        }
      });
      if (error) throw error;
      if (data?.insights) {
        setInsights(data.insights);
        setResumo(data.resumo || "");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar insights: " + (e.message || "Tente novamente"));
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
            Insights da IA
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchInsights}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {insights.length > 0 ? "Atualizar" : "Analisar KPIs"}
          </Button>
        </div>
      </CardHeader>
      
      {insights.length > 0 && (
        <CardContent className="space-y-3">
          {resumo && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              {resumo}
            </p>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {insights.map((insight, i) => {
              const style = tipoStyles[insight.tipo];
              const Icon = style.icon;
              return (
                <div key={i} className={`rounded-lg border p-3 ${style.bg}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{insight.icone}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${style.color}`}>{insight.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.descricao}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
