import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ConfirmarAgendamento = () => {
  const { id } = useParams();
  const [agendamento, setAgendamento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "confirmed" | "denied">("pending");

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
              ) : (
                <>
                  <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-12 w-12 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-700">Aviso Recebido</h2>
                  <p className="text-slate-600">Entendemos o imprevisto. Entraremos em contato em breve para reagendamento.</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmarAgendamento;
