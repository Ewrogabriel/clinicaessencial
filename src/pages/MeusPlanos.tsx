import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2, CreditCard, FileText, CalendarPlus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMonthlyAvailability, checkAvailability, type AvailabilityCheckResult } from "@/lib/availabilityCheck";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useCrossBookingClinics } from "@/modules/appointments/hooks/useCrossBooking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/modules/shared/hooks/use-toast";

const MeusPlanos = () => {
  const { user, patientId } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("");
  const [duracao, setDuracao] = useState("50");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthlyAvail, setMonthlyAvail] = useState<Record<number, number>>({});
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
  const [selectedProfId, setSelectedProfId] = useState("");

  const { data: crossClinicIds = [] } = useCrossBookingClinics(activeClinicId);

  // All professionals for selection — includes cross-booking clinics
  const { data: allProfissionais = [] } = useQuery({
    queryKey: ["all-prof-for-scheduling", crossClinicIds],
    queryFn: async () => {
      if (crossClinicIds.length > 0) {
        // Get professionals from all linked clinics
        const { data: clinicUsers } = await (supabase.from("clinic_users") as any)
          .select("user_id")
          .in("clinic_id", crossClinicIds);
        const userIds = clinicUsers?.map((cu: any) => cu.user_id) ?? [];
        if (!userIds.length) {
          const { data } = await supabase.from("profiles").select("user_id, nome").order("nome");
          return data ?? [];
        }
        const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", userIds).order("nome");
        return data ?? [];
      }
      const { data } = await supabase.from("profiles").select("user_id, nome").order("nome");
      return data ?? [];
    },
  });

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

  // Generate hourly time options (7:00 to 21:00)
  const hourlyOptions = Array.from({ length: 15 }, (_, i) => {
    const h = 7 + i;
    return `${String(h).padStart(2, "0")}:00`;
  });

  // Fetch monthly availability when professional/time changes or month changes
  const activeProfId = selectedProfId || selectedPlano?.profissional_id;

  useEffect(() => {
    if (!activeProfId) {
      setMonthlyAvail({});
      return;
    }
    const fetchMonthly = async () => {
      const result = await getMonthlyAvailability(
        activeProfId,
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        selectedTime || undefined
      );
      setMonthlyAvail(result);
    };
    fetchMonthly();
  }, [activeProfId, currentMonth, selectedTime]);

  // Check availability when date and time are selected


  // Check availability when time is selected
  useEffect(() => {
    if (!activeProfId || !selectedDate || !selectedTime) {
      setAvailabilityResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      const [h, m] = selectedTime.split(":").map(Number);
      const dt = new Date(selectedDate);
      dt.setHours(h, m, 0, 0);
      const result = await checkAvailability(activeProfId, dt);
      setAvailabilityResult(result);
    }, 200);
    return () => clearTimeout(timer);
  }, [activeProfId, selectedDate, selectedTime]);

  const solicitarAgendamento = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime || !selectedPlano || !patientId) throw new Error("Dados incompletos");
      
      const sessoesAgendadas = sessoesPlan.filter((s: any) => ["agendado", "confirmado"].includes(s.status)).length;
      const restante = selectedPlano.total_sessoes - selectedPlano.sessoes_utilizadas;
      if (sessoesAgendadas >= restante) throw new Error("Sem créditos disponíveis");

      const [h, m] = selectedTime.split(":").map(Number);
      const dataHorario = new Date(selectedDate);
      dataHorario.setHours(h, m, 0, 0);

      // Create the appointment with "pendente" status
      const { data: agendamento, error } = await supabase.from("agendamentos").insert({
        paciente_id: patientId,
        profissional_id: activeProfId || selectedPlano.profissional_id,
        data_horario: dataHorario.toISOString(),
        duracao_minutos: parseInt(duracao),
        tipo_atendimento: selectedPlano.tipo_atendimento,
        tipo_sessao: "individual",
        status: "pendente" as any,
        observacoes: `plano:${selectedPlano.id}`,
        created_by: user!.id,
        clinic_id: activeClinicId,
      }).select("id").single();
      if (error) throw error;

      // Notify admin with agendamento_id in metadata
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notificacoes").insert(
          admins.map((a) => ({
            user_id: a.user_id,
            tipo: "agendamento_plano",
            titulo: "Solicitação de agendamento",
            resumo: `Paciente solicitou agendamento para ${format(dataHorario, "dd/MM HH:mm")}`,
            metadata: { agendamento_id: agendamento.id, paciente_id: patientId },
            link: "/agenda",
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessoes-plano-paciente"] });
      queryClient.invalidateQueries({ queryKey: ["meus-planos"] });
      setAgendarOpen(false);
      setSelectedDate(undefined);
      setSelectedTime("");
      setAvailabilityResult(null);
      toast({ title: "Solicitação enviada!", description: "Aguarde a aprovação do administrador." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const planoAtivo = planos.find((p: any) => p.status === "ativo");
  const matriculaAtiva = matriculas.find((m: any) => m.status === "ativa");

  // Fetch scheduled sessions for active plan to show correct available credits
  const { data: sessoesAtivas = [] } = useQuery({
    queryKey: ["sessoes-ativas-plano", planoAtivo?.id],
    queryFn: async () => {
      if (!planoAtivo?.id || !patientId) return [];
      const { data } = await supabase
        .from("agendamentos")
        .select("id, status")
        .eq("paciente_id", patientId)
        .in("status", ["agendado", "confirmado", "pendente"] as any[])
        .ilike("observacoes", `%plano:${planoAtivo.id}%`);
      return data || [];
    },
    enabled: !!planoAtivo?.id && !!patientId,
  });
  const creditosReais = planoAtivo ? planoAtivo.total_sessoes - planoAtivo.sessoes_utilizadas - sessoesAtivas.length : 0;



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
    setSelectedProfId(plano.profissional_id);
    setSelectedDate(undefined);
    setSelectedTime("");
    setAvailabilityResult(null);
    setAgendarOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meus Planos e Matrículas</h1>
        <p className="text-muted-foreground">Acompanhe seus planos de sessões e matrículas ativas</p>
      </div>

      {planos.length === 0 && matriculas.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você não possui plano ou matrícula. Entre em contato com a clínica.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs: all plans and enrollments without duplication */}
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
          <div className="space-y-3">
            {planos.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Nenhum plano encontrado</CardContent>
              </Card>
            ) : (
              planos.map((plano: any) => {
                const st = statusPlano[plano.status] || statusPlano.ativo;
                const isAtivo = plano.status === "ativo";
                const sessAtivas = isAtivo && plano.id === planoAtivo?.id ? sessoesAtivas.length : 0;
                const restante = plano.total_sessoes - plano.sessoes_utilizadas - sessAtivas;
                return (
                  <Card key={plano.id} className={isAtivo ? "border-primary/40 bg-primary/5" : ""}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold capitalize text-base">{plano.tipo_atendimento}</p>
                          <p className="text-sm text-muted-foreground">{plano.profiles?.nome || "N/A"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          {isAtivo && (
                            <p className="text-2xl font-bold text-primary mt-1">{Math.max(0, restante)}</p>
                          )}
                          {isAtivo && <p className="text-xs text-muted-foreground">sess. disponíveis</p>}
                          {isAtivo && sessAtivas > 0 && (
                            <p className="text-xs text-muted-foreground">{sessAtivas} agendadas</p>
                          )}
                        </div>
                      </div>
                      {isAtivo && (
                        <Progress
                          value={((plano.sessoes_utilizadas + sessAtivas) / plano.total_sessoes) * 100}
                          className="h-2"
                        />
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Sessões</p>
                          <p>{plano.sessoes_utilizadas}/{plano.total_sessoes}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valor</p>
                          <p>R$ {Number(plano.valor).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Início</p>
                          <p>{format(new Date(plano.data_inicio), "dd/MM/yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Vencimento</p>
                          <p>{plano.data_vencimento ? format(new Date(plano.data_vencimento), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </div>
                      {isAtivo && restante > 0 && (
                        <Button className="w-full gap-2" size="sm" onClick={() => openAgendar(plano)}>
                          <CalendarPlus className="h-4 w-4" /> Agendar Consulta
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="matriculas" className="mt-4">
          <div className="space-y-3">
            {matriculas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">Nenhuma matrícula encontrada</CardContent>
              </Card>
            ) : (
              matriculas.map((m: any) => {
                const st = statusMatricula[m.status] || statusMatricula.ativa;
                const isAtiva = m.status === "ativa";
                return (
                  <Card key={m.id} className={isAtiva ? "border-primary/40 bg-primary/5" : ""}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold capitalize text-base">{m.tipo_atendimento}</p>
                          <p className="text-sm text-muted-foreground">
                            {m.tipo === "mensal" ? "Mensal" : m.tipo} •{" "}
                            Prof.: {(profMap as Record<string, string>)[m.profissional_id] || "N/A"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          <p className="text-xl font-bold text-primary mt-1">
                            R$ {Number(m.valor_mensal).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm border-t pt-3">
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
                        {m.desconto > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Desconto</p>
                            <p className="text-green-600 font-medium">{m.desconto}%</p>
                          </div>
                        )}
                      </div>
                      {m.observacoes && (
                        <p className="text-xs text-muted-foreground">{m.observacoes}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Agendar Dialog */}
      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
                <p><strong>Profissional padrão:</strong> {selectedPlano.profiles?.nome || "N/A"}</p>
                <p><strong>Créditos restantes:</strong> {selectedPlano.total_sessoes - selectedPlano.sessoes_utilizadas}</p>
              </div>

              {/* Step 0: Select professional */}
              <div>
                <Label className="mb-2 block">1. Selecione o profissional</Label>
                <Select value={selectedProfId} onValueChange={(v) => {
                  setSelectedProfId(v);
                  setSelectedTime("");
                  setSelectedDate(undefined);
                  setAvailabilityResult(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProfissionais.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nome} {p.user_id === selectedPlano?.profissional_id ? "(padrão)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 1: Select time */}
              {/* Step 2: Calendar with availability (shown when professional is selected) */}
              {selectedProfId && (
                <div>
                  <Label className="mb-2 block">2. Selecione a data</Label>
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    onMonthChange={setCurrentMonth}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    className={cn("rounded-md border shadow-sm pointer-events-auto")}
                    components={{
                      DayContent: ({ date: dayDate }) => {
                        const vacancies = monthlyAvail[dayDate.getDate()];
                        const isPast = dayDate < new Date(new Date().setHours(0, 0, 0, 0));
                        const isCurrentMonth = dayDate.getMonth() === currentMonth.getMonth();

                        return (
                          <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <span>{dayDate.getDate()}</span>
                            {isCurrentMonth && !isPast && !!activeProfId && (
                              <span className={cn(
                                "text-[9px] mt-0.5 px-1 rounded-full",
                                vacancies && vacancies > 0
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold"
                                  : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              )}>
                                {vacancies ?? 0}v
                              </span>
                            )}
                          </div>
                        );
                      }
                    }}
                  />
                </div>
              )}

              {/* Step 3: Time selection (shown after date is selected) */}
              {selectedDate && (
              <div>
                <Label className="mb-2 block">3. Selecione o horário</Label>
                <div className="flex flex-wrap gap-2">
                  {hourlyOptions.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      size="sm"
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => {
                        setSelectedTime(time);
                        setAvailabilityResult(null);
                      }}
                      className="text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
              )}

              {/* Availability check result */}
              {availabilityResult && (
                <Alert variant={availabilityResult.isOverCapacity ? "destructive" : "default"}>
                  <div className="flex items-center gap-2">
                    {availabilityResult.isOverCapacity ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    <AlertDescription>{availabilityResult.message}</AlertDescription>
                  </div>
                </Alert>
              )}

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
                  disabled={!selectedDate || !selectedTime || solicitarAgendamento.isPending}
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
