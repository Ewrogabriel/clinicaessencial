import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Pause, X, ChevronRight, BarChart2, Calendar,
  RefreshCw, User, DollarSign, Settings, ShieldAlert, Eye,
  LayoutGrid, List, Play
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EnrollmentForm, EnrollmentFormData, WeeklyScheduleEntry
} from "@/components/matriculas/EnrollmentForm";
import { EnrollmentDetails } from "@/components/matriculas/EnrollmentDetails";
import { EnrollmentAdminPanel } from "@/components/matriculas/EnrollmentAdminPanel";
import { CancellationPolicies } from "@/components/matriculas/CancellationPolicies";
import { enrollmentService } from "@/modules/matriculas/services/enrollmentService";
import { MatriculaPayments } from "@/components/matriculas/MatriculaPayments";
import Planos from "./Planos";
import { toast } from "sonner";

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
    tipo_sessao: "grupo",
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
  const timeParts = timeStr.split(":");
  const normalizedTime = `${timeParts[0]}:${timeParts[1] || "00"}`;
  const d = new Date(`${dateStr}T${normalizedTime}:00`);
  if (isNaN(d.getTime())) {
    const now = new Date();
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const m = String(Math.abs(offset) % 60).padStart(2, "0");
    return `${sign}${h}:${m}`;
  }
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
  const { activeClinicId } = useClinic();
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Detail view
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Payment tracking view
  const [paymentTrackingMat, setPaymentTrackingMat] = useState<any>(null);

  // Confirm dialogs
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  // --------------- Queries ---------------
  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ["matriculas", filterPaciente, filterStatus, activeClinicId],
    queryFn: async () => {
      let query = supabase
        .from("matriculas")
        .select("*, pacientes(nome)")
        .order("created_at", { ascending: false });

      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
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
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").eq("status", "ativo").order("nome");
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
      const { error: updateErr } = await (supabase
        .from("matriculas") as any)
        .update({
          valor_mensal: finalValue,
          due_day: parseInt(editData.due_day) || 10,
          auto_renew: editData.auto_renew,
          observacoes: editData.observacoes || null,
          desconto: descLine,
          tipo_atendimento: editData.tipo_atendimento,
          tipo_sessao: editData.tipo_sessao,
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
      await enrollmentService.deleteFutureSessions(editingId, validFrom);

      // Generate new sessions from validFrom to next 6 months
      const endDate = format(addMonths(new Date(validFrom), 6), "yyyy-MM-dd");
      
      await enrollmentService.generateSessions({
        enrollmentId: editingId,
        pacienteId: editData.paciente_id,
        weeklySchedules: editData.weekly_schedules,
        startDate: validFrom,
        endDate: endDate,
        tipoAtendimento: editData.tipo_atendimento,
        monthlyValue: finalValue,
        tipoSessao: editData.tipo_sessao,
        clinicId: activeClinicId || "",
        userId: user.id
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["current-patient"] });
      setEditOpen(false);
      toast.success("✅ Matrícula atualizada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar matrícula", { description: err.message });
    }
  });

  const createMatricula = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      const monthly = parseFloat(formData.monthly_value) || 0;
      const desc = parseFloat(formData.desconto) || 0;
      const descValue = formData.desconto_tipo === "percentual" ? (monthly * desc) / 100 : desc;
      const finalValue = monthly - descValue;

      // Calculate data_vencimento from due_day: use the due_day of the next month
      const dueDayNum = Math.min(parseInt(formData.due_day) || 10, 31);
      // Use noon (T12:00:00) to construct a local-time Date and avoid UTC-shift on date-only strings
      const startDateObj = new Date(formData.start_date + "T12:00:00");
      const nextMonthDate = addMonths(startDateObj, 1);
      const nmYear = nextMonthDate.getFullYear();
      const nmMonth = nextMonthDate.getMonth();
      const lastDayOfNextMonth = new Date(nmYear, nmMonth + 1, 0).getDate();
      const actualDueDay = Math.min(dueDayNum, lastDayOfNextMonth);
      const dueDate = format(new Date(nmYear, nmMonth, actualDueDay), "yyyy-MM-dd");

      // Create enrollment
      const { data: mat, error } = await (supabase
        .from("matriculas") as any)
        .insert({
          paciente_id: formData.paciente_id,
          profissional_id: user.id,
          tipo: "mensal",
          tipo_atendimento: formData.tipo_atendimento,
          valor_mensal: finalValue,
          data_inicio: formData.start_date,
          data_vencimento: dueDate,
          due_day: dueDayNum,
          auto_renew: formData.auto_renew,
          observacoes: formData.observacoes || null,
          desconto: descValue,
          criada_por: user.id,
          status: "ativa",
          clinic_id: activeClinicId,
          tipo_sessao: formData.tipo_sessao,
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

        // Generate sessions for the next 6 months
        const endDate = format(addMonths(new Date(formData.start_date), 6), "yyyy-MM-dd");
        
        await enrollmentService.generateSessions({
          enrollmentId: mat.id,
          pacienteId: formData.paciente_id,
          weeklySchedules: formData.weekly_schedules,
          startDate: formData.start_date,
          endDate: endDate,
          tipoAtendimento: formData.tipo_atendimento,
          monthlyValue: finalValue,
          tipoSessao: formData.tipo_sessao,
          clinicId: activeClinicId || "",
          userId: user.id
        });
      }

      // pagamentos_mensalidade are already created by enrollmentService.generateSessions above

      return mat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["current-patient"] });
      setFormOpen(false);
      setFormData(getEmptyForm());
      toast.success("✅ Matrícula criada com sucesso!");
    },
    onError: (err: any) => {
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast.error("Erro ao criar matrícula", { description: msg });
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
      toast.success("Matrícula suspensa.");
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
      toast.success("Matrícula cancelada.");
    },
  });

  const ativarMatricula = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matriculas").update({ status: "ativa" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast.success("Matrícula reativada.");
    },
  });

  const toggleAutoRenew = useMutation({
    mutationFn: async ({ id, auto_renew }: { id: string; auto_renew: boolean }) => {
      const { error } = await supabase.from("matriculas").update({ auto_renew }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast.success("Renovação automática atualizada.");
    },
  });

  const generateNextMonth = useMutation({
    mutationFn: async (enrollmentId: string) => {
      if (!user) throw new Error("Não autenticado");

      const { data: fullMat, error: matErr } = await supabase
        .from("matriculas")
        .select("*, weekly_schedules(*)")
        .eq("id", enrollmentId)
        .single();

      if (matErr || !fullMat) throw new Error("Matrícula não encontrada");

      const { data: lastAgend } = await supabase
        .from("agendamentos")
        .select("data_horario")
        .eq("enrollment_id", enrollmentId)
        .order("data_horario", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { startOfMonth, endOfMonth, addMonths: addMonthsFn } = await import("date-fns");
      const nextMonth = lastAgend 
          ? addMonthsFn(new Date(lastAgend.data_horario), 1)
          : addMonthsFn(new Date(), 1);
      
      const startDate = format(startOfMonth(nextMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(nextMonth), "yyyy-MM-dd");
      const mesRef = format(nextMonth, "yyyy-MM") + "-01";
      const monthlyValue = Number(fullMat.valor_mensal || 0);
      const clinicId = fullMat.clinic_id || activeClinicId || "";
      
      const hasSchedules = fullMat.weekly_schedules && fullMat.weekly_schedules.length > 0;

      if (hasSchedules) {
        // Com schedules: gerar sessões + mensalidade via serviço
        const count = await enrollmentService.generateSessions({
            enrollmentId: fullMat.id,
            pacienteId: fullMat.paciente_id,
            weeklySchedules: fullMat.weekly_schedules.map((s: any) => ({
                weekday: s.weekday,
                time: s.time,
                professional_id: s.professional_id,
                session_duration: s.session_duration
            })),
            startDate,
            endDate,
            tipoAtendimento: fullMat.tipo_atendimento || "Pilates",
            monthlyValue,
            tipoSessao: (fullMat.tipo_sessao || "grupo") as "grupo" | "individual",
            clinicId,
            userId: user.id
        });
        return { sessions: count, payments: count > 0 ? 1 : 0 };
      } else {
        // Sem schedules: criar apenas a mensalidade financeira
        const { data: existing } = await supabase
          .from("pagamentos_mensalidade")
          .select("id")
          .eq("matricula_id", enrollmentId)
          .eq("mes_referencia", mesRef)
          .maybeSingle();

        if (!existing && monthlyValue > 0) {
          const { error: insertError } = await supabase
            .from("pagamentos_mensalidade")
            .insert({
              matricula_id: enrollmentId,
              paciente_id: fullMat.paciente_id,
              clinic_id: clinicId,
              valor: monthlyValue,
              mes_referencia: mesRef,
              status: "aberto"
            });

          if (insertError) throw insertError;
          return { sessions: 0, payments: 1 };
        }
        return { sessions: 0, payments: 0 };
      }
    },
    onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
        queryClient.invalidateQueries({ queryKey: ["pagamentos_mensalidade"] });
        queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula"] });
        queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
        
        if (result.sessions > 0) {
          toast.success(`${result.sessions} sessões e cobrança mensal geradas com sucesso!`);
        } else if (result.payments > 0) {
          toast.success("Cobrança mensal gerada com sucesso!");
        } else {
          toast.info("A cobrança para o próximo mês já existe.");
        }
    },
    onError: (err) => toast.error("Erro ao gerar sessões", { description: String(err) }),
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
      tipo_sessao: mat.tipo_sessao || "grupo",
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Matrículas Recorrentes</h1>
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
                <div className="flex items-end justify-end">
                  <div className="flex border rounded-md p-1 bg-muted/50 h-10">
                    <Button 
                      variant={viewMode === "grid" ? "secondary" : "ghost"} 
                      size="sm" 
                      onClick={() => setViewMode("grid")}
                      className="h-8 w-8 p-0"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={viewMode === "list" ? "secondary" : "ghost"} 
                      size="sm" 
                      onClick={() => setViewMode("list")}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrollment Display */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
          ) : matriculas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma matrícula encontrada.</p>
              {isAdmin && <Button size="sm" className="mt-3 gap-2" onClick={() => setFormOpen(true)}><Plus className="h-3 w-3" />Criar primeira matrícula</Button>}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matriculas.map((mat: any) => {
                const statusCfg = STATUS_CONFIG[mat.status] || STATUS_CONFIG.vencida;
                return (
                  <Card key={mat.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDetail(mat)}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header: patient + status */}
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <span
                            className="font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate block"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pacientes/${mat.paciente_id}/detalhes`);
                            }}
                          >
                            {mat.pacientes?.nome || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">{mat.tipo_atendimento || "mensal"}</span>
                        </div>
                        <Badge variant={statusCfg.variant}>
                          {statusCfg.label}
                        </Badge>
                      </div>

                      {/* Value + dates */}
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Valor Mensal</span>
                          <div className="font-bold text-primary">R$ {parseFloat(mat.valor_mensal || 0).toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs">Início</span>
                          <div className="text-xs font-medium">
                            {mat.data_inicio ? format(new Date(mat.data_inicio + "T12:00:00"), "dd/MM/yyyy") : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Controls row */}
                      <div className="flex items-center justify-between py-2 border-y border-muted/50">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={mat.auto_renew} 
                            onCheckedChange={(v) => toggleAutoRenew.mutate({ id: mat.id, auto_renew: v })}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[10px] font-medium text-muted-foreground">Renovação</span>
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 px-2 gap-1 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                          onClick={(e) => { e.stopPropagation(); generateNextMonth.mutate(mat.id); }}
                          disabled={generateNextMonth.isPending}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Renovar Agora
                        </Button>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2"
                          onClick={() => setPaymentTrackingMat(mat)}>
                          <DollarSign className="h-3 w-3" /> Pagamentos
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2"
                          onClick={() => openEdit(mat)}>
                          <Calendar className="h-3 w-3" /> Editar
                        </Button>
                        {isAdmin && mat.status === "ativa" && (
                          <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2"
                            onClick={() => setSuspendTarget(mat.id)}>
                            <Pause className="h-3 w-3" />
                          </Button>
                        )}
                        {isAdmin && mat.status === "suspensa" && (
                          <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2"
                            onClick={() => ativarMatricula.mutate(mat.id)}>
                            Reativar
                          </Button>
                        )}
                        {isAdmin && mat.status !== "cancelada" && (
                          <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setCancelTarget(mat.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Atendimento</TableHead>
                      <TableHead>Vcto/Referência</TableHead>
                      <TableHead>Renovação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriculas.map((mat: any) => {
                      const statusCfg = STATUS_CONFIG[mat.status] || STATUS_CONFIG.vencida;
                      return (
                        <TableRow key={mat.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(mat)}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{mat.pacientes?.nome || "—"}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">{mat.tipo_sessao}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-xs">{mat.tipo_atendimento}</TableCell>
                          <TableCell className="text-xs font-semibold">R$ {parseFloat(mat.valor_mensal || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">
                            {mat.data_inicio ? format(new Date(mat.data_inicio + "T12:00:00"), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-center">
                              <Switch 
                                checked={mat.auto_renew} 
                                onCheckedChange={(v) => toggleAutoRenew.mutate({ id: mat.id, auto_renew: v })}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 text-blue-600 border-blue-200" 
                                title="Renovar para o próximo mês"
                                onClick={() => generateNextMonth.mutate(mat.id)}
                                disabled={generateNextMonth.isPending}
                              >
                                <Play className="h-4 w-4 fill-current" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPaymentTrackingMat(mat)}>
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(mat)}>
                                <Calendar className="h-4 w-4" />
                              </Button>
                              {isAdmin && mat.status === "ativa" && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSuspendTarget(mat.id)}>
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && mat.status !== "cancelada" && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setCancelTarget(mat.id)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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

      {/* ---- Dialog: Payment Tracking ---- */}
      <Dialog open={!!paymentTrackingMat} onOpenChange={(v) => !v && setPaymentTrackingMat(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Acompanhamento de Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {paymentTrackingMat && (
              <MatriculaPayments
                matriculaId={paymentTrackingMat.id}
                pacienteId={paymentTrackingMat.paciente_id}
                valorMensal={parseFloat(paymentTrackingMat.valor_mensal || 0)}
                diaVencimento={paymentTrackingMat.due_day || 10}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Matriculas;

