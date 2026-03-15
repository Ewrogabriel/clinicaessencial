import { useState, useEffect } from "react";
import { Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useModalidades } from "@/modules/appointments/hooks/useModalidades";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useWeekdaySlots } from "@/modules/appointments/hooks/useAppointments";

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const WEEKDAY_SHORT: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

type HorarioPreferido = {
  weekday: number;
  time: string;
  professional_id: string;
};

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "espera" | "interesse_mudanca" | "interesse_novo";
}

const AddEntryDialog = ({ open, onOpenChange, tipo }: AddEntryDialogProps) => {
  const queryClient = useQueryClient();
  const { activeClinicId } = useClinic();
  const [form, setForm] = useState({
    paciente_id: "",
    matricula_id: "",
    tipo_atendimento: "",
    observacoes: "",
    horarios_preferidos: [] as HorarioPreferido[],
  });

  const [newWeekday, setNewWeekday] = useState("");
  const [newProfessional, setNewProfessional] = useState("");
  const [newTime, setNewTime] = useState("");

  const weekdayNum = newWeekday !== "" ? Number(newWeekday) : undefined;

  const { data: weekdaySlots = [], isLoading: isLoadingSlots } = useWeekdaySlots({
    professionalId: newProfessional || undefined,
    weekday: weekdayNum,
    clinicId: activeClinicId,
    durationMin: 60,
  });

  useEffect(() => {
    setNewTime("");
  }, [newProfessional, newWeekday]);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-lista-espera"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-lista-espera"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      if (rolesError) throw rolesError;
      const ids = (roles || []).map(r => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: modalidades = [] } = useModalidades({ ativo: true });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-paciente", form.paciente_id],
    enabled: tipo === "interesse_mudanca" && !!form.paciente_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas")
        .select("id, tipo_atendimento, status, valor_mensal")
        .eq("paciente_id", form.paciente_id)
        .eq("status", "ativa");
      if (error) throw error;
      return data || [];
    },
  });

  const addSchedule = () => {
    if (newWeekday === "" || !newTime || !newProfessional) return;
    const weekday = Number(newWeekday);
    const updated: HorarioPreferido[] = [
      ...form.horarios_preferidos,
      { weekday, time: newTime, professional_id: newProfessional },
    ];
    setForm(prev => ({ ...prev, horarios_preferidos: updated }));
    setNewWeekday("");
    setNewTime("");
    setNewProfessional("");
  };

  const removeSchedule = (index: number) => {
    setForm(prev => ({
      ...prev,
      horarios_preferidos: prev.horarios_preferidos.filter((_, i) => i !== index),
    }));
  };

  const getProfessionalName = (id: string) =>
    profissionais.find(p => p.user_id === id)?.nome || "—";

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.paciente_id) throw new Error("Selecione um paciente");
      if (tipo === "interesse_mudanca" && !form.matricula_id) throw new Error("Selecione uma matrícula");

      const firstSchedule = form.horarios_preferidos[0];

      const { error } = await supabase.from("lista_espera").insert({
        paciente_id: form.paciente_id,
        profissional_id: firstSchedule?.professional_id || null,
        matricula_id: tipo === "interesse_mudanca" ? form.matricula_id : null,
        tipo,
        tipo_atendimento: form.tipo_atendimento || "fisioterapia",
        dia_semana: form.horarios_preferidos.length > 0
          ? [...new Set(form.horarios_preferidos.map(h => h.weekday))].sort()
          : null,
        hora_preferida_inicio: firstSchedule?.time || null,
        hora_preferida_fim: null,
        horarios_preferidos: form.horarios_preferidos.length > 0 ? form.horarios_preferidos : null,
        observacoes: form.observacoes || null,
        clinic_id: activeClinicId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      const msg = tipo === "espera" ? "Adicionado à lista de espera!" :
        tipo === "interesse_mudanca" ? "Interesse de mudança registrado!" :
          "Interesse de novo paciente registrado!";
      toast.success(msg);
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ paciente_id: "", matricula_id: "", tipo_atendimento: "", observacoes: "", horarios_preferidos: [] });
    setNewWeekday("");
    setNewProfessional("");
    setNewTime("");
  };

  const title = tipo === "espera" ? "Adicionar à Lista de Espera" :
    tipo === "interesse_mudanca" ? "Registrar Interesse de Mudança" :
      "Registrar Interesse - Novo Paciente";

  const scheduleLabel = tipo === "interesse_mudanca" ? "Horários Desejados (novo horário)" : "Horários Preferidos";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Paciente */}
          <div className="space-y-2">
            <Label>Paciente *</Label>
            <Select value={form.paciente_id} onValueChange={(v) => setForm({ ...form, paciente_id: v, matricula_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matrícula ativa (apenas para interesse_mudanca) */}
          {tipo === "interesse_mudanca" && form.paciente_id && (
            <div className="space-y-2">
              <Label>Matrícula ativa *</Label>
              <Select value={form.matricula_id} onValueChange={(v) => setForm({ ...form, matricula_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a matrícula..." /></SelectTrigger>
                <SelectContent>
                  {matriculas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.tipo_atendimento} - R$ {Number(m.valor_mensal).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Modalidade */}
          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select value={form.tipo_atendimento} onValueChange={(v) => setForm({ ...form, tipo_atendimento: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a modalidade..." /></SelectTrigger>
              <SelectContent>
                {modalidades.filter(m => m.ativo).map((m) => (
                  <SelectItem key={m.id} value={m.nome.toLowerCase()}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horários Preferidos */}
          <div className="space-y-3 border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{scheduleLabel}</Label>
              {form.horarios_preferidos.length > 0 && (
                <Badge variant="secondary">{form.horarios_preferidos.length}x / semana</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Dia da Semana */}
              <div>
                <Label className="text-xs">Dia da Semana</Label>
                <Select value={newWeekday} onValueChange={setNewWeekday}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Profissional */}
              <div>
                <Label className="text-xs">Profissional</Label>
                <Select value={newProfessional} onValueChange={setNewProfessional}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Horário */}
              <div className="col-span-2">
                <Label className="text-xs">Horário</Label>
                <Select
                  value={newTime}
                  onValueChange={setNewTime}
                  disabled={isLoadingSlots || !newProfessional || newWeekday === ""}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={
                      isLoadingSlots ? "Carregando..." :
                      (!newProfessional || newWeekday === "") ? "Selecione o dia e o profissional" :
                      weekdaySlots.length === 0 ? "Sem horários disponíveis" :
                      "Selecione o horário"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdaySlots.map((slot) => (
                      <SelectItem key={slot.time} value={slot.time}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{slot.time}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-green-50 text-green-600 border-green-200">
                            até {slot.max_capacity} pacientes
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-2 w-full"
              onClick={addSchedule}
              disabled={newWeekday === "" || !newTime || !newProfessional}
            >
              <Plus className="h-4 w-4" />
              Adicionar horário
            </Button>

            {form.horarios_preferidos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum horário configurado ainda.
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                {form.horarios_preferidos.map((h, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">{WEEKDAY_SHORT[h.weekday]}</Badge>
                      <span className="text-sm font-medium">{h.time}</span>
                      <span className="text-sm text-muted-foreground">• {getProfessionalName(h.professional_id)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSchedule(index)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Informações adicionais..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
            {addMutation.isPending ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEntryDialog;
