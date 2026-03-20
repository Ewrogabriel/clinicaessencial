import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Insight {
  tipo: "positivo" | "atencao" | "oportunidade" | "estrategia";
  titulo: string;
  descricao: string;
  metrica: string;
}

const iconMap = {
  positivo: TrendingUp,
  atencao: AlertTriangle,
  oportunidade: Lightbulb,
  estrategia: Target,
};

const colorMap = {
  positivo: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  atencao: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  oportunidade: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  estrategia: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
};

interface Props {
  kpis: Record<string, unknown>;
  trends: unknown[];
}

export function AIInsightsPanel({ kpis, trends }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("professional-insights", {
        body: { kpis, trends },
      });
      if (data?.insights) setInsights(data.insights);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insights com IA
        </CardTitle>
        <Button size="sm" onClick={generateInsights} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {insights.length > 0 ? "Atualizar" : "Gerar Insights"}
        </Button>
      </CardHeader>
      <CardContent>
        {insights.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Clique em "Gerar Insights" para receber análises personalizadas baseadas nos seus dados.
          </p>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analisando sua performance...</span>
          </div>
        )}
        {insights.length > 0 && !loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight, i) => {
              const Icon = iconMap[insight.tipo] || Lightbulb;
              const colors = colorMap[insight.tipo] || colorMap.estrategia;
              return (
                <div key={i} className={`rounded-lg border p-4 ${colors}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{insight.titulo}</p>
                      <p className="text-xs opacity-90">{insight.descricao}</p>
                      {insight.metrica && (
                        <Badge variant="outline" className="text-[10px] mt-1">{insight.metrica}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
