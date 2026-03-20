import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, MessageSquare, Calendar } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/modules/shared/hooks/use-toast";
import { useAuth } from "@/modules/auth/hooks/useAuth";

const ConfirmacoesDia = () => {
  const { user } = useAuth();
  const tomorrow = addDays(new Date(), 1);
  const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
  const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();

  const { data: agendamentos, isLoading, refetch } = useQuery({
    queryKey: ["confirmacoes-amanha", tomorrowStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          pacientes(*),
          profissionais:profiles!inner(nome)
        `)
        .gte("data_horario", tomorrowStart)
        .lt("data_horario", tomorrowEnd)
        .order("data_horario");
      
      if (error) throw error;
      return data as any[];
    },
  });

  const enviarConfirmacao = async (agendamento: any) => {
    const paciente = agendamento.pacientes;
    if (!paciente?.telefone) {
      toast({ title: "Erro", description: "Paciente sem telefone cadastrado", variant: "destructive" });
      return;
    }

    const publicUrl = `${window.location.origin}/confirmar-agendamento/${agendamento.id}`;
    const profNome = agendamento.profissionais?.nome || "seu profissional";
    const hora = format(new Date(agendamento.data_horario), "HH:mm");
    
    const mensagem = `Olá ${paciente.nome}, confirmamos sua sessão amanhã (${format(tomorrow, "dd/MM")}) às ${hora} com ${profNome}. Por favor, confirme sua presença no link: ${publicUrl}`;
    
    const whatsappUrl = `https://wa.me/55${paciente.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
    
    // Update confirmation sent timestamp
    await supabase
      .from("agendamentos")
      .update({ confirmacao_enviada_at: new Date().toISOString() })
      .eq("id", agendamento.id);

    window.open(whatsappUrl, "_blank");
    refetch();
  };

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Confirmações para Amanhã</h1>
          <p className="text-muted-foreground">{format(tomorrow, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {agendamentos?.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Nenhum agendamento para amanhã.</p>
        ) : (
          agendamentos?.map((ag) => (
            <Card key={ag.id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {format(new Date(ag.data_horario), "HH:mm")}
                  </div>
                  <div>
                    <h3 className="font-semibold">{ag.pacientes?.nome}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      Profissional: {ag.profissionais?.nome} | {ag.tipo_atendimento || "Sessão"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ag.confirmacao_presenca === "confirmado" && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Confirmado</Badge>
                  )}
                  {ag.confirmacao_presenca === "cancelado" && (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 gap-1"><X className="h-3 w-3" /> Não virá</Badge>
                  )}
                  {!ag.confirmacao_presenca && (
                    <Badge variant="outline" className="gap-1 animate-pulse"><Calendar className="h-3 w-3" /> Aguardando</Badge>
                  )}

                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => enviarConfirmacao(ag)}
                  >
                    <MessageSquare className="h-4 w-4" /> 
                    {ag.confirmacao_enviada_at ? "Reenviar link" : "Enviar link"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ConfirmacoesDia;
