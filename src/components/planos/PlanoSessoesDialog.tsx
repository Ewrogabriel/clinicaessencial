import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Check, Clock, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

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
};

export const PlanoSessoesDialog = ({ open, onOpenChange, plano, userId }: PlanoSessoesDialogProps) => {
  const queryClient = useQueryClient();
  const restante = plano.total_sessoes - plano.sessoes_utilizadas;
  const pct = plano.total_sessoes > 0 ? Math.round((plano.sessoes_utilizadas / plano.total_sessoes) * 100) : 0;

  const [dataHorario, setDataHorario] = useState("");
  const [duracao, setDuracao] = useState("50");
  const [activeTab, setActiveTab] = useState("todas");

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ["plano-sessoes", plano.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data_horario, duracao_minutos, status, tipo_atendimento, observacoes")
        .eq("paciente_id", plano.paciente_id)
        .eq("profissional_id", plano.profissional_id)
        .ilike("observacoes", `%plano:${plano.id}%`)
        .order("data_horario", { ascending: true });
      if (error) throw error;
      return data || [];
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

  const agendarSessao = useMutation({
    mutationFn: async () => {
      if (!dataHorario) throw new Error("Selecione data e horário");
      if (creditosDisponiveis <= 0) throw new Error("Sem créditos disponíveis");

      const { error } = await supabase.from("agendamentos").insert({
        paciente_id: plano.paciente_id,
        profissional_id: plano.profissional_id,
        data_horario: new Date(dataHorario).toISOString(),
        duracao_minutos: parseInt(duracao),
        tipo_atendimento: plano.tipo_atendimento,
        tipo_sessao: "individual",
        status: "agendado",
        observacoes: `plano:${plano.id}`,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-sessoes", plano.id] });
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      setDataHorario("");
      toast({ title: "Sessão agendada com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const countByStatus = {
    pendentes: sessoes.filter(s => ["pendente", "agendado", "confirmado"].includes(s.status)).length,
    realizadas: sessoes.filter(s => s.status === "realizado").length,
    canceladas: sessoes.filter(s => s.status === "cancelado" || s.status === "falta").length,
  };

  return (
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
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>✅ Realizadas: {countByStatus.realizadas}</span>
            <span>📅 Agendadas: {countByStatus.pendentes}</span>
            <span className="font-medium text-primary">💳 Disponíveis: {Math.max(0, creditosDisponiveis)}</span>
          </div>
        </div>

        {/* Schedule new session */}
        {creditosDisponiveis > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium text-sm">Agendar nova sessão</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data e horário</Label>
                <Input
                  type="datetime-local"
                  value={dataHorario}
                  onChange={(e) => setDataHorario(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Select value={duracao} onValueChange={setDuracao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="50">50 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => agendarSessao.mutate()}
              disabled={!dataHorario || agendarSessao.isPending}
            >
              {agendarSessao.isPending ? "Agendando..." : "Agendar Sessão"}
            </Button>
          </div>
        )}

        {creditosDisponiveis <= 0 && (
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
  );
};
