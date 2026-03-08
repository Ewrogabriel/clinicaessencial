import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkAvailability, getMonthlyAvailability, type AvailabilityCheckResult } from "@/lib/availabilityCheck";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: any;
  onSuccess: () => void;
}

export function RescheduleDialog({ open, onOpenChange, agendamento, onSuccess }: RescheduleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [horario, setHorario] = useState("08:00");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [monthlyAvail, setMonthlyAvail] = useState<Record<number, number>>({});
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Reseta campos quando o modal abre
  useEffect(() => {
    if (open && agendamento) {
      if (agendamento.data_horario) {
        const d = new Date(agendamento.data_horario);
        setDate(d);
        setHorario(format(d, "HH:mm"));
      }
      setSelectedProfId(agendamento.profissional_id || "");
      setMotivo("");
      setAvailabilityResult(null);
      fetchProfissionais();
    }
  }, [open, agendamento]);

  const fetchProfissionais = async () => {
    // First get professional user_ids from user_roles
    const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
    const profUserIds = (roles || []).map((r: any) => r.user_id);
    if (profUserIds.length === 0) { setProfissionais([]); return; }
    const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", profUserIds).order("nome");
    setProfissionais((data || []).map((p: any) => ({ id: p.user_id, nome: p.nome })));
  };

  // Busca disponibilidade mensal quando o profissional ou mês mudam
  useEffect(() => {
    if (!selectedProfId || !open) return;

    const fetchMonthly = async () => {
      const result = await getMonthlyAvailability(
        selectedProfId,
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        horario
      );
      setMonthlyAvail(result);
    };
    fetchMonthly();
  }, [selectedProfId, currentMonth, horario, open]);

  // Verifica disponibilidade específica quando data ou horário mudam
  useEffect(() => {
    if (!selectedProfId || !date || !horario || !open) {
      setAvailabilityResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingAvailability(true);
      const [h, m] = horario.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(h, m, 0, 0);
      const result = await checkAvailability(selectedProfId, dt);
      setAvailabilityResult(result);
      setCheckingAvailability(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedProfId, date, horario, open]);

  const isCancelado = agendamento?.status === "cancelado" || agendamento?.status === "falta";
  const tipoLabel = isCancelado ? "Remarcação" : "Reagendamento";
  const tipoLabelLower = isCancelado ? "remarcação" : "reagendamento";

  const requestReschedule = useMutation({
    mutationFn: async () => {
      if (!user || !agendamento || !date) return;

      const [h, m] = horario.split(":").map(Number);
      const novaData = new Date(date);
      novaData.setHours(h, m, 0, 0);

      const requestedProf = profissionais.find(p => p.id === selectedProfId);
      const motivoCompleto = selectedProfId !== agendamento.profissional_id
        ? `[TROCA DE PROFISSIONAL PARA: ${requestedProf?.nome || selectedProfId}] ${motivo}`
        : motivo;

      const { error } = await supabase
        .from("solicitacoes_remarcacao")
        .insert({
          agendamento_id: agendamento.id,
          paciente_id: agendamento.paciente_id,
          nova_data_horario: novaData.toISOString(),
          motivo: motivoCompleto || null,
          status: "pendente"
        });

      if (error) throw error;

      // Notify professional
      await (supabase.from("notificacoes").insert({
        user_id: agendamento.profissional_id,
        tipo: isCancelado ? "remarcacao" : "reagendamento",
        titulo: `Solicitação de ${tipoLabelLower}`,
        resumo: `Paciente solicita ${tipoLabelLower} para ${format(novaData, "dd/MM 'às' HH:mm")}`,
        conteudo: `Paciente solicita ${tipoLabelLower}.\nData ${isCancelado ? "cancelada" : "atual"}: ${format(new Date(agendamento.data_horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nNova data: ${format(novaData, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\nMotivo: ${motivo || "Não informado"}`,
        link: "/solicitacoes-alteracao",
      }) as any);

      // If different professional, also notify the new one
      if (selectedProfId !== agendamento.profissional_id) {
        await (supabase.from("notificacoes").insert({
          user_id: selectedProfId,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Solicitação de ${tipoLabelLower} (novo profissional)`,
          resumo: `Paciente solicita ${tipoLabelLower} para ${format(novaData, "dd/MM 'às' HH:mm")}`,
          link: "/solicitacoes-alteracao",
        }) as any);
      }

      // Notify admins
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      for (const admin of (adminRoles || [])) {
        if (admin.user_id === agendamento.profissional_id) continue;
        await (supabase.from("notificacoes").insert({
          user_id: admin.user_id,
          tipo: isCancelado ? "remarcacao" : "reagendamento",
          titulo: `Nova solicitação de ${tipoLabelLower}`,
          resumo: `Paciente solicita ${tipoLabelLower} para ${format(novaData, "dd/MM 'às' HH:mm")}`,
          link: "/solicitacoes-alteracao",
        }) as any);
      }
    },
    onSuccess: () => {
      toast({
        title: "Solicitação enviada!",
        description: `Sua solicitação de ${tipoLabelLower} foi enviada para análise da clínica.`,
      });
      queryClient.invalidateQueries({ queryKey: ["patient-agenda"] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: `Erro ao solicitar ${tipoLabelLower}`,
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleReschedule = () => {
    if (!date) {
      toast({ title: "Selecione uma data", variant: "destructive" });
      return;
    }
    requestReschedule.mutate();
  };

  if (!agendamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Solicitar {tipoLabel}
          </DialogTitle>
          <DialogDescription>
            {isCancelado
              ? "Escolha uma nova data e horário para remarcar sua sessão cancelada."
              : `Escolha uma nova data e horário para reagendar sua sessão de ${agendamento.tipo_atendimento}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Profissional</Label>
            <Select value={selectedProfId} onValueChange={setSelectedProfId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfId !== agendamento.profissional_id && (
              <p className="text-[10px] text-amber-600 font-medium">
                ⚠️ Você está solicitando a troca de profissional.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Nova Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Escolha a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    onMonthChange={setCurrentMonth}
                    disabled={(date) => date < new Date() || date.getDay() === 0}
                    locale={ptBR}
                    initialFocus
                    components={{
                      DayContent: ({ date: d }) => {
                        const day = d.getDate();
                        const avail = monthlyAvail[day];
                        const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                        return (
                          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
                            <span>{day}</span>
                            {avail !== undefined && (
                              <span className={cn(
                                "text-[8px] font-bold mt-0.5",
                                avail > 0 ? "text-green-600" : "text-red-500"
                              )}>
                                {avail > 0 ? `${avail} v` : "lotado"}
                              </span>
                            )}
                          </div>
                        );
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Novo Horário</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {availabilityResult && (
            <div className={cn(
              "p-3 rounded-lg border text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200",
              availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            )}>
              {availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{availabilityResult.isWithinSchedule && !availabilityResult.isOverCapacity ? "Horário Disponível" : "Horário Indisponível"}</p>
                <p className="text-xs opacity-90">{availabilityResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Motivo (Opcional)</Label>
            <Textarea
              placeholder="Descreva brevemente o motivo da remarcação..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none h-20"
            />
          </div>

          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-relaxed">
              <strong>Importante:</strong> Ao solicitar a remarcação, seu horário original permanece reservado até que a clínica aprove o novo horário. Você receberá uma notificação assim que for confirmado.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleReschedule}
            disabled={requestReschedule.isPending || (!!availabilityResult && availabilityResult.isOverCapacity)}
            className="gap-2"
          >
            {requestReschedule.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            Confirmar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
