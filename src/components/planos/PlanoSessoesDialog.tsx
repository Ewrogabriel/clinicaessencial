import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Check, Clock, Eye, Calendar as CalendarIcon, Repeat, Video, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useScheduleSlots, useBookAppointment } from "@/modules/appointments/hooks/useAppointments";
import { cn } from "@/lib/utils";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/modules/shared/hooks/use-toast";

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
  const { activeClinicId } = useClinic();
  const restante = plano.total_sessoes - plano.sessoes_utilizadas;
  const pct = plano.total_sessoes > 0 ? Math.round((plano.sessoes_utilizadas / plano.total_sessoes) * 100) : 0;

  const [data, setData] = useState<Date | undefined>(new Date());
  const [horario, setHorario] = useState("");
  const [slotId, setSlotId] = useState("");
  const [duracao, setDuracao] = useState("50");
  const [tipoSessao, setTipoSessao] = useState("individual");
  const [observacoes, setObservacoes] = useState("");
  const [activeTab, setActiveTab] = useState("todas");
  const [repetir, setRepetir] = useState(false);
  const [repetirQuantidade, setRepetirQuantidade] = useState(4);
  const [isTeleconsulta, setIsTeleconsulta] = useState(false);
  const [isDomiciliar, setIsDomiciliar] = useState(false);
  const [selectedModality, setSelectedModality] = useState(plano.tipo_atendimento);
  const [selectedProfissionalId, setSelectedProfissionalId] = useState(plano.profissional_id);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthlyAvail, setMonthlyAvail] = useState<Record<number, number>>({});

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades"],
    queryFn: async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    }
  });

  const { data: profissionaisList = [] } = useQuery({
    queryKey: ["professionals-basic-plano"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome").order("nome");
      return data || [];
    }
  });

  const formattedDate = data ? format(data, "yyyy-MM-dd") : "";
  const { data: availableSlots, isLoading: isLoadingSlots } = useScheduleSlots({
    professionalId: selectedProfissionalId,
    date: formattedDate,
    clinicId: activeClinicId
  });

  const { data: monthSlots } = useQuery({
    queryKey: ["professional-month-slots", selectedProfissionalId, activeClinicId, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!selectedProfissionalId || !activeClinicId) return [];
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const { data } = await (supabase.rpc as any)("get_professional_vacancies", {
        p_professional_id: selectedProfissionalId,
        p_clinic_id: activeClinicId,
        p_start_date: format(start, "yyyy-MM-dd"),
        p_end_date: format(end, "yyyy-MM-dd")
      });
      return data || [];
    },
    enabled: !!plano.profissional_id && !!activeClinicId,
  });

  useEffect(() => {
    if (monthSlots) {
      const availMap: Record<number, number> = {};
      (monthSlots as any[]).forEach((s: any) => {
        const d = new Date(s.date);
        const day = new Date(d.getTime() + (d.getTimezoneOffset() * 60000)).getUTCDate();
        availMap[day] = s.total_vacancies;
      });
      setMonthlyAvail(availMap);
    }
  }, [monthSlots]);

  const bookAppointmentMutation = useBookAppointment();



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
      if (!data || !horario) throw new Error("Selecione data e horário");
      if (creditosDisponiveis <= 0) throw new Error("Sem créditos disponíveis");

      const [hours, minutes] = horario.split(":").map(Number);
      const baseDate = new Date(data);
      baseDate.setHours(hours, minutes, 0, 0);

      const sessaoCount = repetir ? Math.min(repetirQuantidade, creditosDisponiveis) : 1;
      
      if (repetir) {
        toast({ title: `Agendando ${sessaoCount} sessões...` });
      }

      for (let i = 0; i < sessaoCount; i++) {
        const targetDate = addWeeks(baseDate, i);
        
        let finalObs = observacoes;
        if (isTeleconsulta) finalObs = `[TELECONSULTA] ${finalObs}`.trim();
        if (isDomiciliar) finalObs = `[DOMICILIAR] ${finalObs}`.trim();

        const { error } = await supabase.from("agendamentos").insert({
          paciente_id: plano.paciente_id,
          profissional_id: plano.profissional_id,
          data_horario: targetDate.toISOString(),
          duracao_minutos: parseInt(duracao),
          tipo_atendimento: selectedModality,
          tipo_sessao: tipoSessao as any,
          status: "agendado" as any,
          observacoes: `${finalObs} | plano:${plano.id}`.trim(),
          forma_pagamento_id: formaPagamentoId || null,
          created_by: userId,
          clinic_id: activeClinicId,
        } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-sessoes", plano.id] });
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      setHorario("");
      setSlotId("");
      setObservacoes("");
      setRepetir(false);
      toast({ title: "Agendamento realizado com sucesso!" });
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
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !data && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {data ? format(data, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={data}
                      onSelect={(date) => {
                        setData(date);
                        if (date) setCurrentMonth(date);
                      }}
                      onMonthChange={setCurrentMonth}
                      locale={ptBR}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0
                      }
                      className="rounded-md border shadow-sm"
                      components={{
                        DayContent: ({ date }) => {
                          const vacancies = monthlyAvail[date.getDate()];
                          const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                          const isSunday = date.getDay() === 0;

                          return (
                            <div className="relative w-full h-full flex flex-col items-center justify-center">
                              <span>{date.getDate()}</span>
                              {activeClinicId && !isPast && !isSunday && (
                                <span className={cn(
                                  "text-[9px] mt-0.5 px-1 rounded-full",
                                  vacancies > 0 ? "bg-green-100 text-green-700 font-bold" : "bg-red-100 text-red-600"
                                )}>
                                  {vacancies || 0}v
                                </span>
                              )}
                            </div>
                          );
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Horário (Vagas)</Label>
                {availableSlots && availableSlots.length > 0 ? (
                  <Select
                    onValueChange={(val) => {
                      setSlotId(val);
                      const slot = availableSlots?.find((s: any) => s.id === val);
                      if (slot) setHorario(slot.start_time.slice(0, 5));
                    }}
                    value={slotId}
                    disabled={isLoadingSlots || !data}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={isLoadingSlots ? "Carregando..." : "Selecione"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSlots?.map((slot: any) => (
                        <SelectItem
                          key={slot.id}
                          value={slot.id}
                          disabled={slot.status === 'full'}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{slot.start_time.slice(0, 5)}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full border",
                              slot.status === 'full' ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"
                            )}>
                              {slot.current_capacity}/{slot.max_capacity}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="h-9"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Duração (min)</Label>
                <Select value={duracao} onValueChange={setDuracao}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="50">50 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tipo de Sessão</Label>
                <Select value={tipoSessao} onValueChange={setTipoSessao}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="grupo">Grupo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 text-form-label">
                <Label className="text-xs">Modalidade</Label>
                <Select value={selectedModality} onValueChange={setSelectedModality}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {modalidades.map((mod: any) => (
                      <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Forma de Pagamento (Ref.)</Label>
                <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {formasPagamento.map((fp: any) => (
                      <SelectItem key={fp.id} value={fp.id}>{fp.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <Label className="font-medium text-sm">Tipo de Consulta</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isTeleconsulta ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => {
                    setIsTeleconsulta(!isTeleconsulta);
                    if (!isTeleconsulta) setIsDomiciliar(false);
                  }}
                >
                  <Video className="h-4 w-4" />
                  Teleconsulta
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isDomiciliar ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => {
                    setIsDomiciliar(!isDomiciliar);
                    if (!isDomiciliar) setIsTeleconsulta(false);
                  }}
                >
                  <Home className="h-4 w-4" />
                  Consulta Domiciliar
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-md px-3 h-10">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Repetir (semanal)</span>
              </div>
              <Switch checked={repetir} onCheckedChange={setRepetir} />
            </div>

            {repetir && (
              <div className="flex items-center gap-3 p-2 bg-muted/40 rounded-md">
                <Label className="text-[10px] whitespace-nowrap">Repetir por</Label>
                <Input
                  type="number"
                  min={2}
                  max={creditosDisponiveis}
                  value={repetirQuantidade}
                  onChange={(e) => setRepetirQuantidade(Number(e.target.value))}
                  className="h-7 w-20 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">semanas</span>
              </div>
            )}
            
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Input 
                placeholder="Obs. adicionais..." 
                value={observacoes} 
                onChange={e => setObservacoes(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <Button
              className="w-full h-9"
              size="sm"
              onClick={() => agendarSessao.mutate()}
              disabled={!data || !horario || agendarSessao.isPending}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
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
