import { useState, useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, CalendarCheck, MoveRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAgendamentos, useScheduleSlots, useUpdateAgendamentoStatus, useAgendamentoCheckin, useRescheduleAgendamento } from "@/modules/appointments/hooks/useAppointments";
import { useProfissionaisBasic, buildProfColorMap } from "@/modules/professionals/hooks/useProfessionals";
import { DailyView, CalendarLegend, type Agendamento } from "@/components/agenda/AgendaViews";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";
import { RescheduleDialog } from "@/components/agenda/RescheduleDialog";
import { AppointmentDetailDialog } from "@/components/agenda/AppointmentDetailDialog";
import { toast } from "@/modules/shared/hooks/use-toast";

interface DashboardAgendaProps {
  isAdmin: boolean;
  defaultProfissionalId?: string;
}

export function DashboardAgenda({ isAdmin, defaultProfissionalId }: DashboardAgendaProps) {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const navigate = useNavigate();

  const [currentDate] = useState(new Date());
  const [filterProfId, setFilterProfId] = useState(defaultProfissionalId || (isAdmin ? "all" : user?.id || "all"));
  
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAg, setRescheduleAg] = useState<Agendamento | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAg, setDetailAg] = useState<Agendamento | null>(null);

  const { data: profissionais = [] } = useProfissionaisBasic();
  const profColors = buildProfColorMap(profissionais);

  const start = startOfDay(currentDate).toISOString();
  const end = endOfDay(currentDate).toISOString();

  const { data: agendamentosData = [], refetch: refetchAgendamentos } = useAgendamentos({
    dateStart: start,
    dateEnd: end,
  });

  const { data: scheduleSlots = [], refetch: refetchSlots } = useScheduleSlots({
    professionalId: filterProfId === "all" ? undefined : filterProfId,
    date: format(currentDate, "yyyy-MM-dd"),
    clinicId: activeClinicId
  });

  useEffect(() => {
    const channel = supabase.channel("dashboard-agenda-realtime");

    channel.on("postgres_changes", { event: "*", schema: "public", table: "schedule_slots" }, () => {
      refetchSlots();
    });

    channel.on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, () => {
      refetchAgendamentos();
    });

    if (typeof channel.subscribe === "function") {
      channel.subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchSlots, refetchAgendamentos]);

  const agendamentos: Agendamento[] = useMemo(() => {
    return agendamentosData.map((item) => ({
      ...item,
      observacoes: item.observacoes ?? null,
      pacientes: item.pacientes,
      profiles: { nome: profissionais.find((p) => p.user_id === item.profissional_id)?.nome || "Profissional" },
    } as Agendamento));
  }, [agendamentosData, profissionais]);

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(ag => filterProfId === "all" || ag.profissional_id === filterProfId);
  }, [agendamentos, filterProfId]);

  const cancelMutation = useUpdateAgendamentoStatus();
  const checkinMutation = useAgendamentoCheckin();
  const rescheduleMutation = useRescheduleAgendamento();

  const handleCancelAppointment = async (id: string) => {
    cancelMutation.mutate({ id, status: "cancelado" }, {
      onSuccess: () => { toast({ title: "Agendamento cancelado" }); refetchAgendamentos(); },
      onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }),
    });
  };

  const handleDragDrop = async (agId: string, newDate: Date) => {
    const ag = agendamentos.find((a) => a.id === agId);
    if (!ag) return;
    rescheduleMutation.mutate({ id: agId, newDate, profissionalId: ag.profissional_id }, {
      onSuccess: () => { toast({ title: "Sessão reagendada!" }); refetchAgendamentos(); },
    });
  };

  return (
    <Card className="col-span-1 border-muted overflow-hidden flex flex-col h-full">
      <CardHeader className="bg-muted/30 pb-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" /> Agenda Diária
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterProfId} onValueChange={setFilterProfId}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="all">Todos profissionais</SelectItem>}
                {profissionais.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => navigate("/agenda")}>
              <span className="sr-only sm:not-sr-only sm:mr-1">Ver completa</span>
              <MoveRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto bg-background/50">
        <div className="p-3 bg-muted/20 border-b">
          <CalendarLegend profissionais={profissionais} />
        </div>
        <div className="p-4 min-h-[600px]">
          <DailyView
            agendamentos={filteredAgendamentos}
            slots={scheduleSlots}
            currentDate={currentDate}
            onSlotClick={(d) => { setSelectedDate(d); setFormOpen(true); }}
            isPatient={false}
            onCancel={handleCancelAppointment}
            onCheckin={(id, type) => checkinMutation.mutate({ id, type }, { onSuccess: () => { refetchAgendamentos(); } })}
            onReschedule={(ag) => { setRescheduleAg(ag); setRescheduleOpen(true); }}
            onAppointmentClick={(ag) => { setDetailAg(ag); setDetailOpen(true); }}
            profColors={profColors}
            onDrop={handleDragDrop}
          />
        </div>
      </CardContent>

      <AgendamentoForm open={formOpen} onOpenChange={setFormOpen} onSuccess={refetchAgendamentos} defaultDate={selectedDate} />
      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} agendamento={rescheduleAg} onSuccess={refetchAgendamentos} />
      <AppointmentDetailDialog open={detailOpen} onOpenChange={setDetailOpen} agendamento={detailAg} onCancel={handleCancelAppointment} onCheckin={(id, type) => checkinMutation.mutate({ id, type }, { onSuccess: () => { refetchAgendamentos(); } })} onReschedule={(ag) => { setRescheduleAg(ag); setRescheduleOpen(true); }} isPatient={false} />
    </Card>
  );
}
