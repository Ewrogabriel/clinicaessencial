import { useState } from "react";
import { FileText, Loader2, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export const AIDischargeReportButton = ({ pacienteId, pacienteNome }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reportResult, setReportResult] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!user) return;
    setLoading(true);
    setOpen(true);
    setReportResult("");
    
    try {
      // 1. Criar registro do relatório (pendente)
      const { data: reportRecord, error: insertError } = await supabase
        .from("ai_discharge_reports")
        .insert({
          paciente_id: pacienteId,
          profissional_id: user.id,
          status: "pendente"
        })
        .select("id")
        .single();
        
      if (insertError) throw insertError;
      
      const newReportId = reportRecord.id;
      setReportId(newReportId);

      // 2. Invocar Edge Function
      const { data, error } = await supabase.functions.invoke("generate-discharge-report", {
        body: { paciente_id: pacienteId, report_id: newReportId },
      });

      if (error) throw error;

      // 3. Buscar o conteúdo atualizado no banco
      const { data: updatedReport, error: fetchError } = await supabase
        .from("ai_discharge_reports")
        .select("conteudo_markdown, status")
        .eq("id", newReportId)
        .single();
        
      if (fetchError) throw fetchError;
      
      if (updatedReport.status === "erro") {
         throw new Error("Erro ocorrido na geração do Edge Function.");
      }

      setReportResult(updatedReport.conteudo_markdown || "Relatório gerado sem conteúdo.");
      toast.success("Relatório de alta gerado com sucesso!");

    } catch (err: any) {
      console.error(err);
      setReportResult("Erro ao gerar o relatório. Verifique se as configurações de IA (OPENAI_API_KEY) estão corretas.");
      toast.error("Erro", { description: err.message || "Erro desconhecido" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (reportResult) {
      navigator.clipboard.writeText(reportResult);
      toast.success("Copiado para a área de transferência!");
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleGenerateReport} className="gap-2">
        <FileCheck className="h-4 w-4" />
        Gerar Relatório de Alta
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatório de Alta IA — {pacienteNome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <span className="text-muted-foreground text-lg">Gerando relatório de alta...</span>
                <span className="text-sm text-muted-foreground max-w-sm text-center mt-2">
                  A IA está analisando todo o histórico clínico, diagnóstico e evoluções do paciente. Isso pode levar alguns segundos.
                </span>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{reportResult}</ReactMarkdown>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            {!loading && reportResult && (
              <Button onClick={handleCopy}>Copiar Texto</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
