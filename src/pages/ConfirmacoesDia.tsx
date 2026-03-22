import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, MessageSquare, Calendar } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useAuth } from "@/modules/auth/hooks/useAuth";

const ConfirmacoesDia = () => {
  const { user } = useAuth();
  const today = new Date();
  const sevenDaysFromNow = addDays(today, 7);

  const sevenDaysStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).toISOString();
  const sevenDaysEnd = new Date(sevenDaysFromNow.getFullYear(), sevenDaysFromNow.getMonth(), sevenDaysFromNow.getDate(), 23, 59, 59, 999).toISOString();

  const { data: agendamentos, isLoading, refetch } = useQuery({
    queryKey: ["confirmacoes-proximos-7-dias", sevenDaysStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          pacientes(*),
          profissionais:profiles!agendamentos_profissional_id_fkey(nome)
        `)
        .gte("data_horario", sevenDaysStart)
        .lte("data_horario", sevenDaysEnd)
        .order("data_horario");

      if (error) throw error;
      return data as any[];
    },
  });

  // Agrupar agendamentos por data
  const agendasPorDia = (agendamentos || []).reduce((acc, ag) => {
    const data = format(parseISO(ag.data_horario), "yyyy-MM-dd");
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(ag);
    return acc;
  }, {} as Record<string, any[]>);

  const enviarConfirmacao = async (agendamento: any) => {
    const paciente = agendamento.pacientes;
    if (!paciente?.telefone) {
      toast({ title: "Erro", description: "Paciente sem telefone cadastrado", variant: "destructive" });
      return;
    }

    const publicUrl = `${window.location.origin}/confirmar-agendamento/${agendamento.id}`;
    const profNome = agendamento.profissionais?.nome || "seu profissional";
    const hora = format(parseISO(agendamento.data_horario), "HH:mm");
    const dataFormatada = format(parseISO(agendamento.data_horario), "dd/MM/yyyy");

    const mensagem = `Olá ${paciente.nome}, confirmamos sua sessão para ${dataFormatada} às ${hora} com ${profNome}. Por favor, confirme sua presença no link: ${publicUrl}`;

    const whatsappUrl = `https://wa.me/55${paciente.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;

    // Registra que o link foi enviado
    await supabase
      .from("agendamentos")
      .update({ confirmacao_enviada_at: new Date().toISOString() } as any)
      .eq("id", agendamento.id);

    window.open(whatsappUrl, "_blank");
    refetch();
  };

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  const diasOrdenados = Object.keys(agendasPorDia).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu Confirmações</h1>
          <p className="text-muted-foreground">Próximos 7 dias</p>
        </div>
      </div>

      {diasOrdenados.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">Nenhum agendamento nos próximos 7 dias.</p>
      ) : (
        <div className="space-y-6">
          {diasOrdenados.map((dia) => {
            const agendamentosDodia = agendasPorDia[dia];
            const dataFormatada = format(parseISO(dia), "EEEE, dd 'de' MMMM", { locale: ptBR });

            return (
              <div key={dia} className="space-y-3">
                <h2 className="text-lg font-semibold px-2">{dataFormatada}</h2>
                <div className="grid gap-3">
                  {agendamentosDodia.map((ag) => (
                    <Card key={ag.id} className="overflow-hidden">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm whitespace-nowrap">
                            {format(parseISO(ag.data_horario), "HH:mm")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{ag.pacientes?.nome}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {ag.profissionais?.nome} • {ag.tipo_atendimento || "Sessão"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-2">
                          {(ag as any).confirmacao_presenca === "confirmado" && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1 whitespace-nowrap">
                              <Check className="h-3 w-3" /> Sim
                            </Badge>
                          )}
                          {(ag as any).confirmacao_presenca === "cancelado" && (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1 whitespace-nowrap">
                              <X className="h-3 w-3" /> Não
                            </Badge>
                          )}
                          {!(ag as any).confirmacao_presenca && (
                            <Badge variant="outline" className="gap-1 whitespace-nowrap">
                              <Calendar className="h-3 w-3" /> Aguardando
                            </Badge>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 whitespace-nowrap"
                            onClick={() => enviarConfirmacao(ag)}
                          >
                            <MessageSquare className="h-4 w-4" />
                            {(ag as any).confirmacao_enviada_at ? "Reenviar" : "Enviar"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConfirmacoesDia;
