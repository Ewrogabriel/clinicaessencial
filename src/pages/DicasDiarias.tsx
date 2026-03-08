import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, Heart, Brain, Zap, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
};

export default function DicasDiarias() {
  const { isPatient } = useAuth();
  const [retryCount, setRetryCount] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dicas-diarias", isPatient ? "paciente" : "profissional", retryCount],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-daily-tips", {
        body: { tipo: isPatient ? "paciente" : "profissional" },
      });
      if (error) throw error;
      return data as { dicas: { titulo: string; conteudo: string; categoria: string }[]; date: string };
    },
    staleTime: 1000 * 60 * 60, // cache 1h
    retry: 1,
  });

  const dicas = data?.dicas || [];

  const renderDica = (dica: { titulo: string; conteudo: string; categoria: string }, index: number) => {
    const Icon = ICON_MAP[dica.categoria] || Lightbulb;
    const colorClass = COLOR_MAP[dica.categoria] || "text-primary bg-primary/10";

    return (
      <Card key={index} className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{dica.titulo}</CardTitle>
              <Badge variant="outline" className="mt-2 text-xs">
                {dica.categoria}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{dica.conteudo}</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
            <Lightbulb className="w-7 h-7 text-amber-500" />
            Dicas Diárias
          </h1>
          <p className="text-muted-foreground mt-1">
            Dicas personalizadas por IA para {isPatient ? "seu bem-estar" : "sua prática profissional"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setRetryCount(c => c + 1); refetch(); }}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Novas Dicas
        </Button>
      </div>

      {/* Date Banner */}
      <Card className="border-2 border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">Dicas de Hoje</CardTitle>
          </div>
          <CardDescription className="text-amber-700">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Gerando dicas com IA...</p>
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-3">Não foi possível gerar as dicas. Tente novamente.</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      {!isLoading && dicas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          {dicas.map((dica, i) => renderDica(dica, i))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-muted/30 border-muted">
        <CardContent className="pt-6 text-sm text-muted-foreground space-y-1">
          <p>• As dicas são geradas por inteligência artificial e personalizadas para seu perfil</p>
          <p>• Clique em "Novas Dicas" para gerar orientações diferentes</p>
          <p>• As dicas não substituem orientação profissional individualizada</p>
        </CardContent>
      </Card>
    </div>
  );
}
