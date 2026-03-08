import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  FileText,
  Sparkles,
  ClipboardList,
  BookOpen,
  Stethoscope,
  FileBarChart,
  Paperclip,
  Copy,
  Download,
  Search,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

type AIAction = "summarize" | "suggest_conduct" | "lesson_plan" | "treatment_plan" | "generate_report" | "analyze_all";

const ACTION_LABELS: Record<AIAction, { label: string; icon: React.ReactNode; description: string }> = {
  analyze_all: { label: "Análise Completa", icon: <Search className="h-4 w-4" />, description: "Prontuário + evoluções + documentos" },
  summarize: { label: "Resumo Clínico", icon: <FileText className="h-4 w-4" />, description: "Síntese do histórico e evolução" },
  suggest_conduct: { label: "Sugestão de Conduta", icon: <Sparkles className="h-4 w-4" />, description: "Próximos passos e exercícios" },
  lesson_plan: { label: "Plano de Aula", icon: <BookOpen className="h-4 w-4" />, description: "Aula personalizada por modalidade" },
  treatment_plan: { label: "Plano de Tratamento", icon: <Stethoscope className="h-4 w-4" />, description: "Análise completa + plano terapêutico" },
  generate_report: { label: "Gerar Relatório", icon: <FileBarChart className="h-4 w-4" />, description: "Relatório clínico formal" },
};

interface AIClinicalAssistantProps {
  pacienteId: string;
  modalidade?: string;
}

export function AIClinicalAssistant({ pacienteId, modalidade }: AIClinicalAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [lastAction, setLastAction] = useState<AIAction | "">("");

  const { data: evolutions = [] } = useQuery({
    queryKey: ["evolucoes-ai", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("evolutions")
        .select("descricao, conduta, data_evolucao")
        .eq("paciente_id", pacienteId)
        .order("data_evolucao", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const { data: evaluation } = useQuery({
    queryKey: ["avaliacao-ai", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("evaluations")
        .select("queixa_principal, historico_doenca, antecedentes_pessoais, objetivos_tratamento, conduta_inicial")
        .eq("paciente_id", pacienteId)
        .order("data_avaliacao", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments-ai", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("patient_attachments")
        .select("file_name, file_type, descricao, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const callAI = async (action: AIAction) => {
    if (!evolutions.length && !evaluation && action !== "lesson_plan") {
      toast({ title: "Sem dados para analisar", description: "Registre avaliações ou evoluções primeiro.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setLastAction(action);
    setResult("");

    try {
      const evolutionsText = evolutions
        .map((e: any) => `[${e.data_evolucao?.split("T")[0]}] ${e.descricao}${e.conduta ? `\nConduta: ${e.conduta}` : ""}`)
        .join("\n\n");

      const evaluationText = evaluation
        ? `Queixa: ${evaluation.queixa_principal}\nHistórico: ${evaluation.historico_doenca || "N/A"}\nAntecedentes: ${evaluation.antecedentes_pessoais || "N/A"}\nObjetivos: ${evaluation.objetivos_tratamento || "N/A"}\nConduta Inicial: ${evaluation.conduta_inicial || "N/A"}`
        : "";

      const attachmentsInfo = attachments.length > 0
        ? attachments.map((a: any) => `- ${a.file_name} (${a.file_type || "desconhecido"})${a.descricao ? ` — ${a.descricao}` : ""}`).join("\n")
        : "";

      const { data, error } = await supabase.functions.invoke("ai-clinical", {
        body: {
          paciente_id: pacienteId,
          evolutions_text: evolutionsText,
          evaluation_text: evaluationText,
          action,
          modalidade: modalidade || "",
          attachments_info: attachmentsInfo,
        },
      });

      if (error) throw error;
      setResult(data.result || "Sem resultado.");
    } catch (err: any) {
      toast({ title: "Erro na análise IA", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast({ title: "Copiado para a área de transferência!" });
  };

  const downloadResult = () => {
    const actionLabel = lastAction ? ACTION_LABELS[lastAction as AIAction]?.label || "resultado" : "resultado";
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${actionLabel.replace(/\s/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasData = evolutions.length > 0 || !!evaluation;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          Assistente Clínico IA
          {modalidade && (
            <Badge variant="secondary" className="text-xs font-normal ml-2">
              {modalidade}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <ClipboardList className="h-3 w-3" />
            {evolutions.length} evolução(ões)
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Stethoscope className="h-3 w-3" />
            {evaluation ? "Avaliação ✓" : "Sem avaliação"}
          </Badge>
          {attachments.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Paperclip className="h-3 w-3" />
              {attachments.length} documento(s)
            </Badge>
          )}
        </div>

        {/* Highlight: Analyze All */}
        <Button
          size="sm"
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => callAI("analyze_all")}
          disabled={loading || !hasData}
        >
          <Search className="h-4 w-4" />
          📊 Análise Completa do Prontuário (IA)
        </Button>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.entries(ACTION_LABELS) as [AIAction, typeof ACTION_LABELS[AIAction]][])
            .filter(([key]) => key !== "analyze_all")
            .map(([key, cfg]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                className="justify-start h-auto py-2 px-3"
                onClick={() => callAI(key as AIAction)}
                disabled={loading || (!hasData && key !== "lesson_plan")}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-primary">{cfg.icon}</span>
                  <div className="text-left">
                    <p className="font-medium text-xs">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground font-normal">{cfg.description}</p>
                  </div>
                </div>
              </Button>
            ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
            <p className="text-xs text-muted-foreground animate-pulse">
              {lastAction === "analyze_all" ? "🔍 Analisando prontuário completo, evoluções e documentos..." :
               lastAction === "lesson_plan" ? "Montando plano de aula personalizado..." :
               lastAction === "treatment_plan" ? "Analisando prontuário e documentos..." :
               lastAction === "generate_report" ? "Gerando relatório clínico..." :
               "Analisando histórico clínico..."}
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="rounded-lg border bg-muted/30 p-4 prose prose-sm max-w-none dark:prose-invert">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {lastAction ? ACTION_LABELS[lastAction as AIAction]?.label : "Resultado"}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyResult} title="Copiar">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={downloadResult} title="Baixar .md">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div
              className="text-sm whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: result
                  .replace(/### (.*)/g, "<h4 class='text-sm font-bold mt-3 mb-1'>$1</h4>")
                  .replace(/## (.*)/g, "<h3 class='text-sm font-bold mt-4 mb-1'>$1</h3>")
                  .replace(/# (.*)/g, "<h2 class='text-base font-bold mt-4 mb-2'>$1</h2>")
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\n/g, "<br/>"),
              }}
            />
          </div>
        )}

        {!hasData && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Registre avaliações e evoluções para habilitar a análise completa por IA
          </p>
        )}
      </CardContent>
    </Card>
  );
}