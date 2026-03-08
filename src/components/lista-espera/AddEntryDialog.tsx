import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useModalidades } from "@/hooks/useModalidades";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "espera" | "interesse_mudanca" | "interesse_novo";
}

const AddEntryDialog = ({ open, onOpenChange, tipo }: AddEntryDialogProps) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    paciente_id: "",
    profissional_id: "",
    matricula_id: "",
    tipo_atendimento: "",
    dia_semana: [] as number[],
    hora_preferida_inicio: "",
    hora_preferida_fim: "",
    observacoes: "",
  });

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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.paciente_id) throw new Error("Selecione um paciente");
      if (tipo === "interesse_mudanca" && !form.matricula_id) throw new Error("Selecione uma matrícula");

      const { error } = await supabase.from("lista_espera").insert({
        paciente_id: form.paciente_id,
        profissional_id: form.profissional_id || null,
        matricula_id: tipo === "interesse_mudanca" ? form.matricula_id : null,
        tipo,
        tipo_atendimento: form.tipo_atendimento || "fisioterapia",
        dia_semana: form.dia_semana.length > 0 ? form.dia_semana : null,
        hora_preferida_inicio: form.hora_preferida_inicio || null,
        hora_preferida_fim: form.hora_preferida_fim || null,
        observacoes: form.observacoes || null,
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

  const resetForm = () => setForm({
    paciente_id: "", profissional_id: "", matricula_id: "",
    tipo_atendimento: "", dia_semana: [], hora_preferida_inicio: "", hora_preferida_fim: "", observacoes: "",
  });

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      dia_semana: prev.dia_semana.includes(day)
        ? prev.dia_semana.filter(d => d !== day)
        : [...prev.dia_semana, day].sort(),
    }));
  };

  const title = tipo === "espera" ? "Adicionar à Lista de Espera" :
    tipo === "interesse_mudanca" ? "Registrar Interesse de Mudança" :
    "Registrar Interesse - Novo Paciente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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

          <div className="space-y-2">
            <Label>Profissional preferido (opcional)</Label>
            <Select value={form.profissional_id} onValueChange={(v) => setForm({ ...form, profissional_id: v })}>
              <SelectTrigger><SelectValue placeholder="Qualquer profissional" /></SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <div className="space-y-2">
            <Label>{tipo === "interesse_mudanca" ? "Dias desejados (novo horário)" : "Dias preferidos"}</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia, i) => (
                <Button key={i} type="button" size="sm" variant={form.dia_semana.includes(i) ? "default" : "outline"} onClick={() => toggleDay(i)} className="h-8 px-3">
                  {dia}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário início</Label>
              <Input type="time" value={form.hora_preferida_inicio} onChange={(e) => setForm({ ...form, hora_preferida_inicio: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Horário fim</Label>
              <Input type="time" value={form.hora_preferida_fim} onChange={(e) => setForm({ ...form, hora_preferida_fim: e.target.value })} />
            </div>
          </div>

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
