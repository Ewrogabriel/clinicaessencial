import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Plus, Users, Bell, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ListaEspera = () => {
  const { isAdmin, isGestor } = useAuth();
  const isStaff = isAdmin || isGestor;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    paciente_id: "",
    profissional_id: "",
    tipo_atendimento: "pilates",
    dia_semana: [] as number[],
    hora_preferida_inicio: "",
    hora_preferida_fim: "",
    observacoes: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["lista-espera"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("lista_espera") as any)
        .select("*, pacientes(nome, telefone)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-lista-espera"],
    queryFn: async () => {
      const { data } = await (supabase.from("pacientes") as any).select("id, nome").eq("status", "ativo").order("nome");
      return data || [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-lista-espera"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "profissional");
      const ids = (roles || []).map(r => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.paciente_id) throw new Error("Selecione um paciente");
      const { error } = await (supabase.from("lista_espera") as any).insert({
        paciente_id: form.paciente_id,
        profissional_id: form.profissional_id || null,
        tipo_atendimento: form.tipo_atendimento,
        dia_semana: form.dia_semana.length > 0 ? form.dia_semana : null,
        hora_preferida_inicio: form.hora_preferida_inicio || null,
        hora_preferida_fim: form.hora_preferida_fim || null,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      toast.success("Paciente adicionado à lista de espera!");
      setIsDialogOpen(false);
      setForm({ paciente_id: "", profissional_id: "", tipo_atendimento: "pilates", dia_semana: [], hora_preferida_inicio: "", hora_preferida_fim: "", observacoes: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "notificado") updateData.notificado_em = new Date().toISOString();
      const { error } = await (supabase.from("lista_espera") as any).update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("lista_espera") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-espera"] });
      toast.success("Removido da lista de espera.");
    },
  });

  const notifyViaWhatsApp = (entry: any) => {
    const name = entry.pacientes?.nome?.split(" ")[0] || "Paciente";
    const phone = entry.pacientes?.telefone?.replace(/\D/g, "") || "";
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = `Olá ${name}! 🎉 Um horário ficou disponível para ${entry.tipo_atendimento}. Entre em contato conosco para agendar sua sessão!`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    updateStatusMutation.mutate({ id: entry.id, status: "notificado" });
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      dia_semana: prev.dia_semana.includes(day)
        ? prev.dia_semana.filter(d => d !== day)
        : [...prev.dia_semana, day].sort(),
    }));
  };

  const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    aguardando: { label: "Aguardando", variant: "outline" },
    notificado: { label: "Notificado", variant: "default" },
    atendido: { label: "Atendido", variant: "secondary" },
    cancelado: { label: "Cancelado", variant: "destructive" },
  };

  const aguardando = entries.filter((e: any) => e.status === "aguardando");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Lista de Espera</h1>
          <p className="text-muted-foreground">
            {aguardando.length} paciente(s) aguardando vaga
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">Carregando...</p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">Lista de espera vazia</p>
              <p className="text-sm">Nenhum paciente aguardando vaga no momento.</p>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{entry.pacientes?.nome || "Paciente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.tipo_atendimento}
                      {entry.dia_semana?.length > 0 && ` • ${entry.dia_semana.map((d: number) => DIAS_SEMANA[d]).join(", ")}`}
                      {entry.hora_preferida_inicio && ` • ${entry.hora_preferida_inicio}-${entry.hora_preferida_fim || ""}`}
                    </p>
                    {entry.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.observacoes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Desde {format(new Date(entry.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      {entry.notificado_em && ` • Notificado em ${format(new Date(entry.notificado_em), "dd/MM HH:mm")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusBadge[entry.status]?.variant || "outline"}>
                      {statusBadge[entry.status]?.label || entry.status}
                    </Badge>
                    {isStaff && entry.status === "aguardando" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" title="Notificar via WhatsApp" onClick={() => notifyViaWhatsApp(entry)}>
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Marcar como atendido" onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "atendido" })}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isStaff && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Remover" onClick={() => deleteMutation.mutate(entry.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar à Lista de Espera</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={form.paciente_id} onValueChange={(v) => setForm({ ...form, paciente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {pacientes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Profissional preferido (opcional)</Label>
              <Select value={form.profissional_id} onValueChange={(v) => setForm({ ...form, profissional_id: v })}>
                <SelectTrigger><SelectValue placeholder="Qualquer profissional" /></SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select value={form.tipo_atendimento} onValueChange={(v) => setForm({ ...form, tipo_atendimento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pilates">Pilates</SelectItem>
                  <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="rpg">RPG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias preferidos</Label>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListaEspera;
