import { useState, useCallback, useEffect } from "react";
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";
import { DailyView, WeeklyView, MonthlyView, type Agendamento } from "@/components/agenda/AgendaViews";
import { generateWeeklyPDF } from "@/lib/generateAgendaPDF";
import { toast } from "@/hooks/use-toast";

type ViewMode = "diario" | "semanal" | "mensal";

const Agenda = () => {
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
      const { data, error } = await (supabase as any)
        .from("agendamentos")
        .select("*, pacientes(nome, telefone)")
        .order("data_horario", { ascending: true });

      if (!error && data) {
        const mapped = data.map((item: any) => ({
          ...item,
          pacientes: item.pacientes,
          profiles: item.profiles,
        }));
        setAgendamentos(mapped);

        // Build telefone map
        const telMap: Record<string, string> = {};
        data.forEach((item: any) => {
          if (item.paciente_id && item.pacientes?.telefone) {
            telMap[item.paciente_id] = item.pacientes.telefone;
          }
        });
        setPacientesMap(telMap);
      }
    } catch {
      // Table may not exist yet
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  const handleSlotClick = (date: Date) => {
    setSelectedDate(date);
    setFormOpen(true);
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

  const goToToday = () => setCurrentDate(new Date());

  const getTitle = () => {
    if (viewMode === "diario") return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "semanal") return format(currentDate, "MMMM yyyy", { locale: ptBR });
    return format(currentDate, "MMMM yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
        </div>
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
          />
        )}
        {viewMode === "semanal" && (
          <WeeklyView
            agendamentos={agendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
          />
        )}
        {viewMode === "mensal" && (
          <MonthlyView
            agendamentos={agendamentos}
            currentDate={currentDate}
            onSlotClick={handleSlotClick}
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
