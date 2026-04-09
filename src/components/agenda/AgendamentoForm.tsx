import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addWeeks, setHours as setH, setMinutes as setM, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Video, Home, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TimeSlotCards, type TimeSlot } from "@/components/ui/time-slot-cards";
import { cn } from "@/lib/utils";
import { checkAvailability, getMonthlyAvailability, type AvailabilityCheckResult } from "@/lib/availabilityCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientCombobox } from "@/components/ui/patient-combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScheduleSlots, useBookAppointment } from "@/modules/appointments/hooks/useAppointments";
import { toast } from "sonner";

// Sub-components
import { formSchema, type FormData, type AgendamentoFormProps, DIAS_SEMANA } from "./agendamento-form/types";
import { useAgendamentoFormData } from "./agendamento-form/useAgendamentoFormData";
import { OverCapacityDialog } from "./agendamento-form/OverCapacityDialog";
import { PlanSelectorSection } from "./agendamento-form/PlanSelectorSection";
import { FinancialSection } from "./agendamento-form/FinancialSection";
import { RepeatSection } from "./agendamento-form/RepeatSection";
import { RecurrenceSection } from "./agendamento-form/RecurrenceSection";

export function AgendamentoForm({ open, onOpenChange, onSuccess, defaultDate, defaultProfissionalId, appointmentType }: AgendamentoFormProps) {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const [loading, setLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [monthlyAvail, setMonthlyAvail] = useState<Record<number, number>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [overCapacityPending, setOverCapacityPending] = useState<FormData | null>(null);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>("");

  const { pacientes, profissionais, modalidades, formasPagamento, planos } =
    useAgendamentoFormData(open, appointmentType === "sessao_plano", activeClinicId);

  const selectedPlano = planos.find(p => p.id === selectedPlanoId) ?? null;
  const planoSessoesRestantes = selectedPlano ? selectedPlano.total_sessoes - selectedPlano.sessoes_utilizadas : null;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      duracao_minutos: 60, tipo_atendimento: "", tipo_sessao: "grupo",
      horario: "", slot_id: "", observacoes: "",
      recorrente: false, dias_semana: [], frequencia_semanal: 1,
      recorrencia_semanas: 52, horarios_por_dia: {},
      valor_sessao: undefined, valor_mensal: undefined,
      repetir: false, repetir_tipo: "vezes", repetir_quantidade: 4,
    },
  });

  const watchedProfId = form.watch("profissional_id");
  const watchedDate = form.watch("data");
  const watchedHorario = form.watch("horario");
  const isRecorrente = form.watch("recorrente");
  const watchedTipoSessao = form.watch("tipo_sessao");

  const formattedDate = watchedDate ? format(watchedDate, "yyyy-MM-dd") : "";
  const { data: availableSlots, isLoading: isLoadingSlots } = useScheduleSlots({
    professionalId: watchedProfId,
    date: formattedDate,
    clinicId: activeClinicId,
  });
  const bookAppointmentMutation = useBookAppointment();

  // Monthly availability
  useEffect(() => {
    if (!watchedProfId) { setMonthlyAvail({}); return; }
    const fetchMonthly = async () => {
      const result = await getMonthlyAvailability(watchedProfId, currentMonth.getFullYear(), currentMonth.getMonth(), watchedHorario);
      setMonthlyAvail(result);
    };
    fetchMonthly();
  }, [watchedProfId, currentMonth, watchedHorario]);

  // Single-appointment availability check
  useEffect(() => {
    if (!watchedProfId || !watchedDate || !watchedHorario || isRecorrente) { setAvailabilityResult(null); return; }
    const timer = setTimeout(async () => {
      setCheckingAvailability(true);
      const [h, m] = watchedHorario.split(":").map(Number);
      const dt = new Date(watchedDate);
      dt.setHours(h, m, 0, 0);
      const result = await checkAvailability(watchedProfId, dt, watchedTipoSessao as 'individual' | 'grupo');
      setAvailabilityResult(result);
      setCheckingAvailability(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [watchedProfId, watchedDate, watchedHorario, isRecorrente, watchedTipoSessao]);

  useEffect(() => { if (defaultDate) form.setValue("data", defaultDate); }, [defaultDate, form]);
  useEffect(() => { if (open && defaultProfissionalId) form.setValue("profissional_id", defaultProfissionalId); }, [open, defaultProfissionalId, form]);
  useEffect(() => { if (!open) setSelectedPlanoId(""); }, [open]);

  const generateRecurringDates = (values: FormData): Date[] => {
    const dates: Date[] = [];
    if (!values.recorrente) return dates;
    const startDate = values.data;
    for (let week = 0; week < values.recorrencia_semanas; week++) {
      for (const dia of values.dias_semana) {
        const diaHorario = values.horarios_por_dia[String(dia)] || values.horario || "08:00";
        const [h, m] = diaHorario.split(":").map(Number);
        const weekStart = addWeeks(startDate, week);
        const dayOffset = (dia - weekStart.getDay() + 7) % 7;
        const targetDate = addDays(weekStart, dayOffset);
        if (targetDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
          dates.push(setM(setH(targetDate, h), m));
        }
      }
    }
    return Array.from(new Set(dates.map(d => d.toISOString()))).map(iso => new Date(iso)).sort((a, b) => a.getTime() - b.getTime());
  };

  const doSubmit = async (values: FormData) => {
    if (!user || !activeClinicId) return;
    setLoading(true);
    try {
      const formaPagamentoId = formasPagamento.find(f => f.nome.toLowerCase() === values.forma_pagamento?.toLowerCase())?.id;
      const basePayload = {
        paciente_id: values.paciente_id,
        profissional_id: values.profissional_id,
        duracao_minutos: values.duracao_minutos,
        tipo_atendimento: values.tipo_atendimento,
        tipo_sessao: values.tipo_sessao,
        observacoes: values.observacoes,
        created_by: user.id,
        clinic_id: activeClinicId,
        valor_sessao: values.valor_sessao,
        forma_pagamento: values.forma_pagamento,
        forma_pagamento_id: formaPagamentoId,
        data_vencimento: values.data_vencimento,
        slot_id: undefined,
      };

      if (values.recorrente) {
        const dates = generateRecurringDates(values);
        if (dates.length === 0) { toast.error("Nenhuma data gerada para a recorrência."); setLoading(false); return; }
        toast.info(`Agendando ${dates.length} sessões...`);
        for (const dt of dates) {
          await bookAppointmentMutation.mutateAsync({ ...basePayload, data_horario: dt.toISOString() } as any);
        }
        toast.success(`${dates.length} sessões agendadas com sucesso!`);
      } else if (values.repetir && values.repetir_quantidade > 1) {
        const [hours, minutes] = values.horario.split(":").map(Number);
        const startDate = new Date(values.data);
        startDate.setHours(hours, minutes, 0, 0);
        toast.info(`Agendando ${values.repetir_quantidade} sessões repetidas...`);
        for (let i = 0; i < values.repetir_quantidade; i++) {
          const targetDate = addWeeks(startDate, i);
          await bookAppointmentMutation.mutateAsync({ ...basePayload, data_horario: targetDate.toISOString() } as any);
        }
        toast.success(`${values.repetir_quantidade} sessões agendadas com sucesso!`);
      } else {
        const [hours, minutes] = values.horario.split(":").map(Number);
        const dataHorario = new Date(values.data);
        dataHorario.setHours(hours, minutes, 0, 0);
        await bookAppointmentMutation.mutateAsync({ ...basePayload, data_horario: dataHorario.toISOString() } as any);
        if (appointmentType === "sessao_plano" && selectedPlanoId && selectedPlano) {
          const { error: updateError } = await supabase.from("planos").update({ sessoes_utilizadas: selectedPlano.sessoes_utilizadas + 1 }).eq("id", selectedPlanoId);
          if (updateError) { console.error("Erro ao atualizar sessões do plano:", updateError); toast.error("Agendamento criado, mas não foi possível atualizar o contador do plano."); }
        }
        toast.success("Agendamento realizado com sucesso!");
      }
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar agendamento:", error);
      toast.error("Erro ao salvar agendamento: " + (error.message || "Tente novamente mais tarde"));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormData) => {
    if (!user) return;
    if (!activeClinicId) { toast.error("Selecione uma clínica antes de criar um agendamento."); return; }
    const isSingleAppointment = !values.recorrente && (!values.repetir || values.repetir_quantidade <= 1);
    if (isSingleAppointment && availabilityResult?.isOverCapacity) { setOverCapacityPending(values); return; }
    await doSubmit(values);
  };

  const isRepetir = form.watch("repetir");
  const repetirQuantidade = form.watch("repetir_quantidade");
  const diasSelecionados = form.watch("dias_semana");
  const freqSemanal = form.watch("frequencia_semanal");
  const previewCount = isRecorrente && diasSelecionados.length > 0 ? diasSelecionados.length * form.watch("recorrencia_semanas") : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[Plus_Jakarta_Sans]">
              {appointmentType === "sessao_plano" ? "Sessão do Plano" : "Nova Sessão Avulsa"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Plan selector */}
              {appointmentType === "sessao_plano" && (
                <PlanSelectorSection
                  planos={planos}
                  selectedPlanoId={selectedPlanoId}
                  onPlanoChange={(val) => {
                    setSelectedPlanoId(val);
                    const plano = planos.find(p => p.id === val);
                    if (plano) {
                      form.setValue("paciente_id", plano.paciente_id);
                      form.setValue("profissional_id", plano.profissional_id);
                      form.setValue("tipo_atendimento", plano.tipo_atendimento);
                    }
                  }}
                  selectedPlano={selectedPlano}
                  planoSessoesRestantes={planoSessoesRestantes}
                />
              )}

              {/* Patient */}
              <FormField
                control={form.control}
                name="paciente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente</FormLabel>
                    <FormControl>
                      <PatientCombobox
                        patients={pacientes}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={appointmentType === "sessao_plano" && !!selectedPlanoId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Professional */}
              <FormField
                control={form.control}
                name="profissional_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {profissionais.map((p) => (
                          <SelectItem key={p.id} value={p.user_id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date picker (single) */}
              {!isRecorrente && (
                <FormField
                  control={form.control}
                  name="data"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={ptBR}
                            selected={field.value}
                            onSelect={(date) => { field.onChange(date); if (date) setCurrentMonth(date); }}
                            onMonthChange={setCurrentMonth}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 0}
                            className="rounded-md border shadow-sm"
                            components={{
                              DayContent: ({ date }) => {
                                const vacancies = monthlyAvail[date.getDate()];
                                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                                const isSunday = date.getDay() === 0;
                                return (
                                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                                    <span>{date.getDate()}</span>
                                    {watchedProfId && !isPast && !isSunday && (
                                      <span className={cn("text-[9px] mt-0.5 px-1 rounded-full", vacancies > 0 ? "bg-green-100 text-green-700 font-bold" : "bg-red-100 text-red-600")}>
                                        {vacancies}v
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Time + Duration (single) */}
              {!isRecorrente && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Horário</Label>
                      {(!availableSlots || availableSlots.length === 0) && (
                        <FormField
                          control={form.control}
                          name="horario"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl><Input type="time" {...field} className="mt-1" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name="duracao_minutos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duração</FormLabel>
                          <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="50">50 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {availableSlots && availableSlots.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Selecione o horário</Label>
                      <TimeSlotCards
                        slots={availableSlots as TimeSlot[]}
                        selectedSlotId={form.watch("slot_id") || ""}
                        onSelect={(slot) => {
                          form.setValue("slot_id", slot.id);
                          form.setValue("horario", slot.start_time.slice(0, 5));
                        }}
                        isLoading={isLoadingSlots}
                        emptyMessage="Selecione data e profissional para ver horários"
                        disabled={!watchedDate || !watchedProfId}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Modality + Session type */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo_atendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {modalidades.map((mod) => (
                            <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_sessao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Sessão</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="grupo">Grupo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Consultation type toggle */}
              <div className="rounded-lg border p-4 space-y-3">
                <Label className="font-medium text-sm">Tipo de Consulta</Label>
                <div className="flex flex-wrap gap-2">
                  {[{ tag: "[TELECONSULTA]", icon: Video, label: "Teleconsulta", hint: "📹 Um link de teleconsulta será gerado para esta sessão." },
                    { tag: "[DOMICILIAR]", icon: Home, label: "Consulta Domiciliar", hint: "🏠 Esta sessão será realizada no domicílio do paciente." }
                  ].map(({ tag, icon: Icon, label, hint }) => {
                    const obs = form.watch("observacoes") || "";
                    const active = obs.includes(tag);
                    const otherTag = tag === "[TELECONSULTA]" ? "[DOMICILIAR]" : "[TELECONSULTA]";
                    return (
                      <div key={tag}>
                        <Button
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="gap-2"
                          onClick={() => {
                            if (active) form.setValue("observacoes", obs.replace(tag, "").trim());
                            else form.setValue("observacoes", `${tag} ${obs.replace(otherTag, "").trim()}`.trim());
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Button>
                        {active && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Availability alert (single) */}
              {availabilityResult && (
                <Alert variant={availabilityResult.isOverCapacity || (availabilityResult.currentCount > 0 && watchedTipoSessao === 'individual') ? "destructive" : "default"}>
                  <div className="flex items-center gap-2">
                    {availabilityResult.isOverCapacity || (availabilityResult.currentCount > 0 && watchedTipoSessao === 'individual')
                      ? <AlertTriangle className="h-4 w-4 text-destructive" />
                      : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    <AlertDescription>
                      {availabilityResult.currentCount > 0 && watchedTipoSessao === 'individual'
                        ? "⚠️ Este horário já possui pacientes agendados. Para sessão individual, o horário deve estar vazio."
                        : availabilityResult.message}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Financial (single) */}
              {!isRecorrente && appointmentType !== "sessao_plano" && (
                <FinancialSection form={form} formasPagamento={formasPagamento} />
              )}

              {/* Repeat section (single) */}
              {!isRecorrente && appointmentType !== "sessao_plano" && (
                <RepeatSection form={form} />
              )}

              {/* Recurrence section */}
              {appointmentType !== "sessao_plano" && (
                <RecurrenceSection
                  form={form}
                  formasPagamento={formasPagamento}
                  monthlyAvail={monthlyAvail}
                  currentMonth={currentMonth}
                  setCurrentMonth={setCurrentMonth}
                  watchedProfId={watchedProfId}
                />
              )}

              {/* Observations */}
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Observações sobre o agendamento..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Final availability alert */}
              {!isRecorrente && availabilityResult && (
                <Alert variant={availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity ? "default" : "destructive"} className="flex items-start gap-2">
                  {availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity
                    ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    : <AlertTriangle className="h-4 w-4 mt-0.5" />}
                  <AlertDescription className="text-sm">
                    {availabilityResult.message}
                    {availabilityResult.isOverCapacity && (
                      <span className="block text-xs mt-1 opacity-80">O agendamento será criado, mas excederá a capacidade configurada.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={loading || (appointmentType === "sessao_plano" && planoSessoesRestantes !== null && planoSessoesRestantes <= 0)}
                >
                  {loading ? "Salvando..." : isRecorrente ? `Agendar ${previewCount} sessões` : isRepetir ? `Agendar ${repetirQuantidade} sessões` : "Agendar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <OverCapacityDialog
        open={!!overCapacityPending}
        onCancel={() => setOverCapacityPending(null)}
        onConfirm={() => {
          if (overCapacityPending) {
            const pending = overCapacityPending;
            setOverCapacityPending(null);
            doSubmit(pending);
          }
        }}
        availabilityResult={availabilityResult}
      />
    </>
  );
}
