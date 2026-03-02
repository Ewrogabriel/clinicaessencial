import { useState, useCallback, useEffect } from "react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";
import { DailyView, WeeklyView, MonthlyView, type Agendamento } from "@/components/agenda/AgendaViews";
import { generateWeeklyPDF } from "@/lib/generateAgendaPDF";
import { toast } from "@/hooks/use-toast";

type ViewMode = "diario" | "semanal" | "mensal";

const Agenda = () => {
  const { user, isPatient, isAdmin, isGestor, clinicId } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("semanal");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientesMap, setPacientesMap] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const fetchAgendamentos = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase.from("agendamentos") as any)
        .select(`
          *,
          pacientes (id, nome, telefone)
        `);

      if (isPatient) {
        // Find the patient linked to this user
        const { data: p, error: patientError } = await (supabase.from("pacientes") as any).select("id").eq("user_id", user?.id).single();
        if (patientError) {
          console.error("Error fetching patient ID:", patientError);
          setAgendamentos([]); // No patient found or error, show no appointments
          setLoading(false);
          return;
        }
        if (p) {
          query = query.eq("paciente_id", p.id);
        } else {
          setAgendamentos([]); // Patient user not linked yet
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query.order("data_horario", { ascending: true });

      if (!error && data) {
        const mapped = (data as any[]).map((item) => ({
          ...item,
          pacientes: item.pacientes,
          profiles: item.profiles,
        }));
        setAgendamentos(mapped);

        // Build telefone map
        const telMap: Record<string, string> = {};
        (data as any[]).forEach((item) => {
          if (item.paciente_id && item.pacientes?.telefone) {
            telMap[item.paciente_id] = item.pacientes.telefone;
          }
        });
        setPacientesMap(telMap);
      } else if (error) {
        console.error("Error fetching agendamentos:", error);
      }
    } catch (e) {
      console.error("Unexpected error in fetchAgendamentos:", e);
    }
    setLoading(false);
  }, [isPatient, user?.id]); // Added dependencies for useCallback

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  const handleSlotClick = (date: Date) => {
    if (!isPatient || isAdmin || isGestor) { // Allow team to create/edit
      setSelectedDate(date);
      setFormOpen(true);
    }
  };

  const handleNewAgendamento = () => {
    setSelectedDate(new Date());
    setFormOpen(true);
  };

  const handleExportPDF = () => {
    const agsWithTel = agendamentos.map((ag) => ({
      ...ag,
      paciente_telefone: pacientesMap[ag.paciente_id] || "",
    }));
    generateWeeklyPDF(agsWithTel, currentDate, pacientesMap);
    toast({ title: "PDF gerado!", description: "A agenda semanal foi exportada." });
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
      fetchAgendamentos();
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
      fetchAgendamentos();
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
        <div className="flex items-center justify-between w-full"> {/* Adjusted for new header structure */}
          <h1 className="text-3xl font-bold font-[Plus_Jakarta_Sans]">{isPatient ? "Minha Agenda" : "Agenda"}</h1>
          {(!isPatient || isGestor || isAdmin) && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={handleNewAgendamento}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation and View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="diario">Diário</TabsTrigger>
            <TabsTrigger value="semanal">Semanal</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar View */}
      <div>
        {viewMode === "diario" && (
          <DailyView
            agendamentos={agendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
          />
        )}
        {viewMode === "semanal" && (
          <WeeklyView
            agendamentos={agendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
          />
        )}
        {viewMode === "mensal" && (
          <MonthlyView
            agendamentos={agendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
            isPatient={isPatient}
            onCancel={handleCancelAppointment}
            onCheckin={handleCheckin}
          />
        )}
      </div>

      <AgendamentoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchAgendamentos}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default Agenda;
