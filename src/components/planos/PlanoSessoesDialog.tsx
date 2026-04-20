import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";

interface PlanoSessoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: {
    id: string;
    paciente_id: string;
    profissional_id: string;
    tipo_atendimento: string;
    total_sessoes: number;
    sessoes_utilizadas: number;
    pacientes?: { nome: string } | null;
  };
  userId: string;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  agendado: { label: "Agendado", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "default" },
  realizado: { label: "Realizado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  falta: { label: "Falta", variant: "destructive" },
  reposicao: { label: "Reposição", variant: "outline" },
};

export const PlanoSessoesDialog = ({ open, onOpenChange, plano }: PlanoSessoesDialogProps) => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("todas");
  const [agendarOpen, setAgendarOpen] = useState(false);

  // Always fetch latest plano stats (sessoes_utilizadas may have changed via trigger)
  const { data: planoLive } = useQuery({
    queryKey: ["plano-detalhe", plano.id],
    enabled: open,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("id, total_sessoes, sessoes_utilizadas")
        .eq("id", plano.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const totalSessoes = planoLive?.total_sessoes ?? plano.total_sessoes;
  const sessoesUtilizadas = planoLive?.sessoes_utilizadas ?? plano.sessoes_utilizadas;
  const restante = totalSessoes - sessoesUtilizadas;
  const pct = totalSessoes > 0 ? Math.round((sessoesUtilizadas / totalSessoes) * 100) : 0;

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ["plano-sessoes", plano.id],
    enabled: open,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data_horario, duracao_minutos, status, tipo_atendimento, observacoes, profissional_id")
        .eq("paciente_id", plano.paciente_id)
        .ilike("observacoes", `%plano:${plano.id}%`)
        .order("data_horario", { ascending: true });
      if (error) throw error;
      const list = data || [];
      const profIds = [...new Set(list.map((s: any) => s.profissional_id).filter(Boolean))];
      const profMap: Record<string, string> = {};
      if (profIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, nome").in("user_id", profIds);
        (profs || []).forEach((p: any) => { profMap[p.user_id] = p.nome; });
      }
      return list.map((s: any) => ({ ...s, profissional_nome: profMap[s.profissional_id] || "—" }));
    },
  });

  const creditosDisponiveis = restante - sessoes.filter(s => ["agendado", "confirmado", "pendente"].includes(s.status)).length;

  const filteredSessoes = sessoes.filter((s: any) => {
    if (activeTab === "todas") return true;
    if (activeTab === "pendentes") return ["pendente", "agendado", "confirmado"].includes(s.status);
    if (activeTab === "realizadas") return s.status === "realizado";
    if (activeTab === "canceladas") return s.status === "cancelado" || s.status === "falta";
    return true;
  });

  const countByStatus = {
    pendentes: sessoes.filter(s => ["pendente", "agendado", "confirmado"].includes(s.status)).length,
    realizadas: sessoes.filter(s => s.status === "realizado").length,
    canceladas: sessoes.filter(s => s.status === "cancelado" || s.status === "falta").length,
  };

  const handleAgendamentoSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["plano-sessoes", plano.id] });
    queryClient.invalidateQueries({ queryKey: ["plano-detalhe", plano.id] });
    queryClient.invalidateQueries({ queryKey: ["planos"] });
    queryClient.invalidateQueries({ queryKey: ["planos-agendadas"] });
  };

  // Realtime: refresh sessions and plan stats whenever any related agendamento or the plano row changes
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`plano-${plano.id}-watch`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos", filter: `paciente_id=eq.${plano.paciente_id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["plano-sessoes", plano.id] });
          queryClient.invalidateQueries({ queryKey: ["plano-detalhe", plano.id] });
          queryClient.invalidateQueries({ queryKey: ["planos"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "planos", filter: `id=eq.${plano.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["plano-detalhe", plano.id] });
          queryClient.invalidateQueries({ queryKey: ["planos"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, plano.id, plano.paciente_id, queryClient]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Sessões do Plano — {plano.pacientes?.nome || "Paciente"}
            </DialogTitle>
          </DialogHeader>

          {/* Credits summary */}
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Créditos do plano</span>
              <span className="font-bold">{plano.sessoes_utilizadas}/{plano.total_sessoes} utilizadas</span>
            </div>
            <Progress value={pct} className="h-2" />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>✅ Realizadas: {countByStatus.realizadas}</span>
              <span>📅 Agendadas: {countByStatus.pendentes}</span>
              <span className="font-medium text-primary">💳 Disponíveis: {Math.max(0, creditosDisponiveis)}</span>
            </div>
          </div>

          {/* Unified scheduling button */}
          {creditosDisponiveis > 0 ? (
            <Button
              className="w-full gap-2"
              onClick={() => setAgendarOpen(true)}
            >
              <CalendarPlus className="h-4 w-4" />
              Agendar Nova Sessão
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2 bg-muted/30 rounded-lg">
              Todos os créditos estão utilizados ou agendados.
            </div>
          )}

          {/* Sessions list with tabs */}
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="todas">Todas ({sessoes.length})</TabsTrigger>
                <TabsTrigger value="pendentes" className="text-xs">
                  Pendentes ({countByStatus.pendentes})
                </TabsTrigger>
                <TabsTrigger value="realizadas" className="text-xs">
                  Realizadas ({countByStatus.realizadas})
                </TabsTrigger>
                <TabsTrigger value="canceladas" className="text-xs">
                  Canc./Faltas ({countByStatus.canceladas})
                </TabsTrigger>
              </TabsList>

              <div className="mt-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : filteredSessoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma sessão {activeTab !== "todas" ? `com status "${activeTab}"` : "agendada ainda"}.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessoes.map((s: any, idx: number) => {
                        const sb = statusBadge[s.status] || statusBadge.agendado;
                        return (
                          <TableRow key={s.id} className={
                            s.status === "pendente" ? "bg-amber-50/50 dark:bg-amber-950/20" :
                            s.status === "cancelado" || s.status === "falta" ? "bg-destructive/5" : ""
                          }>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(s.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm">{s.profissional_nome ?? "—"}</TableCell>
                            <TableCell className="text-sm">{s.duracao_minutos} min</TableCell>
                            <TableCell><Badge variant={sb.variant}>{sb.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified scheduling form — same one used in main agenda */}
      <AgendamentoForm
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        onSuccess={handleAgendamentoSuccess}
        appointmentType="sessao_plano"
        defaultPlanoId={plano.id}
        defaultPacienteId={plano.paciente_id}
        defaultProfissionalId={plano.profissional_id}
      />
    </>
  );
};
