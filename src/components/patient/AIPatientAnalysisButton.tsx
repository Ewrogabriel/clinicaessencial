import { useState } from "react";
import { Brain, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export const AIPatientAnalysisButton = ({ pacienteId, pacienteNome }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState("");

  const handleAnalysis = async () => {
    setLoading(true);
    setOpen(true);
    setAnalysis("");
    try {
      const [pacRes, evalRes, evolRes, agendRes] = await Promise.all([
        supabase.from("pacientes").select("*").eq("id", pacienteId).single(),
        supabase.from("evaluations").select("*").eq("paciente_id", pacienteId).order("data_avaliacao", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("evolutions").select("descricao, conduta, data_evolucao").eq("paciente_id", pacienteId).order("data_evolucao", { ascending: false }).limit(10),
        supabase.from("agendamentos").select("status, data_horario, tipo_atendimento").eq("paciente_id", pacienteId).order("data_horario", { ascending: false }).limit(30),
      ]);

      const paciente = pacRes.data;
      const sessoes = agendRes.data || [];
      const realizados = sessoes.filter((s: any) => s.status === "realizado").length;
      const faltas = sessoes.filter((s: any) => s.status === "falta").length;

      const prompt = `Você é um assistente clínico especializado. Analise os dados do paciente e forneça um parecer completo em português.

PACIENTE: ${paciente?.nome}, ${paciente?.tipo_atendimento}
AVALIAÇÃO: ${evalRes.data ? `Queixa: ${evalRes.data.queixa_principal}. Histórico: ${evalRes.data.historico_doenca || "N/A"}. Objetivos: ${evalRes.data.objetivos_tratamento || "N/A"}.` : "Sem avaliação"}
EVOLUÇÕES (últimas ${(evolRes.data || []).length}): ${(evolRes.data || []).map((e: any) => `[${e.data_evolucao}] ${e.descricao?.substring(0, 100)}`).join(" | ") || "Sem evoluções"}
SESSÕES: ${sessoes.length} total, ${realizados} realizadas, ${faltas} faltas, taxa ${sessoes.length > 0 ? Math.round((realizados / sessoes.length) * 100) : 0}%

Forneça:
1. Resumo do caso clínico
2. Evolução do tratamento
3. Adesão e engajamento
4. Pontos de atenção
5. Recomendações`;

      const { data, error } = await supabase.functions.invoke("ai-clinical", {
        body: { prompt, type: "analysis" },
      });

      if (error) throw error;
      setAnalysis(data?.response || data?.text || "Não foi possível gerar a análise.");
    } catch (err) {
      console.error(err);
      setAnalysis("Erro ao gerar análise. Tente novamente.");
      toast.error("Erro na análise IA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleAnalysis} className="gap-2">
        <Brain className="h-4 w-4" />
        Análise IA
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Parecer IA — {pacienteNome}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Analisando dados...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
              {analysis}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
