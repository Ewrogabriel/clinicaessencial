import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, AlertCircle, CheckCircle2, CreditCard, FileText, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

const MeusPlanos = () => {
  const { user, patientId } = useAuth();
  const queryClient = useQueryClient();
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<any>(null);
  const [dataHorario, setDataHorario] = useState("");
  const [duracao, setDuracao] = useState("50");

  // Planos de sessões
  const { data: planos = [] } = useQuery({
    queryKey: ["meus-planos", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("planos")
        .select("*, profiles(nome)")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  // Matrículas
  const { data: matriculas = [] } = useQuery({
    queryKey: ["minhas-matriculas", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data, error } = await supabase
        .from("matriculas")
        .select("*, pacientes(nome)")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  // Profissional names for matrículas
  const { data: profMap = {} } = useQuery({
    queryKey: ["prof-names-matriculas", matriculas],
    queryFn: async () => {
      const profIds = [...new Set(matriculas.map((m: any) => m.profissional_id))];
      if (profIds.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.nome; });
      return map;
    },
    enabled: matriculas.length > 0,
  });

  // Disponibilidade do profissional for scheduling
  const { data: disponibilidade = [] } = useQuery({
    queryKey: ["disp-prof-agendar", selectedPlano?.profissional_id],
    queryFn: async () => {
      if (!selectedPlano?.profissional_id) return [];
      const { data } = await supabase
        .from("disponibilidade_profissional")
        .select("*")
        .eq("profissional_id", selectedPlano.profissional_id)
        .eq("ativo", true)
        .order("dia_semana");
      return data || [];
    },
    enabled: !!selectedPlano?.profissional_id,
  });

  // Sessions for selected plan
  const { data: sessoesPlan = [] } = useQuery({
    queryKey: ["sessoes-plano-paciente", selectedPlano?.id],
    queryFn: async () => {
      if (!selectedPlano?.id) return [];
      const { data } = await supabase
        .from("agendamentos")
        .select("id, data_horario, duracao_minutos, status")
        .eq("paciente_id", patientId!)
        .ilike("observacoes", `%plano:${selectedPlano.id}%`)
        .order("data_horario", { ascending: true });
      return data || [];
    },
    enabled: !!selectedPlano?.id && !!patientId,
  });

  const solicitarAgendamento = useMutation({
    mutationFn: async () => {
      if (!dataHorario || !selectedPlano || !patientId) throw new Error("Dados incompletos");
      
      const sessoesAgendadas = sessoesPlan.filter((s: any) => ["agendado", "confirmado"].includes(s.status)).length;
      const restante = selectedPlano.total_sessoes - selectedPlano.sessoes_utilizadas;
      if (sessoesAgendadas >= restante) throw new Error("Sem créditos disponíveis");

      // Create the appointment
      const { error } = await supabase.from("agendamentos").insert({
        paciente_id: patientId,
        profissional_id: selectedPlano.profissional_id,
        data_horario: new Date(dataHorario).toISOString(),
        duracao_minutos: parseInt(duracao),
        tipo_atendimento: selectedPlano.tipo_atendimento,
        tipo_sessao: "individual",
        status: "agendado",
        observacoes: `plano:${selectedPlano.id}`,
        created_by: user!.id,
      });
      if (error) throw error;

      // Notify admin
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notificacoes").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            tipo: "agendamento_plano",
            titulo: "Agendamento via plano",
            resumo: `Paciente solicitou agendamento para ${format(new Date(dataHorario), "dd/MM HH:mm")}`,
            link: "/agenda",
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessoes-plano-paciente"] });
      queryClient.invalidateQueries({ queryKey: ["meus-planos"] });
      setAgendarOpen(false);
      setDataHorario("");
      toast({ title: "Sessão agendada com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const planoAtivo = planos.find((p: any) => p.status === "ativo");
  const matriculaAtiva = matriculas.find((m: any) => m.status === "ativa");

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const statusPlano: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ativo: { label: "Ativo", variant: "default" },
    vencido: { label: "Vencido", variant: "destructive" },
    finalizado: { label: "Finalizado", variant: "secondary" },
    cancelado: { label: "Cancelado", variant: "outline" },
  };

  const statusMatricula: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ativa: { label: "Ativa", variant: "default" },
    suspensa: { label: "Suspensa", variant: "outline" },
    cancelada: { label: "Cancelada", variant: "destructive" },
    vencida: { label: "Vencida", variant: "destructive" },
  };

  const openAgendar = (plano: any) => {
    setSelectedPlano(plano);
    setDataHorario("");
    setAgendarOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus Planos e Matrículas</h1>
        <p className="text-muted-foreground">Acompanhe seus planos de sessões e matrículas ativas</p>
      </div>

      {/* Active plan highlight */}
      {planoAtivo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plano Ativo</p>
                  <p className="text-2xl font-bold capitalize">{planoAtivo.tipo_atendimento}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-primary">
                    {planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas}
                  </p>
                  <p className="text-sm text-muted-foreground">Sessões disponíveis</p>
                </div>
              </div>
              <Progress
                value={(planoAtivo.sessoes_utilizadas / planoAtivo.total_sessoes) * 100}
                className="h-3"
              />
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Profissional</p>
                  <p className="font-medium">{planoAtivo.profiles?.nome || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {planoAtivo.data_vencimento
                      ? format(new Date(planoAtivo.data_vencimento), "dd/MM/yyyy")
                      : "Sem data"}
                  </p>
                </div>
              </div>
              {(planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas) > 0 && (
                <Button className="w-full gap-2" onClick={() => openAgendar(planoAtivo)}>
                  <CalendarPlus className="h-4 w-4" />
                  Agendar Consulta
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active matrícula highlight */}
      {matriculaAtiva && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matrícula Ativa</p>
                <p className="text-xl font-bold capitalize">{matriculaAtiva.tipo_atendimento}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {matriculaAtiva.tipo === "mensal" ? "Mensal" : matriculaAtiva.tipo} • 
                  Profissional: {(profMap as Record<string,string>)[matriculaAtiva.profissional_id] || "N/A"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  R$ {Number(matriculaAtiva.valor_mensal).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">/mês</p>
                {matriculaAtiva.desconto > 0 && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {matriculaAtiva.desconto}% desconto
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-3 mt-3 border-t text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="font-medium">{format(new Date(matriculaAtiva.data_inicio), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="font-medium">
                  {matriculaAtiva.data_vencimento
                    ? format(new Date(matriculaAtiva.data_vencimento), "dd/MM/yyyy")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dia pgto</p>
                <p className="font-medium">Todo dia {matriculaAtiva.due_day}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!planoAtivo && !matriculaAtiva && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você não possui plano ou matrícula ativa. Entre em contato com a clínica.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for history */}
      <Tabs defaultValue="planos">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="planos" className="gap-2">
            <CreditCard className="h-4 w-4" /> Planos ({planos.length})
          </TabsTrigger>
          <TabsTrigger value="matriculas" className="gap-2">
            <FileText className="h-4 w-4" /> Matrículas ({matriculas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Planos</CardTitle>
            </CardHeader>
            <CardContent>
              {planos.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum plano encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Profissional</TableHead>
                        <TableHead>Sessões</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {planos.map((plano: any) => {
                        const st = statusPlano[plano.status] || statusPlano.ativo;
                        const restante = plano.total_sessoes - plano.sessoes_utilizadas;
                        return (
                          <TableRow key={plano.id}>
                            <TableCell className="capitalize font-medium">{plano.tipo_atendimento}</TableCell>
                            <TableCell>{plano.profiles?.nome || "N/A"}</TableCell>
                            <TableCell>
                              {plano.sessoes_utilizadas}/{plano.total_sessoes}
                              <span className="text-xs text-muted-foreground ml-1">({restante} rest.)</span>
                            </TableCell>
                            <TableCell>R$ {Number(plano.valor).toFixed(2)}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(plano.data_inicio), "dd/MM/yy")}
                              {plano.data_vencimento && ` — ${format(new Date(plano.data_vencimento), "dd/MM/yy")}`}
                            </TableCell>
                            <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                            <TableCell className="text-right">
                              {plano.status === "ativo" && restante > 0 && (
                                <Button size="sm" variant="outline" onClick={() => openAgendar(plano)}>
                                  <CalendarPlus className="h-4 w-4 mr-1" /> Agendar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matriculas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Minhas Matrículas</CardTitle>
            </CardHeader>
            <CardContent>
              {matriculas.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma matrícula encontrada</p>
              ) : (
                <div className="space-y-3">
                  {matriculas.map((m: any) => {
                    const st = statusMatricula[m.status] || statusMatricula.ativa;
                    return (
                      <div key={m.id} className="p-4 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium capitalize">{m.tipo_atendimento}</p>
                            <p className="text-sm text-muted-foreground">
                              {m.tipo === "mensal" ? "Mensal" : m.tipo} • 
                              Prof.: {(profMap as Record<string,string>)[m.profissional_id] || "N/A"}
                            </p>
                          </div>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Valor</p>
                            <p className="font-medium">R$ {Number(m.valor_mensal).toFixed(2)}/mês</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Início</p>
                            <p>{format(new Date(m.data_inicio), "dd/MM/yyyy")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Vencimento</p>
                            <p>{m.data_vencimento ? format(new Date(m.data_vencimento), "dd/MM/yyyy") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Dia pgto</p>
                            <p>Todo dia {m.due_day}</p>
                          </div>
                        </div>
                        {m.desconto > 0 && (
                          <p className="text-xs text-green-600">Desconto: {m.desconto}%</p>
                        )}
                        {m.observacoes && (
                          <p className="text-xs text-muted-foreground">{m.observacoes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agendar Dialog */}
      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              Agendar Sessão
            </DialogTitle>
          </DialogHeader>
          {selectedPlano && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30 text-sm space-y-1">
                <p><strong>Plano:</strong> <span className="capitalize">{selectedPlano.tipo_atendimento}</span></p>
                <p><strong>Profissional:</strong> {selectedPlano.profiles?.nome || "N/A"}</p>
                <p><strong>Créditos restantes:</strong> {selectedPlano.total_sessoes - selectedPlano.sessoes_utilizadas}</p>
              </div>

              {disponibilidade.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Horários disponíveis do profissional:</p>
                  <div className="flex flex-wrap gap-1">
                    {disponibilidade.map((d: any) => (
                      <Badge key={d.id} variant="outline" className="text-xs">
                        {diasSemana[d.dia_semana]} {d.hora_inicio}–{d.hora_fim}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Data e horário</Label>
                <Input
                  type="datetime-local"
                  value={dataHorario}
                  onChange={(e) => setDataHorario(e.target.value)}
                />
              </div>
              <div>
                <Label>Duração</Label>
                <Select value={duracao} onValueChange={setDuracao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="50">50 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setAgendarOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => solicitarAgendamento.mutate()}
                  disabled={!dataHorario || solicitarAgendamento.isPending}
                >
                  {solicitarAgendamento.isPending ? "Agendando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeusPlanos;
