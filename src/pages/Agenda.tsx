import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, FileDown, Filter, UserPlus, CalendarCheck, ListChecks } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAgendamentos, useUpdateAgendamentoStatus, useAgendamentoCheckin, useRescheduleAgendamento, useScheduleSlots } from "@/modules/appointments/hooks/useAppointments";
import { useProfissionaisBasic, buildProfColorMap } from "@/modules/professionals/hooks/useProfessionals";
import { usePacienteByUserId } from "@/modules/patients/hooks/usePacientes";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { AppointmentDetailDialog } from "@/components/agenda/AppointmentDetailDialog";
import { DailyView, WeeklyView, MonthlyView, CalendarLegend, type Agendamento } from "@/components/agenda/AgendaViews";
import { generateWeeklyPDF } from "@/lib/generateAgendaPDF";
import { toast } from "@/modules/shared/hooks/use-toast";
import { usePersistedFilter } from "@/modules/shared/hooks/usePersistedFilter";
import { LazyLoadFallback } from "@/components/LazyLoadFallback";

const VacancyCalendar = lazy(() => import("./VacancyCalendar"));
const ListaEspera = lazy(() => import("./ListaEspera"));

type ViewMode = "diario" | "semanal" | "mensal";

const Agenda = () => {
  const { user, isPatient, isAdmin, isGestor, isProfissional } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = usePersistedFilter<ViewMode>("agenda-view", "semanal");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAg, setRescheduleAg] = useState<Agendamento | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAg, setDetailAg] = useState<Agendamento | null>(null);
  const [filterProfId, setFilterProfId] = usePersistedFilter("agenda-prof", "all");
  const [filterStatus, setFilterStatus] = usePersistedFilter("agenda-status", "all");

  const isStaff = isAdmin || isGestor;
  const canSeeAllTabs = isStaff || isProfissional;
  const canSeeAllProfessionals = isStaff || isProfissional;

  // Fetch professionals
  const { data: profissionais = [] } = useProfissionaisBasic({ enabled: canSeeAllProfessionals });
  const profColors = buildProfColorMap(profissionais);

  // Fetch patient data if current user is a patient
  const { data: patientData } = usePacienteByUserId(isPatient ? user?.id : undefined);

  // Compute date range for the current view so the query is scoped to the
  // visible period and Supabase's default row limit never hides sessions.
  const { dateStart, dateEnd } = useMemo(() => {
    if (viewMode === "diario") {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { dateStart: start.toISOString(), dateEnd: end.toISOString() };
    }
    if (viewMode === "semanal") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      start.setHours(0, 0, 0, 0);
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      end.setHours(23, 59, 59, 999);
      return { dateStart: start.toISOString(), dateEnd: end.toISOString() };
    }
    // mensal: include the extra days shown at the edges of the month grid
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    start.setHours(0, 0, 0, 0);
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    end.setHours(23, 59, 59, 999);
    return { dateStart: start.toISOString(), dateEnd: end.toISOString() };
  }, [viewMode, currentDate]);

  // Fetch agendamentos
  const { data: agendamentosData = [], refetch: refetchAgendamentos } = useAgendamentos({
    pacienteId: isPatient ? patientData?.id : undefined,
    enabled: !isPatient || !!patientData?.id,
    dateStart,
    dateEnd,
  });

  // Fetch slots for capacity display
  const { data: scheduleSlots = [], refetch: refetchSlots } = useScheduleSlots({
    professionalId: filterProfId === "all" ? undefined : filterProfId,
    date: viewMode === "semanal"
      ? format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : format(currentDate, "yyyy-MM-dd"),
    clinicId: activeClinicId
  });

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('agenda-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_slots' },
        () => { refetchSlots(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => { refetchAgendamentos(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchSlots, refetchAgendamentos]);

  // Build display data
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientesMap, setPacientesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const mapped: Agendamento[] = agendamentosData.map((item) => ({
      ...item,
      observacoes: item.observacoes ?? null,
      pacientes: item.pacientes,
      profiles: { nome: profissionais.find((p) => p.user_id === item.profissional_id)?.nome || "Profissional" },
    } as Agendamento));
    setAgendamentos(mapped);

    const telMap: Record<string, string> = {};
    agendamentosData.forEach((item) => {
      if (item.paciente_id && item.pacientes?.telefone) {
        telMap[item.paciente_id] = item.pacientes.telefone;
      }
    });
    setPacientesMap(telMap);
  }, [agendamentosData, profissionais]);

  // Mutations
  const cancelMutation = useUpdateAgendamentoStatus();
  const checkinMutation = useAgendamentoCheckin();
  const rescheduleMutation = useRescheduleAgendamento();

  // Apply filters
  const filteredAgendamentos = agendamentos.filter(ag => {
    const matchProf = filterProfId === "all" || ag.profissional_id === filterProfId;
    const matchStatus = filterStatus === "all" || ag.status === filterStatus;
    return matchProf && matchStatus;
  });

  const handleAppointmentClick = (ag: Agendamento) => { setDetailAg(ag); setDetailOpen(true); };
  const handleReschedule = (ag: Agendamento) => { setRescheduleAg(ag); setRescheduleOpen(true); };
  const handleSlotClick = (date: Date) => { if (!isPatient || isAdmin || isGestor || isProfissional) { setSelectedDate(date); setFormOpen(true); } };
  const handleNewAgendamento = () => { setSelectedDate(new Date()); setFormOpen(true); };

  const handleExportPDF = () => {
    const agsWithTel = filteredAgendamentos.map((ag) => ({ ...ag, paciente_telefone: pacientesMap[ag.paciente_id] || "" }));
    const profName = filterProfId !== "all" ? profissionais.find((p) => p.user_id === filterProfId)?.nome : undefined;
    generateWeeklyPDF(agsWithTel, currentDate, pacientesMap, profName);
    toast({ title: "PDF gerado!", description: profName ? `Agenda de ${profName} exportada.` : "Agenda completa exportada." });
  };

  const handleCancelAppointment = async (id: string) => {
    cancelMutation.mutate({ id, status: "cancelado" }, {
      onSuccess: () => { toast({ title: "Agendamento cancelado" }); refetchAgendamentos(); },
      onError: () => { toast({ title: "Erro ao cancelar", variant: "destructive" }); },
    });
  };

  const handleCheckin = async (id: string, type: "paciente" | "profissional") => {
    checkinMutation.mutate({ id, type }, { onSuccess: () => refetchAgendamentos() });
  };

  const handleDragDrop = async (agId: string, newDate: Date) => {
    // Use the appointment's own profissional_id for the double-booking check,
    // not the currently logged-in user's ID (which may be an admin, not the professional).
    const ag = agendamentos.find((a) => a.id === agId);
    const profissionalId = ag?.profissional_id || user?.id || "";
    rescheduleMutation.mutate({ id: agId, newDate, profissionalId }, {
      onSuccess: () => { toast({ title: "Sessão reagendada! 📅", description: format(newDate, "dd/MM/yyyy 'às' HH:mm") }); refetchAgendamentos(); },
    });
  };

  const navigatePrev = () => {
    if (viewMode === "diario") setCurrentDate((d) => subDays(d, 1));
    else if (viewMode === "semanal") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === "diario") setCurrentDate((d) => addDays(d, 1));
    else if (viewMode === "semanal") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (viewMode === "diario") return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    return format(currentDate, "MMMM yyyy", { locale: ptBR });
  };

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "agenda";
  const [mainTab, setMainTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Minha Agenda" : "Agenda"}</h1>
        {(!isPatient || isGestor || isAdmin || isProfissional) && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exportar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/matriculas?nova=1")}>
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Nova Matrícula</span>
              <span className="sm:hidden">Matrícula</span>
            </Button>
            <Button size="sm" onClick={handleNewAgendamento}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Novo Agendamento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        )}
      </div>

      {canSeeAllTabs && (
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="agenda" className="gap-1.5">Agenda</TabsTrigger>
            <TabsTrigger value="vagas" className="gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Vagas</TabsTrigger>
            <TabsTrigger value="lista-espera" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Lista de Espera</TabsTrigger>
          </TabsList>

          <TabsContent value="vagas" className="mt-4">
            <Suspense fallback={<LazyLoadFallback />}>
              <VacancyCalendar />
            </Suspense>
          </TabsContent>
          <TabsContent value="lista-espera" className="mt-4">
            <Suspense fallback={<LazyLoadFallback />}>
              <ListaEspera />
            </Suspense>
          </TabsContent>
        </Tabs>
      )}

      {(mainTab === "agenda" || !canSeeAllTabs) && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="icon" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={goToToday}>Hoje</Button>
              <Button variant="outline" size="icon" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-base sm:text-lg font-semibold capitalize">{getTitle()}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canSeeAllProfessionals && (
                <Select value={filterProfId} onValueChange={setFilterProfId}>
                  <SelectTrigger className="w-full sm:w-[180px] text-sm">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos profissionais</SelectItem>
                    {profissionais.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {canSeeAllProfessionals && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[140px] text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="falta">Falta</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="ml-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="diario" className="text-xs px-2.5">Diário</TabsTrigger>
                  <TabsTrigger value="semanal" className="text-xs px-2.5">Semanal</TabsTrigger>
                  <TabsTrigger value="mensal" className="text-xs px-2.5">Mensal</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <CalendarLegend profissionais={profissionais} />
          </div>

          <div className="mt-4">
            {viewMode === "diario" && (
              <DailyView
                agendamentos={filteredAgendamentos}
                slots={scheduleSlots}
                currentDate={currentDate}
                onSlotClick={handleSlotClick}
                isPatient={isPatient}
                onCancel={handleCancelAppointment}
                onCheckin={handleCheckin}
                onReschedule={handleReschedule}
                onAppointmentClick={handleAppointmentClick}
                profColors={profColors}
                onDrop={handleDragDrop}
              />
            )}
            {viewMode === "semanal" && (
              <WeeklyView
                agendamentos={filteredAgendamentos}
                slots={scheduleSlots}
                currentDate={currentDate}
                onSlotClick={handleSlotClick}
                isPatient={isPatient}
                onCancel={handleCancelAppointment}
                onCheckin={handleCheckin}
                onReschedule={handleReschedule}
                onAppointmentClick={handleAppointmentClick}
                profColors={profColors}
                onDrop={handleDragDrop}
              />
            )}
            {viewMode === "mensal" && (
              <MonthlyView
                agendamentos={filteredAgendamentos}
                slots={scheduleSlots}
                currentDate={currentDate}
                onSlotClick={handleSlotClick}
                onAppointmentClick={handleAppointmentClick}
                profColors={profColors}
              />
            )}
          </div>
        </>
      )}

      <AgendamentoForm open={formOpen} onOpenChange={setFormOpen} onSuccess={refetchAgendamentos} defaultDate={selectedDate} />
      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} agendamento={rescheduleAg} onSuccess={refetchAgendamentos} />
      <AppointmentDetailDialog open={detailOpen} onOpenChange={setDetailOpen} agendamento={detailAg} onCancel={handleCancelAppointment} onCheckin={handleCheckin} onReschedule={handleReschedule} isPatient={isPatient} />
    </div>
  );
};

export default Agenda;
