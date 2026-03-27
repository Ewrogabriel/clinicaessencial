import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { toast } from "sonner";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Calendar, Users, AlertTriangle,
  CheckCircle2, XCircle, Clock, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientCombobox } from "@/components/ui/patient-combobox";

interface SlotAvailability {
  id: string;
  professional_id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_capacity: number;
  bookings_count: number;
  vagas_disponiveis: number;
  availability_status: "available" | "full" | "overbooked" | "blocked";
  is_blocked: boolean;
}

interface Paciente {
  id: string;
  nome: string;
  cpf?: string;
}

interface Profissional {
  id: string;
  user_id: string;
  nome: string;
}

const STATUS_CONFIG = {
  available: { label: "Disponível", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  full: { label: "Lotado", color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertTriangle },
  overbooked: { label: "Excedente", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  blocked: { label: "Bloqueado", color: "bg-gray-100 text-gray-500 border-gray-200", icon: XCircle },
};

export default function AgendaPremium() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedProfId, setSelectedProfId] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);
  const [selectedPaciente, setSelectedPaciente] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<SlotAvailability | null>(null);

  // Fetch profissionais
  const { data: profissionais = [] } = useQuery<Profissional[]>({
    queryKey: ["profissionais-select"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, user_id, nome").in("user_id", ids).order("nome");
      return (data || []) as Profissional[];
    },
  });

  // Fetch pacientes
  const { data: pacientes = [] } = useQuery<Paciente[]>({
    queryKey: ["pacientes-select"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").eq("status", "ativo").order("nome");
      return (data || []) as Paciente[];
    },
  });

  // Fetch slot availability
  const { data: slots = [], isLoading } = useQuery<SlotAvailability[]>({
    queryKey: ["slot-availability", selectedDate, selectedProfId, activeClinicId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("v_slot_availability")
        .select("*")
        .eq("date", selectedDate)
        .order("start_time");

      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      if (selectedProfId !== "all") query = query.eq("professional_id", selectedProfId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SlotAvailability[];
    },
    enabled: !!activeClinicId,
    refetchInterval: 30000,
  });

  const bookMutation = useMutation({
    mutationFn: async ({ slotId, allowOverbook }: { slotId: string; allowOverbook: boolean }) => {
      if (!user || !activeClinicId || !selectedPaciente) throw new Error("Dados incompletos");

      const { data, error } = await (supabase as any).rpc("book_slot", {
        p_slot_id: slotId,
        p_paciente_id: selectedPaciente,
        p_clinic_id: activeClinicId,
        p_created_by: user.id,
        p_allow_overbooking: allowOverbook,
      });

      if (error) throw error;
      if (!data.success) {
        if (data.requires_confirmation) {
          return { needsConfirmation: true, data };
        }
        throw new Error(data.error);
      }
      return { needsConfirmation: false, data };
    },
    onSuccess: (result, variables) => {
      if (result.needsConfirmation) {
        setPendingSlot(selectedSlot);
        setConfirmOpen(true);
        return;
      }
      const msg = result.data.is_overbooked
        ? `⚠️ Agendado com excedente (${result.data.total_booked}/${result.data.capacity} vagas)`
        : `✅ Agendado! Vagas restantes: ${result.data.capacity - result.data.total_booked}`;
      toast.success(msg);
      setSelectedSlot(null);
      setSelectedPaciente("");
      queryClient.invalidateQueries({ queryKey: ["slot-availability"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleBook = (slot: SlotAvailability) => {
    if (slot.is_blocked) return;
    setSelectedSlot(slot);
    setSelectedPaciente("");
  };

  const handleConfirmBook = () => {
    if (!selectedSlot || !selectedPaciente) return;
    bookMutation.mutate({ slotId: selectedSlot.id, allowOverbook: false });
  };

  const handleConfirmOverbooking = () => {
    if (!pendingSlot || !selectedPaciente) return;
    bookMutation.mutate({ slotId: pendingSlot.id, allowOverbook: true });
    setConfirmOpen(false);
    setPendingSlot(null);
    setSelectedSlot(null);
    setSelectedPaciente("");
  };

  const goDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    setSelectedDate(format(delta > 0 ? addDays(d, 1) : subDays(d, 1), "yyyy-MM-dd"));
  };

  // Summary counts
  const totalSlots = slots.length;
  const totalVagas = slots.reduce((acc, s) => acc + (s.max_capacity || 1), 0);
  const totalOcupadas = slots.reduce((acc, s) => acc + (s.bookings_count || 0), 0);
  const totalLotados = slots.filter(s => s.availability_status === "full" || s.availability_status === "overbooked").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Agenda Premium
          </h1>
          <p className="text-muted-foreground text-sm">
            Múltiplas vagas por horário · Controle de capacidade · Overbooking controlado
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex items-center gap-2 border rounded-lg p-1 bg-card">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 font-medium text-sm min-w-[140px] text-center capitalize">
            {format(new Date(selectedDate + "T12:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedProfId} onValueChange={setSelectedProfId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os profissionais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os profissionais</SelectItem>
            {profissionais.map((p) => (
              <SelectItem key={p.id} value={p.user_id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
          Hoje
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Horários", value: totalSlots, icon: Clock, color: "text-blue-600" },
          { label: "Vagas totais", value: totalVagas, icon: Users, color: "text-purple-600" },
          { label: "Ocupadas", value: totalOcupadas, icon: CheckCircle2, color: "text-green-600" },
          { label: "Lotados", value: totalLotados, icon: AlertTriangle, color: "text-orange-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={cn("h-8 w-8", kpi.color)} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Slots Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Horários do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground animate-pulse">Carregando horários...</div>
          ) : slots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum horário cadastrado para esta data.</p>
              <p className="text-xs mt-1">Configure a disponibilidade dos profissionais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((slot) => {
                const cfg = STATUS_CONFIG[slot.availability_status] || STATUS_CONFIG.available;
                const Icon = cfg.icon;
                const profName = profissionais.find(p => p.user_id === slot.professional_id)?.nome || "Profissional";
                const pct = slot.max_capacity > 0 ? Math.min((slot.bookings_count / slot.max_capacity) * 100, 100) : 0;

                return (
                  <div
                    key={slot.id}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all cursor-pointer hover:shadow-md",
                      slot.is_blocked
                        ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                        : "border-border hover:border-primary/50 bg-card"
                    )}
                    onClick={() => !slot.is_blocked && handleBook(slot)}
                  >
                    {/* Time badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-lg">{slot.start_time?.slice(0, 5)}</span>
                      <Badge variant="outline" className={cn("text-xs border", cfg.color)}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>

                    {/* Professional */}
                    <p className="text-xs text-muted-foreground mb-3 truncate">{profName}</p>

                    {/* Capacity Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Capacidade</span>
                        <span className={cn(
                          "font-medium",
                          slot.availability_status === "overbooked" ? "text-red-600" :
                          slot.availability_status === "full" ? "text-orange-600" : "text-green-600"
                        )}>
                          {slot.bookings_count}/{slot.max_capacity}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            slot.availability_status === "overbooked" ? "bg-red-500" :
                            slot.availability_status === "full" ? "bg-orange-500" : "bg-green-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {slot.vagas_disponiveis > 0 ? (
                        <p className="text-xs text-green-600 font-medium">{slot.vagas_disponiveis} vaga{slot.vagas_disponiveis !== 1 ? "s" : ""} disponível</p>
                      ) : slot.availability_status === "overbooked" ? (
                        <p className="text-xs text-red-600 font-medium">
                          +{slot.bookings_count - slot.max_capacity} excedente{slot.bookings_count - slot.max_capacity !== 1 ? "s" : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-orange-600 font-medium">Lotado</p>
                      )}
                    </div>

                    {/* Book button */}
                    {!slot.is_blocked && (
                      <Button
                        size="sm"
                        variant={slot.availability_status === "available" ? "default" : "outline"}
                        className="w-full mt-3 gap-2"
                        onClick={(e) => { e.stopPropagation(); handleBook(slot); }}
                      >
                        <Plus className="h-3 w-3" />
                        {slot.availability_status === "available" ? "Agendar" : "Agendar mesmo assim"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={(o) => !o && setSelectedSlot(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Agendar no Horário</DialogTitle>
            {selectedSlot && (
              <DialogDescription>
                {selectedSlot.start_time?.slice(0, 5)} — Capacidade: {selectedSlot.bookings_count}/{selectedSlot.max_capacity}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedSlot && (selectedSlot.availability_status === "full" || selectedSlot.availability_status === "overbooked") && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Este horário já atingiu a capacidade máxima. Você pode continuar com overbooking.</span>
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Paciente</label>
              <PatientCombobox
                patients={pacientes}
                value={selectedPaciente}
                onValueChange={setSelectedPaciente}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSlot(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmBook}
              disabled={!selectedPaciente || bookMutation.isPending}
            >
              {bookMutation.isPending ? "Agendando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overbooking Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Overbooking
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Este horário já atingiu a capacidade máxima.
            Deseja agendar mesmo assim? O sistema registrará como excedente.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingSlot(null); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmOverbooking}>
              Sim, agendar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
