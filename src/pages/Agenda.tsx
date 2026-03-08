import { useState, useCallback, useEffect } from "react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, FileDown, Filter, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { AppointmentDetailDialog } from "@/components/agenda/AppointmentDetailDialog";
import { DailyView, WeeklyView, MonthlyView, type Agendamento } from "@/components/agenda/AgendaViews";
import { generateWeeklyPDF } from "@/lib/generateAgendaPDF";
import { toast } from "@/hooks/use-toast";

type ViewMode = "diario" | "semanal" | "mensal";

const Agenda = () => {
  const { user, isPatient, isAdmin, isGestor, clinicId } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("semanal");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientesMap, setPacientesMap] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAg, setRescheduleAg] = useState<Agendamento | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAg, setDetailAg] = useState<Agendamento | null>(null);
  const [filterProfId, setFilterProfId] = useState<string>("all");

  const isStaff = isAdmin || isGestor;

  // Fetch professionals for filter
  const { data: profissionais = [] } = useQuery({
    queryKey: ["prof-for-agenda-filter"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = roles?.map(r => r.user_id) ?? [];
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = adminRoles?.map(r => r.user_id) ?? [];
      const allIds = [...new Set([...ids, ...adminIds])];
      if (!allIds.length) return [];
      const { data } = await (supabase.from("profiles") as any).select("user_id, nome, cor_agenda").in("user_id", allIds).order("nome");
      return data ?? [];
    },
    enabled: isStaff,
  });

  // Build color map: profissional_id -> color
  const profColors: Record<string, string> = {};
  (profissionais as any[]).forEach((p: any) => {
    profColors[p.user_id] = p.cor_agenda || "#3b82f6";
  });

  const handleAppointmentClick = (ag: Agendamento) => {
    setDetailAg(ag);
    setDetailOpen(true);
  };

  const handleReschedule = (ag: Agendamento) => {
    setRescheduleAg(ag);
    setRescheduleOpen(true);
  };

  // Fetch patient ID if current user is a patient
  const { data: patientData } = useQuery({
    queryKey: ["current-patient", user?.id],
    queryFn: async () => {
      if (!isPatient || !user?.id) return null;
      const { data, error } = await (supabase.from("pacientes") as any).select("id").eq("user_id", user.id).single();
      if (error) {
        console.error("Error fetching patient:", error);
        return null;
      }
      return data;
    },
    enabled: isPatient && !!user?.id,
  });

  // Fetch agendamentos using React Query
  const { data: agendamentosData = [], isLoading, refetch: refetchAgendamentos } = useQuery({
    queryKey: ["agendamentos", patientData?.id, isPatient],
    queryFn: async () => {
      let query = (supabase.from("agendamentos") as any)
        .select(`
          *,
          pacientes (id, nome, telefone)
        `);

      if (isPatient && patientData?.id) {
        query = query.eq("paciente_id", patientData.id);
      }

      const { data, error } = await query.order("data_horario", { ascending: true });

      if (error) {
        console.error("Error fetching agendamentos:", error);
        return [];
      }

      return data || [];
    },
    enabled: !isPatient || !!patientData?.id,
  });

  // Update state when data changes
  useEffect(() => {
    const mapped = (agendamentosData as any[]).map((item) => ({
      ...item,
      pacientes: item.pacientes,
      profiles: { nome: (profissionais as any[]).find((p: any) => p.user_id === item.profissional_id)?.nome || "Profissional" },
    }));
    setAgendamentos(mapped);

    const telMap: Record<string, string> = {};
    (agendamentosData as any[]).forEach((item) => {
      if (item.paciente_id && item.pacientes?.telefone) {
        telMap[item.paciente_id] = item.pacientes.telefone;
      }
    });
    setPacientesMap(telMap);
  }, [agendamentosData, profissionais]);



  // Apply professional filter
  const filteredAgendamentos = filterProfId === "all"
    ? agendamentos
    : agendamentos.filter(ag => ag.profissional_id === filterProfId);

  const handleSlotClick = (date: Date) => {
    if (!isPatient || isAdmin || isGestor) {
      setSelectedDate(date);
      setFormOpen(true);
    }
  };

  const handleNewAgendamento = () => {
    setSelectedDate(new Date());
    setFormOpen(true);
  };

  const handleExportPDF = () => {
    const agsWithTel = filteredAgendamentos.map((ag) => ({
      ...ag,
      paciente_telefone: pacientesMap[ag.paciente_id] || "",
    }));
    const profName = filterProfId !== "all"
      ? (profissionais as any[]).find((p: any) => p.user_id === filterProfId)?.nome
      : undefined;
    generateWeeklyPDF(agsWithTel, currentDate, pacientesMap, profName);
    toast({ title: "PDF gerado!", description: profName ? `Agenda de ${profName} exportada.` : "Agenda completa exportada." });
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

  const handleCancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Agendamento cancelado" });
      refetchAgendamentos();
    } catch (err) {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  };

  const handleCheckin = async (id: string, type: "paciente" | "profissional") => {
    try {
      const updateData = type === "paciente"
        ? { checkin_paciente: true, checkin_paciente_at: new Date().toISOString() }
        : { checkin_profissional: true, checkin_profissional_at: new Date().toISOString() };
      const { error } = await supabase
        .from("agendamentos")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Check-in realizado! ✅" });
      refetchAgendamentos();
    } catch (err) {
      toast({ title: "Erro ao fazer check-in", variant: "destructive" });
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (viewMode === "diario") return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semanal") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    return format(currentDate, "MMMM yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Minha Agenda" : "Agenda"}</h1>
        {(!isPatient || isGestor || isAdmin) && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={() => navigate("/matriculas")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nova Matrícula
            </Button>
            <Button onClick={handleNewAgendamento}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        )}
      </div>

      {/* Professional Filter + Navigation + View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold capitalize ml-2">
            {getTitle()}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isStaff && (
            <Select value={filterProfId} onValueChange={setFilterProfId}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filtrar profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {(profissionais as any[]).map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="diario">Diário</TabsTrigger>
              <TabsTrigger value="semanal">Semanal</TabsTrigger>
              <TabsTrigger value="mensal">Mensal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Color Legend */}
      {isStaff && (profissionais as any[]).length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground font-medium">Legenda:</span>
          {(profissionais as any[]).map((p: any) => (
            <div key={p.user_id} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.cor_agenda || '#3b82f6' }} />
              <span>{p.nome}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar View */}
      <div>
        {viewMode === "diario" && (
          <DailyView
            agendamentos={filteredAgendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            profColors={profColors}
          />
        )}
        {viewMode === "semanal" && (
          <WeeklyView
            agendamentos={filteredAgendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            profColors={profColors}
          />
        )}
        {viewMode === "mensal" && (
          <MonthlyView
            agendamentos={filteredAgendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
            onReschedule={handleReschedule}
            onAppointmentClick={handleAppointmentClick}
            profColors={profColors}
          />
        )}
      </div>

      <AgendamentoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={refetchAgendamentos}
        defaultDate={selectedDate}
      />

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        agendamento={rescheduleAg}
        onSuccess={refetchAgendamentos}
      />

      <AppointmentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        agendamento={detailAg}
        onCancel={handleCancelAppointment}
        onCheckin={handleCheckin}
        onReschedule={handleReschedule}
        isPatient={isPatient}
      />
    </div>
  );
};

export default Agenda;
