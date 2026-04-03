import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Calendar, Clock, User, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReagendamentoDialog } from "@/components/agenda/ReagendamentoDialog";
import { toast } from "sonner";
const ConfirmarAgendamento = () => {
  const { id } = useParams();
  const [agendamento, setAgendamento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "confirmed" | "denied" | "rescheduled">("pending");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [profissionaisList, setProfissionaisList] = useState<Array<{ id: string; nome: string }>>([]);

  useEffect(() => {
    const fetchAgendamento = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("confirm-agendamento", {
        body: { action: "get", id },
      });

      if (error || !data || data.error) {
        setLoading(false);
        return;
      }

      setAgendamento(data);

      const confirmacao = data.confirmacao_presenca;
      if (confirmacao === "confirmado") setStatus("confirmed");
      else if (confirmacao === "cancelado") setStatus("denied");

      // Populate the professionals list for the reschedule dialog
      if (data.profissional_id) {
        setProfissionaisList([{ id: data.profissional_id, nome: data.profissionais?.nome || "Profissional" }]);
      }

      setLoading(false);
    };

    fetchAgendamento();
  }, [id]);

  const handleConfirm = async (confirmed: boolean) => {
    if (!id) return;
    const confirmacao = confirmed ? "confirmado" : "cancelado";
    const { error } = await supabase.functions.invoke("confirm-agendamento", {
      body: { action: "update", id, confirmacao },
    });

    if (!error) {
      setStatus(confirmed ? "confirmed" : "denied");
    }
  };

  const handleRescheduleConfirm = async (rescheduleData: { data: Date; hora: string; profissionalId: string }) => {
    if (!id) return;
    const parts = rescheduleData.hora.split(":");
    if (parts.length < 2) {
      toast.error("Horário inválido");
      return;
    }
    const [hours, minutes] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      toast.error("Horário inválido");
      return;
    }
    const dt = new Date(rescheduleData.data);
    dt.setHours(hours, minutes, 0, 0);
    const data_horario = dt.toISOString();

    const { error } = await supabase.functions.invoke("confirm-agendamento", {
      body: {
        action: "reschedule",
        id,
        data_horario,
        profissional_id: rescheduleData.profissionalId,
      },
    });

    if (error) {
      toast.error("Erro ao reagendar", { description: error.message });
      return;
    }

    setShowRescheduleModal(false);
    setStatus("rescheduled");
    toast.success("Reagendado com sucesso!", { description: `Novo horário: ${format(dt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!agendamento) return <div className="min-h-screen flex items-center justify-center">Agendamento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-2">
          {(agendamento.clinicas as any)?.logo_url && (
            <img src={(agendamento.clinicas as any).logo_url} alt="Logo" className="h-16 mx-auto mb-4 object-contain" />
          )}
          <CardTitle className="text-2xl font-bold">Confirmação de Consulta</CardTitle>
          <p className="text-muted-foreground">{(agendamento.clinicas as any)?.nome}</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-4 text-center">
          {status === "pending" ? (
            <>
              <div className="bg-blue-50 p-4 rounded-lg space-y-3 text-left">
                <div className="flex items-center gap-3 text-blue-700">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Olá, {agendamento.pacientes?.nome}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Calendar className="h-5 w-5" />
                  <span>{agendamento.data_horario ? (() => { try { return format(new Date(agendamento.data_horario), "eeee, dd 'de' MMMM", { locale: ptBR }); } catch { return agendamento.data_horario; } })() : ""}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Clock className="h-5 w-5" />
                  <span>{agendamento.data_horario ? (() => { try { return format(new Date(agendamento.data_horario), "HH:mm"); } catch { return ""; } })() : ""}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <User className="h-5 w-5" />
                  <span>Profissional: {agendamento.profissionais?.nome}</span>
                </div>
              </div>

              <p className="text-slate-600">Você poderá comparecer a este atendimento?</p>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleConfirm(true)}
                  className="bg-green-600 hover:bg-green-700 h-12 gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" /> Sim, confirmo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleConfirm(false)}
                  className="border-red-200 text-red-600 hover:bg-red-50 h-12 gap-2"
                >
                  <XCircle className="h-5 w-5" /> Não poderei ir
                </Button>
              </div>
            </>
          ) : (
            <div className="py-10 space-y-4">
              {status === "confirmed" ? (
                <>
                  <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-700">Presença Confirmada!</h2>
                  <p className="text-slate-600">Obrigado por confirmar. Te aguardamos no horário marcado.</p>
                </>
              ) : status === "rescheduled" ? (
                <>
                  <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <RefreshCw className="h-12 w-12 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-blue-700">Reagendamento Confirmado!</h2>
                  <p className="text-slate-600">Seu atendimento foi reagendado. Você receberá uma confirmação em breve.</p>
                </>
              ) : (
                <>
                  <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-12 w-12 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-700">Aviso Recebido</h2>
                  <p className="text-slate-600">Entendemos o imprevisto. Gostaria de reagendar para outro horário?</p>
                  <Button
                    onClick={() => setShowRescheduleModal(true)}
                    className="gap-2 mt-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Reagendar Agora
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ReagendamentoDialog
        open={showRescheduleModal}
        onOpenChange={setShowRescheduleModal}
        profissionalId={agendamento?.profissional_id}
        profissionaisList={profissionaisList}
        onConfirm={handleRescheduleConfirm}
      />
    </div>
  );
};

export default ConfirmarAgendamento;
