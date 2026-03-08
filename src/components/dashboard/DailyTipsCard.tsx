import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Heart, Brain, Zap, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ICON_MAP: Record<string, any> = {
  "Saúde": Heart,
  "Pilates": Brain,
  "Bem-estar": Zap,
  "Exercícios": Zap,
  "Comportamento": Brain,
  "Técnica": Lightbulb,
  "Profissionalismo": Sparkles,
  "Gestão": Lightbulb,
  "Organização": Sparkles,
  "Atendimento": Heart,
};

const COLOR_MAP: Record<string, string> = {
  "Saúde": "text-rose-600 bg-rose-50",
  "Pilates": "text-indigo-600 bg-indigo-50",
  "Bem-estar": "text-emerald-600 bg-emerald-50",
  "Exercícios": "text-amber-600 bg-amber-50",
  "Comportamento": "text-blue-600 bg-blue-50",
  "Técnica": "text-violet-600 bg-violet-50",
  "Profissionalismo": "text-teal-600 bg-teal-50",
  "Gestão": "text-orange-600 bg-orange-50",
  "Organização": "text-cyan-600 bg-cyan-50",
  "Atendimento": "text-pink-600 bg-pink-50",
};

interface DailyTipsCardProps {
  tipo: "profissional" | "admin" | "secretario" | "paciente";
}

export function DailyTipsCard({ tipo }: DailyTipsCardProps) {
  const [retryCount, setRetryCount] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dicas-diarias-dashboard", tipo, retryCount],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-daily-tips", {
        body: { tipo },
      });
      if (error) throw error;
      return data as { dicas: { titulo: string; conteudo: string; categoria: string }[]; date: string };
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const dicas = data?.dicas || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Dicas do Dia
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setRetryCount(c => c + 1); refetch(); }}
          disabled={isLoading}
          className="gap-1 text-xs"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Novas
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Gerando dicas...</span>
        </div>
      )}

      {!isLoading && dicas.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {dicas.map((dica, i) => {
            const Icon = ICON_MAP[dica.categoria] || Lightbulb;
            const colorClass = COLOR_MAP[dica.categoria] || "text-primary bg-primary/10";
            return (
              <Card key={i} className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded-md shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm leading-tight">{dica.titulo}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-[10px]">{dica.categoria}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{dica.conteudo}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && dicas.length === 0 && (
        <Card className="bg-muted/30">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar as dicas. Clique em "Novas" para tentar novamente.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
