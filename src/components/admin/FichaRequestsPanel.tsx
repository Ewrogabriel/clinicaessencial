import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileDown, CheckCircle, XCircle, Loader2, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { downloadPatientCompletePDF } from "@/lib/generatePatientCompletePDF";

export const FichaRequestsPanel = () => {
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ id: string; pacienteId: string } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["ficha-requests-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ficha_requests")
        .select("*, pacientes(id, nome, foto_url, telefone, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pendentes = requests.filter((r: any) => r.status === "pendente");
  const historico = requests.filter((r: any) => r.status !== "pendente");

  const approveAndGenerate = async (request: any) => {
    setGeneratingPDF(request.id);
    try {
      const pacienteId = request.paciente_id;

      // Fetch all patient data
      const [pacRes, evalRes, evolRes, agendRes, pagRes, anexRes] = await Promise.all([
        supabase.from("pacientes").select("*").eq("id", pacienteId).single(),
        supabase.from("evaluations").select("*").eq("paciente_id", pacienteId).order("data_avaliacao", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("evolutions").select("*").eq("paciente_id", pacienteId).order("data_evolucao", { ascending: false }),
        supabase.from("agendamentos").select("*").eq("paciente_id", pacienteId).order("data_horario", { ascending: false }),
        (supabase as any).from("pagamentos").select("*").eq("paciente_id", pacienteId).order("data_vencimento", { ascending: false }),
        (supabase as any).from("patient_documents").select("*").eq("paciente_id", pacienteId),
      ]);

      if (pacRes.error) throw pacRes.error;

      const evolucoes = evolRes.data || [];
      const profIds = [...new Set(evolucoes.map((e: any) => e.profissional_id))];
      let profMap: Record<string, string> = {};
      if (profIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
        if (profs) profMap = Object.fromEntries(profs.map((p) => [p.user_id, p.nome]));
      }

      // Generate PDF and download
      const pdfBlob = await downloadPatientCompletePDF({
        paciente: pacRes.data,
        avaliacao: evalRes.data,
        evolucoes: evolucoes.map((e: any) => ({ ...e, profissional_nome: profMap[e.profissional_id] || "—" })),
        agendamentos: agendRes.data || [],
        pagamentos: pagRes.data || [],
        anexos: anexRes.data || [],
      });

      // Upload PDF to storage for patient access
      let pdfUrl: string | null = null;
      const fileName = `prontuarios/${pacienteId}/ficha_${request.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("clinic-uploads")
        .upload(fileName, pdfBlob, { upsert: true, contentType: "application/pdf" });
      
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("clinic-uploads").getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
      }

      // Calculate 30 days from now
      const pdfAvailableUntil = new Date();
      pdfAvailableUntil.setDate(pdfAvailableUntil.getDate() + 30);

      // Mark as approved with PDF URL and expiry date
      await (supabase as any)
        .from("ficha_requests")
        .update({ 
          status: "aprovado", 
          reviewed_at: new Date().toISOString(),
          pdf_url: pdfUrl,
          pdf_available_until: pdfAvailableUntil.toISOString(),
        })
        .eq("id", request.id);

      toast.success("PDF gerado e solicitação aprovada! O paciente poderá acessar por 30 dias.");
      queryClient.invalidateQueries({ queryKey: ["ficha-requests-admin"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setGeneratingPDF(null);
    }
  };

  const rejectRequest = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await (supabase as any)
        .from("ficha_requests")
        .update({ status: "rejeitado", reviewed_at: new Date().toISOString(), motivo_rejeicao: motivoRejeicao })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação rejeitada.");
      setRejectDialog(null);
      setMotivoRejeicao("");
      queryClient.invalidateQueries({ queryKey: ["ficha-requests-admin"] });
    },
    onError: () => toast.error("Erro ao rejeitar."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Solicitações Pendentes
            {pendentes.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendentes.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma solicitação pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendentes.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div>
                    <p className="font-medium">{r.pacientes?.nome || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveAndGenerate(r)}
                      disabled={generatingPDF === r.id}
                      className="gap-2"
                    >
                      {generatingPDF === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      Aprovar e Gerar PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectDialog({ id: r.id, pacienteId: r.paciente_id })}
                      className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historico.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{r.pacientes?.nome || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={r.status === "aprovado" ? "outline" : "destructive"} className="gap-1">
                    {r.status === "aprovado" ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {r.status === "aprovado" ? "Aprovado" : "Rejeitado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setMotivoRejeicao(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo da rejeição (opcional):</p>
            <Textarea
              placeholder="Ex: Documentação incompleta, aguarde contato da clínica..."
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => rejectRequest.mutate({ id: rejectDialog!.id })}
              disabled={rejectRequest.isPending}
            >
              {rejectRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
