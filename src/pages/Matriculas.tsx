import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Pause, X, ChevronRight, BarChart2, Calendar,
  RefreshCw, User, DollarSign, Settings, ShieldAlert
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EnrollmentForm, EnrollmentFormData, WeeklyScheduleEntry
} from "@/components/enrollments/EnrollmentForm";
import { EnrollmentDetails } from "@/components/enrollments/EnrollmentDetails";
import { EnrollmentAdminPanel } from "@/components/enrollments/EnrollmentAdminPanel";
import { CancellationPolicies } from "@/components/enrollments/CancellationPolicies";
import Planos from "./Planos";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativa: { label: "Ativa", variant: "default" },
  suspensa: { label: "Suspensa", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
  vencida: { label: "Vencida", variant: "outline" },
};

function getEmptyForm(): EnrollmentFormData {
  return {
    paciente_id: "",
    monthly_value: "",
    due_day: "10",
    start_date: format(new Date(), "yyyy-MM-dd"),
    auto_renew: true,
    tipo_atendimento: "pilates",
    desconto: "0",
    desconto_tipo: "percentual",
    observacoes: "",
    weekly_schedules: [],
  };
}

// Add a separate type for Edit Form to include effective date
export type EnrollmentEditData = EnrollmentFormData & {
  valid_from: string;
};

function getEmptyEditForm(): EnrollmentEditData {
  return {
    ...getEmptyForm(),
    valid_from: format(new Date(), "yyyy-MM-dd"),
  };
}

// Helper: get local timezone offset string like "-03:00"
function getLocalTZOffset(dateStr: string, timeStr: string): string {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}

// Helper: generate agendamentos dates from weekly_schedules for a period
function getDatesForWeekday(startDateStr: string, endDateStr: string, weekday: number): string[] {
  const dates: string[] = [];
  const end = new Date(endDateStr);
  let current = new Date(startDateStr);
  // Normalize to noon to avoid DST issues
  current = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12, 0, 0);

  while (current <= end) {
    if (current.getDay() === weekday) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

const Matriculas = () => {
  const { user, isAdmin } = useAuth();
  const navigate = (path: string) => window.location.href = path;
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState("matriculas");
  const [formOpen, setFormOpen] = useState(false);

  // Auto-open form when navigated with ?nova=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nova") === "1") {
      setFormOpen(true);
      // Clean up the URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<EnrollmentFormData>(getEmptyForm());
  const [editData, setEditData] = useState<EnrollmentEditData>(getEmptyEditForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPaciente, setFilterPaciente] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Detail view
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Confirm dialogs
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // --------------- Queries ---------------
  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ["matriculas", filterPaciente, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("matriculas")
        .select("*, pacientes(nome)")
        .order("created_at", { ascending: false });

      if (filterStatus) query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) throw error;

      let result = data || [];
      if (filterPaciente) {
        result = result.filter((m: any) =>
          m.pacientes?.nome?.toLowerCase().includes(filterPaciente.toLowerCase())
        );
      }
      return result;
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-list"],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome").eq("status", "ativo").order("nome");
      return data ?? [];
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids).order("nome");
      return data ?? [];
    },
  });

  // --------------- Mutations ---------------

  const updateMatricula = useMutation({
    mutationFn: async () => {
      if (!user || !editingId) throw new Error("Não autenticado ou ID faltando");

      const monthly = parseFloat(editData.monthly_value) || 0;
      const descLine = parseFloat(editData.desconto) || 0;
      const descValue = editData.desconto_tipo === "percentual" ? (monthly * descLine) / 100 : descLine;
      const finalValue = monthly - descValue;

      // 1. Update enrollment metadata
      const { error: updateErr } = await supabase
        .from("matriculas")
        .update({
          valor_mensal: finalValue,
          due_day: parseInt(editData.due_day) || 10,
          auto_renew: editData.auto_renew,
          observacoes: editData.observacoes || null,
          desconto: descLine,
          tipo_atendimento: editData.tipo_atendimento,
        })
        .eq("id", editingId);

      if (updateErr) throw updateErr;

      // 2. Update weekly_schedules (Full replace for this enrollment)
      // Delete old ones first
      await supabase.from("weekly_schedules").delete().eq("enrollment_id", editingId);

      const schedInserts = editData.weekly_schedules.map((s: WeeklyScheduleEntry) => ({
        enrollment_id: editingId,
        weekday: s.weekday,
        time: s.time,
        professional_id: s.professional_id,
        session_duration: s.session_duration,
      }));
      const { error: schedsErr } = await supabase.from("weekly_schedules").insert(schedInserts);
      if (schedsErr) throw schedsErr;

      // 3. Handle Sessions based on "Valid From" date
      const validFrom = editData.valid_from;

      // Delete future sessions from this enrollment (agendado/confirmado only)
      await supabase
        .from("agendamentos")
        .delete()
        .eq("enrollment_id", editingId)
        .gte("data_horario", `${validFrom}T00:00:00`)
        .in("status", ["agendado", "confirmado"]);

      // Generate new sessions from validFrom to next 30 days
      const endDate = format(addMonths(new Date(validFrom), 1), "yyyy-MM-dd");
      const groupId = crypto.randomUUID();
      const toInsert: any[] = [];

      for (const s of editData.weekly_schedules) {
        const dates = getDatesForWeekday(validFrom, endDate, s.weekday);
        for (const dt of dates) {
          toInsert.push({
            paciente_id: editData.paciente_id,
            profissional_id: s.professional_id,
            data_horario: `${dt}T${s.time}:00${getLocalTZOffset(dt, s.time)}`,
            duracao_minutos: s.session_duration,
            tipo_atendimento: editData.tipo_atendimento,
            status: "agendado",
            recorrente: true,
            recorrencia_grupo_id: groupId,
            recorrencia_fim: endDate,
            enrollment_id: editingId,
            valor_sessao: finalValue > 0 && editData.weekly_schedules.length > 0
              ? parseFloat((finalValue / Math.round(editData.weekly_schedules.length * 4.33)).toFixed(2))
              : 0,
            created_by: user.id,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error: agErr } = await supabase.from("agendamentos").insert(toInsert);
        if (agErr) throw agErr;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["current-patient"] });
      setEditOpen(false);
      toast({ title: "✅ Matrícula atualizada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar matrícula", description: err.message, variant: "destructive" });
    }
  });

  const createMatricula = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      const monthly = parseFloat(formData.monthly_value) || 0;
      const desc = parseFloat(formData.desconto) || 0;
      const descValue = formData.desconto_tipo === "percentual" ? (monthly * desc) / 100 : desc;
      const finalValue = monthly - descValue;

      // Create enrollment
      const { data: mat, error } = await supabase
        .from("matriculas")
        .insert({
          paciente_id: formData.paciente_id,
          profissional_id: user.id,
          tipo: "mensal",
          valor_mensal: finalValue,
          data_inicio: formData.start_date,
          data_vencimento: format(addMonths(new Date(formData.start_date), 1), "yyyy-MM-dd"),
          due_day: parseInt(formData.due_day) || 10,
          auto_renew: formData.auto_renew,
          observacoes: formData.observacoes || null,
          desconto: descValue,
          criada_por: user.id,
          status: "ativa",
        })
        .select()
        .single();

      if (error) throw error;

      // Create weekly_schedules
      if (formData.weekly_schedules.length > 0) {
        const schedInserts = formData.weekly_schedules.map((s: WeeklyScheduleEntry) => ({
          enrollment_id: mat.id,
          weekday: s.weekday,
          time: s.time,
          professional_id: s.professional_id,
          session_duration: s.session_duration,
        }));
        const { error: schedsErr } = await supabase.from("weekly_schedules").insert(schedInserts);
        if (schedsErr) throw schedsErr;

        // Generate sessions for the next 30 days
        const endDate = format(addMonths(new Date(formData.start_date), 1), "yyyy-MM-dd");
        const groupId = crypto.randomUUID();
        const toInsert: any[] = [];

        for (const s of formData.weekly_schedules) {
          const dates = getDatesForWeekday(formData.start_date, endDate, s.weekday);
          for (const dt of dates) {
            toInsert.push({
              paciente_id: formData.paciente_id,
              profissional_id: s.professional_id,
              data_horario: `${dt}T${s.time}:00${getLocalTZOffset(dt, s.time)}`,
              duracao_minutos: s.session_duration,
              tipo_atendimento: formData.tipo_atendimento,
              status: "agendado",
              recorrente: true,
              recorrencia_grupo_id: groupId,
              recorrencia_fim: endDate,
              enrollment_id: mat.id,
              valor_sessao: finalValue > 0 && formData.weekly_schedules.length > 0
                ? parseFloat((finalValue / Math.round(formData.weekly_schedules.length * 4.33)).toFixed(2))
                : 0,
              created_by: user.id,
            });
          }
        }

        if (toInsert.length > 0) {
          const { error: agErr } = await supabase.from("agendamentos").insert(toInsert);
          if (agErr) throw agErr;
        }
      }

      // Create initial payment record
      if (finalValue > 0) {
        await supabase.from("pagamentos").insert({
          paciente_id: formData.paciente_id,
          plano_id: mat.id,
          profissional_id: user.id,
          valor: finalValue,
          data_vencimento: format(addMonths(new Date(formData.start_date), 1), "yyyy-MM-dd"),
          status: "pendente",
          descricao: `Matrícula Mensal - ${formData.tipo_atendimento}`,
          created_by: user.id,
        });
      }

      return mat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["current-patient"] });
      setFormOpen(false);
      setFormData(getEmptyForm());
      toast({ title: "✅ Matrícula criada com sucesso!" });
    },
    onError: (err: any) => {
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast({ title: "Erro ao criar matrícula", description: msg, variant: "destructive" });
    },
  });

  const suspenderMatricula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriculas").update({ status: "suspensa" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      setSuspendTarget(null);
      toast({ title: "Matrícula suspensa." });
    },
  });

  const cancelarMatricula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("matriculas")
        .update({ status: "cancelada", cancellation_date: new Date().toISOString().split("T")[0] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      setCancelTarget(null);
      toast({ title: "Matrícula cancelada." });
    },
  });

  const ativarMatricula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriculas").update({ status: "ativa" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast({ title: "Matrícula reativada." });
    },
  });

  const openDetail = (mat: any) => {
    setSelectedEnrollment(mat);
    setDetailOpen(true);
  };

  const openEdit = async (mat: any) => {
    // Need to fetch weekly_schedules for this enrollment
    const { data: scheds } = await supabase.from("weekly_schedules").select("*").eq("enrollment_id", mat.id);

    setEditingId(mat.id);
    setEditData({
      paciente_id: mat.paciente_id,
      monthly_value: String(mat.valor_mensal),
      due_day: String(mat.due_day),
      start_date: mat.data_inicio,
      auto_renew: mat.auto_renew,
      tipo_atendimento: mat.tipo_atendimento || "pilates",
      desconto: String(mat.desconto || 0),
      desconto_tipo: "percentual",
      observacoes: mat.observacoes || "",
      weekly_schedules: (scheds || []).map(s => ({
        weekday: s.weekday,
        time: s.time,
        professional_id: s.professional_id,
        session_duration: s.session_duration,
      })),
      valid_from: format(new Date(), "yyyy-MM-dd"), // Defaults to today for changes
    });
    setEditOpen(true);
  };

  // --------------- Stats for header ---------------
  const totalAtivas = matriculas.filter((m: any) => m.status === "ativa").length;
  const mrr = matriculas
    .filter((m: any) => m.status === "ativa")
    .reduce((acc: number, m: any) => acc + (parseFloat(m.valor_mensal) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matrículas Recorrentes</h1>
          <p className="text-muted-foreground text-sm mt-1">Assinaturas mensais com agenda automática e comissão proporcional</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Matrícula
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2 items-center">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Matrículas Ativas</div>
                <div className="text-2xl font-bold">{totalAtivas}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2 items-center">
              <DollarSign className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-xs text-muted-foreground">MRR Total</div>
                <div className="text-2xl font-bold text-green-600">R$ {mrr.toFixed(0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2 items-center">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xs text-muted-foreground">Total Matrículas</div>
                <div className="text-2xl font-bold">{matriculas.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2 items-center">
              <BarChart2 className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-xs text-muted-foreground">Ticket Médio</div>
                <div className="text-2xl font-bold">
                  R$ {totalAtivas > 0 ? (mrr / totalAtivas).toFixed(0) : "0"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 sm:w-[650px]">
          <TabsTrigger value="matriculas" className="gap-2">
            <User className="h-4 w-4" /> Matrículas
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-2">
            <BarChart2 className="h-4 w-4" /> Planos de Sessões
          </TabsTrigger>
          <TabsTrigger value="cancelamento" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Políticas
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              <Settings className="h-4 w-4" /> Administração
            </TabsTrigger>
          )}
        </TabsList>

        {/* MATRÍCULAS TAB */}
        <TabsContent value="matriculas" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Filtrar por Paciente</Label>
                  <Input
                    className="mt-1"
                    placeholder="Nome do paciente..."
                    value={filterPaciente}
                    onChange={(e) => setFilterPaciente(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus || "todos"} onValueChange={(v) => setFilterStatus(v === "todos" ? "" : v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ativa">Ativa</SelectItem>
                      <SelectItem value="suspensa">Suspensa</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lista de Matrículas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
              ) : matriculas.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma matrícula encontrada.</p>
                  {isAdmin && <Button size="sm" className="mt-3 gap-2" onClick={() => setFormOpen(true)}><Plus className="h-3 w-3" />Criar primeira matrícula</Button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor Mensal</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Renovação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matriculas.map((mat: any) => (
                        <TableRow key={mat.id} className="cursor-pointer hover:bg-muted/30"
                          onClick={() => openDetail(mat)}>
                          <TableCell className="font-medium">
                            <span
                              className="text-blue-600 hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/pacientes/${mat.pacientes?.id}/detalhes`);
                              }}
                            >
                              {mat.pacientes?.nome || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize">{mat.tipo_atendimento || mat.tipo || "mensal"}</TableCell>
                          <TableCell>R$ {parseFloat(mat.valor_mensal || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mat.data_inicio ? format(new Date(mat.data_inicio), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          </TableCell>
                          <TableCell>
                            {mat.auto_renew ? (
                              <Badge variant="secondary" className="text-xs"><RefreshCw className="h-2.5 w-2.5 mr-1" />Auto</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_CONFIG[mat.status]?.variant || "outline"}>
                              {STATUS_CONFIG[mat.status]?.label || mat.status}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()} className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {isAdmin && mat.status === "ativa" && (
                                <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7 px-2"
                                  onClick={() => setSuspendTarget(mat.id)}>
                                  <Pause className="h-3 w-3" /> Suspender
                                </Button>
                              )}
                              {isAdmin && mat.status === "suspensa" && (
                                <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7 px-2"
                                  onClick={() => ativarMatricula.mutate(mat.id)}>
                                  Reativar
                                </Button>
                              )}
                              {isAdmin && mat.status !== "cancelada" && (
                                <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => setCancelTarget(mat.id)}>
                                  <X className="h-3 w-3" /> Cancelar
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7 px-2"
                                onClick={() => openEdit(mat)}>
                                <Calendar className="h-3 w-3" /> Editar
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2"
                                onClick={() => openDetail(mat)}>
                                <ChevronRight className="h-3 w-3" /> Detalhes
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANOS TAB */}
        <TabsContent value="planos" className="mt-4">
          <Planos />
        </TabsContent>

        {/* CANCELLATION POLICIES TAB */}
        <TabsContent value="cancelamento" className="mt-4">
          <CancellationPolicies />
        </TabsContent>

        {/* ADMIN TAB */}
        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <EnrollmentAdminPanel />
          </TabsContent>
        )}
      </Tabs>

      {/* ---- Dialog: Nova Matrícula ---- */}
      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setFormData(getEmptyForm()); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nova Matrícula Recorrente</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <EnrollmentForm
              formData={formData}
              setFormData={setFormData}
              pacientes={pacientes as { id: string; nome: string }[]}
              profissionais={profissionais as { user_id: string; nome: string }[]}
            />
          </div>
          <div className="shrink-0 flex justify-end gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMatricula.mutate()}
              disabled={!formData.paciente_id || !formData.monthly_value || createMatricula.isPending}
            >
              {createMatricula.isPending ? "Criando..." : "Criar Matrícula"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Editar Matrícula ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[92vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar Matrícula — Paciente: {editData.paciente_id && (pacientes.find((p: any) => p.id === editData.paciente_id) as any)?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Label className="block mb-2 font-bold">A partir de qual data as alterações valem? *</Label>
              <Input
                type="date"
                value={editData.valid_from}
                onChange={(e) => setEditData({ ...editData, valid_from: e.target.value })}
                className="bg-white"
              />
              <p className="mt-2 text-xs opacity-80">
                Sessões agendadas após esta data serão removidas e recriadas com o novo cronograma.
              </p>
            </div>

            <EnrollmentForm
              formData={editData}
              setFormData={(d: any) => setEditData(d)}
              pacientes={pacientes as { id: string; nome: string }[]}
              profissionais={profissionais as { user_id: string; nome: string }[]}
            />
          </div>
          <div className="shrink-0 flex justify-end gap-3 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => updateMatricula.mutate()}
              disabled={updateMatricula.isPending}
            >
              {updateMatricula.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog: Enrollment Details ---- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Matrícula — {selectedEnrollment?.pacientes?.nome || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {selectedEnrollment && (
              <EnrollmentDetails enrollment={selectedEnrollment} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm: Suspend ---- */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(v) => !v && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender matrícula?</AlertDialogTitle>
            <AlertDialogDescription>
              A geração de novas sessões será pausada até a reativação. Sessões já geradas não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => suspendTarget && suspenderMatricula.mutate(suspendTarget)}>
              Suspender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Confirm: Cancel ---- */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar matrícula?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação encerrará a recorrência permanentemente. Sessões futuras não serão mais geradas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => cancelTarget && cancelarMatricula.mutate(cancelTarget)}>
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Matriculas;
