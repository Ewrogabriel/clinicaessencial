import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, ArrowRight, FileEdit, CalendarClock, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function RequestsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allRequests = [] } = useQuery({
    queryKey: ["dashboard-all-requests"],
    queryFn: async () => {
      const items: any[] = [];

      // Pending agendamentos
      const { data: agends } = await (supabase.from("agendamentos") as any)
        .select("id, data_horario, tipo_atendimento, status, paciente_id, pacientes(nome, user_id)")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(5);
      (agends || []).forEach((a: any) => items.push({
        id: a.id, type: "agendamento", paciente: a.pacientes?.nome || "—",
        detail: `${format(new Date(a.data_horario), "dd/MM HH:mm")} • ${a.tipo_atendimento}`,
        date: a.data_horario, raw: a, paciente_user_id: a.pacientes?.user_id,
      }));

      // Pending dados
      const { data: dados } = await supabase.from("solicitacoes_alteracao_dados")
        .select("id, created_at, paciente_id, status").eq("status", "pendente").order("created_at", { ascending: false }).limit(3);
      if (dados && dados.length > 0) {
        const pIds = [...new Set(dados.map(d => d.paciente_id))];
        const { data: pacs } = await supabase.from("pacientes").select("id, nome").in("id", pIds);
        const pm: Record<string, string> = {};
        (pacs || []).forEach(p => { pm[p.id] = p.nome; });
        dados.forEach(d => items.push({
          id: d.id, type: "dados", paciente: pm[d.paciente_id] || "—",
          detail: "Alteração de dados", date: d.created_at, raw: d,
        }));
      }

      // Pending reservas
      const { data: reservas } = await supabase.from("reservas_produtos")
        .select("id, created_at, paciente_id, produto_id, status").eq("status", "pendente").order("created_at", { ascending: false }).limit(3);
      if (reservas && reservas.length > 0) {
        const pIds = [...new Set(reservas.map(r => r.paciente_id))];
        const prIds = [...new Set(reservas.map(r => r.produto_id))];
        const { data: pacs } = await supabase.from("pacientes").select("id, nome").in("id", pIds);
        const { data: prods } = await supabase.from("produtos").select("id, nome").in("id", prIds);
        const pm: Record<string, string> = {};
        (pacs || []).forEach(p => { pm[p.id] = p.nome; });
        const prm: Record<string, string> = {};
        (prods || []).forEach(p => { prm[p.id] = p.nome; });
        reservas.forEach(r => items.push({
          id: r.id, type: "reserva", paciente: pm[r.paciente_id] || "—",
          detail: `Reserva: ${prm[r.produto_id] || "Produto"}`, date: r.created_at, raw: r,
        }));
      }

      return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    },
  });

  const approveAgendamento = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await (supabase.from("agendamentos") as any).update({ status: "agendado" }).eq("id", item.id);
      if (error) throw error;
      if (item.paciente_user_id) {
        await supabase.from("notificacoes").insert({
          user_id: item.paciente_user_id, tipo: "agendamento_aprovado",
          titulo: "Agendamento aprovado! ✅", resumo: `Sua sessão foi aprovada.`,
        });
      }
    },
    onSuccess: () => { toast({ title: "Aprovado!" }); queryClient.invalidateQueries({ queryKey: ["dashboard-all-requests"] }); queryClient.invalidateQueries({ queryKey: ["dashboard-pending-sessions"] }); },
  });

  const rejectAgendamento = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await (supabase.from("agendamentos") as any).update({ status: "cancelado" }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Rejeitado." }); queryClient.invalidateQueries({ queryKey: ["dashboard-all-requests"] }); queryClient.invalidateQueries({ queryKey: ["dashboard-pending-sessions"] }); },
  });

  const typeIcon: Record<string, any> = {
    agendamento: Clock,
    dados: FileEdit,
    reagendar: CalendarClock,
    reserva: ShoppingBag,
  };

  const typeLabel: Record<string, string> = {
    agendamento: "Agendamento",
    dados: "Dados",
    reagendar: "Reagendar",
    reserva: "Reserva",
  };

  if (allRequests.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Solicitações Recentes ({allRequests.length})
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/solicitacoes-alteracao")}>
          Ver todas <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allRequests.map((item) => {
            const Icon = typeIcon[item.type] || Clock;
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{typeLabel[item.type]}</Badge>
                      <span className="font-medium text-sm truncate">{item.paciente}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                </div>
                {item.type === "agendamento" && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="default" className="h-7 text-xs"
                      onClick={() => approveAgendamento.mutate(item)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs"
                      onClick={() => rejectAgendamento.mutate(item)}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {item.type !== "agendamento" && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                    onClick={() => navigate("/solicitacoes-alteracao")}>
                    Ver
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
