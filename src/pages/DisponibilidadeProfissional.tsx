import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Trash2, Users, CalendarDays, Copy, Edit2, Check, X, Download, CalendarOff, PartyPopper, Eye, ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { generateAvailabilityPDF } from "@/lib/generateAvailabilityPDF";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = [
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 0, label: "Domingo", short: "Dom" },
];

interface Slot {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
}

interface Bloqueio {
  id: string;
  profissional_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  dia_inteiro: boolean;
  motivo: string | null;
}

interface Feriado {
  id: string;
  data: string;
  descricao: string;
}

interface AgendaExtra {
  id: string;
  profissional_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  max_pacientes: number;
  motivo: string | null;
}

const DisponibilidadeProfissional = () => {
  const { user, isAdmin, isGestor } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isGestor;
  const [selectedProfissional, setSelectedProfissional] = useState<string>(user?.id || "");
  const [newSlot, setNewSlot] = useState({ dia_semana: 1, hora_inicio: "07:00", hora_fim: "12:00", max_pacientes: 3 });
  const [loading, setLoading] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Slot>>({});
  const [mainTab, setMainTab] = useState("grade");

  // Bloqueio state
  const [bloqueioData, setBloqueioData] = useState("");
  const [bloqueioDiaInteiro, setBloqueioDiaInteiro] = useState(true);
  const [bloqueioHoraInicio, setBloqueioHoraInicio] = useState("08:00");
  const [bloqueioHoraFim, setBloqueioHoraFim] = useState("12:00");
  const [bloqueioMotivo, setBloqueioMotivo] = useState("");

  // Feriado state
  const [feriadoData, setFeriadoData] = useState("");
  const [feriadoDescricao, setFeriadoDescricao] = useState("");

  // Agenda extra state
  const [extraData, setExtraData] = useState("");
  const [extraHoraInicio, setExtraHoraInicio] = useState("08:00");
  const [extraHoraFim, setExtraHoraFim] = useState("12:00");
  const [extraMaxPacientes, setExtraMaxPacientes] = useState(3);
  const [extraMotivo, setExtraMotivo] = useState("");

  // Vacancy grid dialog
  const [showVacancyGrid, setShowVacancyGrid] = useState(false);
  const [vacancyWeek, setVacancyWeek] = useState<Date>(new Date());
  const [vacancyProfId, setVacancyProfId] = useState<string>("");

  const profId = canManage ? selectedProfissional : (user?.id || "");

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-disp"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, user_id, nome").in("user_id", ids).order("nome");
      return data ?? [];
    },
  });

  const currentProfName = canManage
    ? profissionais.find((p) => p.user_id === profId)?.nome || "Profissional"
    : "Minha Grade";

  const effectiveVacancyProfId = vacancyProfId || profId;
  const vacancyProfName = profissionais.find((p) => p.user_id === effectiveVacancyProfId)?.nome || "Profissional";

  const { data: slots = [], refetch } = useQuery({
    queryKey: ["disponibilidade", profId, activeClinicId],
    queryFn: async () => {
      let q = supabase.from("disponibilidade_profissional")
        .select("*").eq("profissional_id", profId).eq("ativo", true);
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q.order("dia_semana").order("hora_inicio");
      return (data ?? []) as Slot[];
    },
    enabled: !!profId,
  });

  const { data: bloqueios = [], refetch: refetchBloqueios } = useQuery({
    queryKey: ["bloqueios", profId],
    queryFn: async () => {
      const { data } = await supabase.from("bloqueios_profissional")
        .select("*").eq("profissional_id", profId)
        .gte("data", new Date().toISOString().split("T")[0])
        .order("data");
      return (data ?? []) as Bloqueio[];
    },
    enabled: !!profId,
  });

  const { data: feriados = [], refetch: refetchFeriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => {
      const { data } = await (supabase.from("feriados") as any)
        .select("*")
        .gte("data", new Date().toISOString().split("T")[0])
        .order("data");
      return (data ?? []) as Feriado[];
    },
  });

  const { data: agendaExtra = [], refetch: refetchExtra } = useQuery({
    queryKey: ["agenda-extra", profId],
    queryFn: async () => {
      const { data } = await (supabase.from("agenda_extra") as any)
        .select("*").eq("profissional_id", profId)
        .gte("data", new Date().toISOString().split("T")[0])
        .order("data");
      return (data ?? []) as AgendaExtra[];
    },
    enabled: !!profId,
  });

  const vacancyWeekStart = startOfWeek(vacancyWeek, { weekStartsOn: 1 });
  const vacancyWeekEnd = endOfWeek(vacancyWeek, { weekStartsOn: 1 });
  const vacancyDays = eachDayOfInterval({ start: vacancyWeekStart, end: vacancyWeekEnd });

  // Vacancy-specific slots query
  const { data: vacancySlots = [] } = useQuery({
    queryKey: ["disponibilidade-vagas", effectiveVacancyProfId],
    queryFn: async () => {
      const { data } = await (supabase.from("disponibilidade_profissional") as any)
        .select("*").eq("profissional_id", effectiveVacancyProfId).eq("ativo", true)
        .order("dia_semana").order("hora_inicio");
      return (data ?? []) as Slot[];
    },
    enabled: !!effectiveVacancyProfId && showVacancyGrid,
  });

  // Agendamentos for vacancy grid - scoped to selected week
  const { data: agendamentos = [] } = useQuery({
    queryKey: ["agendamentos-vagas", effectiveVacancyProfId, vacancyWeekStart.toISOString()],
    queryFn: async () => {
      const { data } = await (supabase.from("agendamentos") as any)
        .select("data_horario, status")
        .eq("profissional_id", effectiveVacancyProfId)
        .in("status", ["agendado", "confirmado"])
        .gte("data_horario", vacancyWeekStart.toISOString())
        .lte("data_horario", vacancyWeekEnd.toISOString());
      return data ?? [];
    },
    enabled: !!effectiveVacancyProfId && showVacancyGrid,
  });

  const handleAddSlot = async () => {
    if (!profId) return;
    if (newSlot.hora_inicio >= newSlot.hora_fim) {
      toast({ title: "Horário inválido", description: "O horário de início deve ser antes do fim.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await (supabase.from("disponibilidade_profissional") as any).insert({
      profissional_id: profId, dia_semana: newSlot.dia_semana,
      hora_inicio: newSlot.hora_inicio, hora_fim: newSlot.hora_fim, max_pacientes: newSlot.max_pacientes,
      clinic_id: activeClinicId,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Horário adicionado! ✅" }); refetch(); }
    setLoading(false);
  };

  const handleDeleteSlot = async (id: string) => {
    await (supabase.from("disponibilidade_profissional") as any).delete().eq("id", id);
    toast({ title: "Horário removido" }); refetch();
  };

  const handleEditSave = async (id: string) => {
    if (editValues.hora_inicio && editValues.hora_fim && editValues.hora_inicio >= editValues.hora_fim) {
      toast({ title: "Horário inválido", variant: "destructive" }); return;
    }
    const { error } = await (supabase.from("disponibilidade_profissional") as any).update(editValues).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Horário atualizado! ✅" }); setEditingSlot(null); refetch(); }
  };

  const handleCopyDay = async (fromDay: number, toDay: number) => {
    const fromSlots = slots.filter(s => s.dia_semana === fromDay);
    if (fromSlots.length === 0) { toast({ title: "Nenhum horário para copiar", variant: "destructive" }); return; }
    const records = fromSlots.map(s => ({
      profissional_id: profId, dia_semana: toDay, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, max_pacientes: s.max_pacientes,
      clinic_id: activeClinicId,
    }));
    const { error } = await (supabase.from("disponibilidade_profissional") as any).insert(records);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `Horários copiados para ${DIAS_SEMANA.find(d => d.value === toDay)?.label}! ✅` }); refetch(); }
  };

  const handleAddBloqueio = async () => {
    if (!profId || !bloqueioData) { toast({ title: "Selecione uma data", variant: "destructive" }); return; }
    const { error } = await (supabase.from("bloqueios_profissional") as any).insert({
      profissional_id: profId, data: bloqueioData, dia_inteiro: bloqueioDiaInteiro,
      hora_inicio: bloqueioDiaInteiro ? null : bloqueioHoraInicio,
      hora_fim: bloqueioDiaInteiro ? null : bloqueioHoraFim,
      motivo: bloqueioMotivo || null,
      clinic_id: activeClinicId,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    // Broadcast block notification to all users
    const horarioTxt = bloqueioDiaInteiro ? "dia inteiro" : `${bloqueioHoraInicio}-${bloqueioHoraFim}`;
    const { data: allUsers } = await supabase.from("profiles").select("user_id");
    if (allUsers) {
      const notifs = allUsers.map((u: any) => ({
        user_id: u.user_id,
        tipo: "bloqueio",
        titulo: `Bloqueio de agenda — ${currentProfName}`,
        resumo: `${bloqueioData} (${horarioTxt})`,
        conteudo: `${currentProfName} bloqueou a agenda no dia ${bloqueioData} (${horarioTxt}).\n${bloqueioMotivo ? `Motivo: ${bloqueioMotivo}` : "Sem motivo informado."}`,
      }));
      await (supabase.from("notificacoes").insert(notifs) as any);
    }
    toast({ title: "Bloqueio adicionado! ✅" });
    setBloqueioData(""); setBloqueioMotivo("");
    refetchBloqueios();
  };

  const handleDeleteBloqueio = async (id: string) => {
    await (supabase.from("bloqueios_profissional") as any).delete().eq("id", id);
    toast({ title: "Bloqueio removido" }); refetchBloqueios();
  };

  const handleAddFeriado = async () => {
    if (!feriadoData || !feriadoDescricao.trim()) { toast({ title: "Preencha data e descrição", variant: "destructive" }); return; }
    const { error } = await (supabase.from("feriados") as any).insert({
      data: feriadoData, descricao: feriadoDescricao.trim(), created_by: user?.id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    // Broadcast notification to all users
    const { data: allUsers } = await supabase.from("profiles").select("user_id");
    if (allUsers) {
      const notifs = allUsers.map((u: any) => ({
        user_id: u.user_id,
        tipo: "feriado",
        titulo: `Feriado: ${feriadoDescricao.trim()}`,
        resumo: `Feriado em ${feriadoData}`,
        conteudo: `Foi cadastrado um feriado no dia ${feriadoData}:\n${feriadoDescricao.trim()}\n\nA agenda estará bloqueada neste dia.`,
      }));
      await (supabase.from("notificacoes").insert(notifs) as any);
    }
    toast({ title: "Feriado cadastrado! ✅" }); setFeriadoData(""); setFeriadoDescricao(""); refetchFeriados();
  };

  const handleDeleteFeriado = async (id: string) => {
    await (supabase.from("feriados") as any).delete().eq("id", id);
    toast({ title: "Feriado removido" }); refetchFeriados();
  };

  const handleAddExtra = async () => {
    if (!profId || !extraData) { toast({ title: "Selecione uma data", variant: "destructive" }); return; }
    if (extraHoraInicio >= extraHoraFim) { toast({ title: "Horário inválido", variant: "destructive" }); return; }
    const { error } = await (supabase.from("agenda_extra") as any).insert({
      profissional_id: profId, data: extraData,
      hora_inicio: extraHoraInicio, hora_fim: extraHoraFim,
      max_pacientes: extraMaxPacientes, motivo: extraMotivo || null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Agenda extra adicionada! ✅" });
      setExtraData(""); setExtraMotivo("");
      refetchExtra();
    }
  };

  const handleDeleteExtra = async (id: string) => {
    await (supabase.from("agenda_extra") as any).delete().eq("id", id);
    toast({ title: "Agenda extra removida" }); refetchExtra();
  };

  const handleExportPDF = () => {
    generateAvailabilityPDF(slots, currentProfName);
    toast({ title: "PDF da grade semanal exportado!" });
  };

  // Vacancy-specific derived data
  const vacancyTimeRanges = [...new Set(vacancySlots.map(s => `${s.hora_inicio.slice(0, 5)}-${s.hora_fim.slice(0, 5)}`))].sort();

  const getVacancyForSlotOnDate = (slot: Slot, date: Date) => {
    const dayAgendamentos = agendamentos.filter((a: any) => {
      const d = new Date(a.data_horario);
      return isSameDay(d, date) &&
        d.toTimeString().slice(0, 5) >= slot.hora_inicio.slice(0, 5) &&
        d.toTimeString().slice(0, 5) < slot.hora_fim.slice(0, 5);
    });
    return Math.max(0, slot.max_pacientes - dayAgendamentos.length);
  };

  const allTimeRanges = [...new Set(slots.map(s => `${s.hora_inicio.slice(0, 5)}-${s.hora_fim.slice(0, 5)}`))].sort();

  const totalSlots = slots.length;
  const totalCapacity = slots.reduce((sum, s) => sum + s.max_pacientes, 0);
  const daysConfigured = new Set(slots.map(s => s.dia_semana)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Clock className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Disponibilidade</h1>
            <p className="text-muted-foreground">Configure horários, bloqueios e feriados.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVacancyGrid(true)} className="gap-1">
            <Eye className="h-4 w-4" /> Vagas
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={slots.length === 0} className="gap-1">
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary opacity-70" />
            <div><p className="text-2xl font-bold">{daysConfigured}</p><p className="text-xs text-muted-foreground">Dias configurados</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary opacity-70" />
            <div><p className="text-2xl font-bold">{totalSlots}</p><p className="text-xs text-muted-foreground">Faixas horárias</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary opacity-70" />
            <div><p className="text-2xl font-bold">{totalCapacity}</p><p className="text-xs text-muted-foreground">Vagas totais/semana</p></div>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <Card>
          <CardContent className="pt-4">
            <Label>Profissional</Label>
            <Select value={selectedProfissional} onValueChange={setSelectedProfissional}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profissionais.map((p: any) => <SelectItem key={p.id} value={p.user_id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="grade" className="gap-1"><Clock className="h-4 w-4" /> Grade</TabsTrigger>
          <TabsTrigger value="extra" className="gap-1"><CalendarPlus className="h-4 w-4" /> Agenda Extra</TabsTrigger>
          <TabsTrigger value="bloqueios" className="gap-1"><CalendarOff className="h-4 w-4" /> Bloqueios</TabsTrigger>
          <TabsTrigger value="feriados" className="gap-1"><PartyPopper className="h-4 w-4" /> Feriados</TabsTrigger>
        </TabsList>

        {/* ===== GRADE TAB ===== */}
        <TabsContent value="grade" className="space-y-4">
          {/* Add Slot Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Adicionar Faixa Horária</CardTitle>
              <CardDescription>Defina dia, período e capacidade máxima</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-5 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Dia da semana</Label>
                  <Select value={String(newSlot.dia_semana)} onValueChange={v => setNewSlot({ ...newSlot, dia_semana: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DIAS_SEMANA.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="time" value={newSlot.hora_inicio} onChange={e => setNewSlot({ ...newSlot, hora_inicio: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="time" value={newSlot.hora_fim} onChange={e => setNewSlot({ ...newSlot, hora_fim: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Máx. Pacientes</Label><Input type="number" min={1} max={20} value={newSlot.max_pacientes} onChange={e => setNewSlot({ ...newSlot, max_pacientes: Number(e.target.value) })} /></div>
                <Button onClick={handleAddSlot} disabled={loading} className="gap-1"><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Grade Semanal</CardTitle>
              <CardDescription>Visualize e edite horários. Use "Copiar para..." para replicar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="1" className="w-full">
                <TabsList className="w-full grid grid-cols-7 h-auto">
                  {DIAS_SEMANA.map(dia => {
                    const daySlots = slots.filter(s => s.dia_semana === dia.value);
                    return (
                      <TabsTrigger key={dia.value} value={String(dia.value)} className="flex flex-col gap-0.5 py-2">
                        <span className="text-xs font-medium">{dia.short}</span>
                        {daySlots.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{daySlots.length}</Badge>}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {DIAS_SEMANA.map(dia => {
                  const daySlots = slots.filter(s => s.dia_semana === dia.value);
                  return (
                    <TabsContent key={dia.value} value={String(dia.value)} className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{dia.label}</h3>
                        {daySlots.length > 0 && (
                          <Select onValueChange={(v) => handleCopyDay(dia.value, Number(v))}>
                            <SelectTrigger className="w-auto h-8 text-xs gap-1"><Copy className="h-3 w-3" /><span>Copiar para...</span></SelectTrigger>
                            <SelectContent>{DIAS_SEMANA.filter(d => d.value !== dia.value).map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>

                      {daySlots.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                          <Clock className="h-6 w-6 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhum horário configurado</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {daySlots.map(slot => (
                            <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                              {editingSlot === slot.id ? (
                                <>
                                  <div className="flex items-center gap-2 flex-1">
                                    <Input type="time" className="w-28 h-8 text-sm" value={editValues.hora_inicio || slot.hora_inicio.slice(0, 5)} onChange={e => setEditValues({ ...editValues, hora_inicio: e.target.value })} />
                                    <span className="text-muted-foreground">—</span>
                                    <Input type="time" className="w-28 h-8 text-sm" value={editValues.hora_fim || slot.hora_fim.slice(0, 5)} onChange={e => setEditValues({ ...editValues, hora_fim: e.target.value })} />
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <Input type="number" min={1} max={20} className="w-16 h-8 text-sm" value={editValues.max_pacientes ?? slot.max_pacientes} onChange={e => setEditValues({ ...editValues, max_pacientes: Number(e.target.value) })} />
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleEditSave(slot.id)}><Check className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingSlot(null)}><X className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-sm font-medium">{slot.hora_inicio?.slice(0, 5)} — {slot.hora_fim?.slice(0, 5)}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs gap-1"><Users className="h-3 w-3" /> máx {slot.max_pacientes}</Badge>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingSlot(slot.id); setEditValues({ hora_inicio: slot.hora_inicio.slice(0, 5), hora_fim: slot.hora_fim.slice(0, 5), max_pacientes: slot.max_pacientes }); }}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remover horário?</AlertDialogTitle>
                                          <AlertDialogDescription>Isso removerá a faixa {slot.hora_inicio?.slice(0, 5)} — {slot.hora_fim?.slice(0, 5)} de {dia.label}.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteSlot(slot.id)}>Remover</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== AGENDA EXTRA TAB ===== */}
        <TabsContent value="extra" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-primary" /> Abrir Agenda Extra</CardTitle>
              <CardDescription>Abra horários em dias que normalmente não atende</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={extraData} onChange={e => setExtraData(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Input value={extraMotivo} onChange={e => setExtraMotivo(e.target.value)} placeholder="Ex: reposição de aula, demanda extra..." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="time" value={extraHoraInicio} onChange={e => setExtraHoraInicio(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="time" value={extraHoraFim} onChange={e => setExtraHoraFim(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Máx. Pacientes</Label><Input type="number" min={1} max={20} value={extraMaxPacientes} onChange={e => setExtraMaxPacientes(Number(e.target.value))} /></div>
              </div>
              <Button onClick={handleAddExtra} className="gap-1"><Plus className="h-4 w-4" /> Abrir Agenda Extra</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Agendas Extras Ativas</CardTitle></CardHeader>
            <CardContent>
              {agendaExtra.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma agenda extra configurada</p>
              ) : (
                <div className="space-y-2">
                  {agendaExtra.map(e => (
                    <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(e.data + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.hora_inicio.slice(0, 5)} — {e.hora_fim.slice(0, 5)} • Máx: {e.max_pacientes} pacientes
                          {e.motivo && ` • ${e.motivo}`}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteExtra(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BLOQUEIOS TAB ===== */}
        <TabsContent value="bloqueios" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><CalendarOff className="h-5 w-5 text-destructive" /> Bloquear Data/Horário</CardTitle>
              <CardDescription>Marque dias ou horários específicos como indisponível</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={bloqueioData} onChange={e => setBloqueioData(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Motivo (opcional)</Label>
                  <Input value={bloqueioMotivo} onChange={e => setBloqueioMotivo(e.target.value)} placeholder="Ex: consulta médica" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={bloqueioDiaInteiro} onCheckedChange={setBloqueioDiaInteiro} />
                <Label>Dia inteiro</Label>
              </div>
              {!bloqueioDiaInteiro && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="time" value={bloqueioHoraInicio} onChange={e => setBloqueioHoraInicio(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="time" value={bloqueioHoraFim} onChange={e => setBloqueioHoraFim(e.target.value)} /></div>
                </div>
              )}
              <Button onClick={handleAddBloqueio} className="gap-1"><Plus className="h-4 w-4" /> Adicionar Bloqueio</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Bloqueios Ativos</CardTitle></CardHeader>
            <CardContent>
              {bloqueios.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum bloqueio configurado</p>
              ) : (
                <div className="space-y-2">
                  {bloqueios.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(b.data + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.dia_inteiro ? "Dia inteiro" : `${b.hora_inicio?.slice(0, 5)} — ${b.hora_fim?.slice(0, 5)}`}
                          {b.motivo && ` • ${b.motivo}`}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBloqueio(b.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FERIADOS TAB ===== */}
        <TabsContent value="feriados" className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><PartyPopper className="h-5 w-5 text-primary" /> Cadastrar Feriado</CardTitle>
                <CardDescription>Feriados ficam visíveis para todos os pacientes no painel deles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Data *</Label><Input type="date" value={feriadoData} onChange={e => setFeriadoData(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Descrição *</Label><Input value={feriadoDescricao} onChange={e => setFeriadoDescricao(e.target.value)} placeholder="Ex: Natal, Tiradentes..." /></div>
                </div>
                <Button onClick={handleAddFeriado} className="gap-1"><Plus className="h-4 w-4" /> Cadastrar Feriado</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Feriados Cadastrados</CardTitle></CardHeader>
            <CardContent>
              {feriados.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum feriado cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {feriados.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(f.data + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">{f.descricao}</p>
                      </div>
                      {canManage && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFeriado(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vacancy Grid Dialog */}
      <Dialog open={showVacancyGrid} onOpenChange={setShowVacancyGrid}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vagas Disponíveis – {vacancyProfName}</DialogTitle>
          </DialogHeader>

          {/* Professional selector */}
          <div className="mb-4">
            <Label className="text-xs mb-1 block">Profissional</Label>
            <Select value={effectiveVacancyProfId} onValueChange={setVacancyProfId}>
              <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
              <SelectContent>
                {(profissionais as any[]).map((p: any) => (
                  <SelectItem key={p.id} value={p.user_id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => setVacancyWeek(d => subWeeks(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {format(vacancyWeekStart, "dd/MM")} – {format(vacancyWeekEnd, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={vacancyWeek}
                    onSelect={(d) => { if (d) setVacancyWeek(d); }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="sm" onClick={() => setVacancyWeek(new Date())}>Hoje</Button>
            </div>
            <Button variant="outline" size="icon" onClick={() => setVacancyWeek(d => addWeeks(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid: columns = days, rows = time ranges */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted text-left min-w-[100px]">Horário</th>
                  {vacancyDays.map((day) => (
                    <th key={day.toISOString()} className="border p-2 bg-muted text-center min-w-[90px]">
                      <div className="font-semibold">{format(day, "EEE", { locale: ptBR })}</div>
                      <div className="text-xs text-muted-foreground font-normal">{format(day, "dd/MM")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vacancyTimeRanges.length === 0 ? (
                  <tr><td colSpan={8} className="border p-8 text-center text-muted-foreground">Nenhum horário configurado para este profissional</td></tr>
                ) : (
                  vacancyTimeRanges.map((range) => {
                    const [inicio, fim] = range.split("-");
                    return (
                      <tr key={range}>
                        <td className="border p-2 font-medium text-center bg-muted/30">{inicio} — {fim}</td>
                        {vacancyDays.map((day) => {
                          const dayOfWeek = day.getDay();
                          const slot = vacancySlots.find(s => s.dia_semana === dayOfWeek && s.hora_inicio.slice(0, 5) === inicio && s.hora_fim.slice(0, 5) === fim);
                          if (!slot) return <td key={day.toISOString()} className="border p-2 text-center text-muted-foreground">—</td>;
                          const vacancy = getVacancyForSlotOnDate(slot, day);
                          const occupied = slot.max_pacientes - vacancy;
                          return (
                            <td key={day.toISOString()} className={cn("border p-2 text-center", vacancy === 0 ? "bg-destructive/10" : "bg-primary/5")}>
                              <div className={cn("text-sm font-bold", vacancy === 0 ? "text-destructive" : "text-primary")}>
                                {vacancy === 0 ? "Lotado" : `${vacancy} vaga${vacancy > 1 ? "s" : ""}`}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{occupied}/{slot.max_pacientes}</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisponibilidadeProfissional;
