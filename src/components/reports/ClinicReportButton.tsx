import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { generateClinicReportPDF } from "@/lib/generateClinicReportPDF";
import { toast } from "@/modules/shared/hooks/use-toast";

export function ClinicReportButton() {
  const [loading, setLoading] = useState(false);
  const { activeClinicId } = useClinic();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clinic-report", {
        body: { clinicId: activeClinicId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await generateClinicReportPDF(data.report, data.metrics);
      toast({ title: "Relatório gerado com sucesso!", description: "O PDF foi baixado automaticamente." });
    } catch (err: any) {
      console.error("Report error:", err);
      toast({ title: "Erro ao gerar relatório", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      className="gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-primary-foreground shadow-lg"
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando relatório...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <FileText className="h-4 w-4" />
          Relatório IA (PDF)
        </>
      )}
    </Button>
  );
}
