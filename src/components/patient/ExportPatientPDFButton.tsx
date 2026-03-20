import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadPatientCompletePDF } from "@/lib/generatePatientCompletePDF";
import { toast } from "sonner";

interface Props {
  pacienteId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon" | "lg";
  label?: string;
}

export const ExportPatientPDFButton = ({ pacienteId, variant = "outline", size = "sm", label = "Exportar Ficha PDF" }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [pacRes, evalRes, evolRes, agendRes, pagRes, anexRes] = await Promise.all([
        supabase.from("pacientes").select("*").eq("id", pacienteId).single(),
        supabase.from("evaluations").select("*").eq("paciente_id", pacienteId).order("data_avaliacao", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("evolutions").select("*").eq("paciente_id", pacienteId).order("data_evolucao", { ascending: false }),
        supabase.from("agendamentos").select("*").eq("paciente_id", pacienteId).order("data_horario", { ascending: false }),
        supabase.from("pagamentos" as any).select("*").eq("paciente_id", pacienteId).order("data_vencimento", { ascending: false }),
        supabase.from("patient_documents" as any).select("*").eq("paciente_id", pacienteId),
      ]);

      if (pacRes.error) throw pacRes.error;

      // Fetch prof names for evolutions
      const evolucoes = evolRes.data || [];
      const profIds = [...new Set(evolucoes.map((e: any) => e.profissional_id))];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        if (profs) profMap = Object.fromEntries(profs.map((p) => [p.user_id, p.nome]));
      }

      downloadPatientCompletePDF({
        paciente: pacRes.data,
        avaliacao: evalRes.data,
        evolucoes: evolucoes.map((e: any) => ({ ...e, profissional_nome: profMap[e.profissional_id] || "—" })),
        agendamentos: agendRes.data || [],
        pagamentos: pagRes.data || [],
        anexos: anexRes.data || [],
      });

      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {label}
    </Button>
  );
};
