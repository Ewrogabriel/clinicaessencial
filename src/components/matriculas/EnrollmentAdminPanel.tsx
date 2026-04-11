import { useState } from "react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Shield, Lock, Unlock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { enrollmentService } from "@/modules/matriculas/services/enrollmentService";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// CANCELLATION POLICY EDITOR
// ─────────────────────────────────────────────────────────────
function CancellationPolicyEditor() {
    const queryClient = useQueryClient();

    const { data: policy, isLoading } = useQuery({
        queryKey: ["cancellation-policy"],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("cancellation_policies")
                .select("*")
                .limit(1)
                .single();
            return data;
        },
    });

    const [form, setForm] = useState<any>(null);

    // Sync form when policy loads
    if (policy && !form) setForm({ ...policy });

    const save = useMutation({
        mutationFn: async () => {
            const { error } = await (supabase as any)
                .from("cancellation_policies")
                .update({
                    min_hours_before_cancel: Number(form.min_hours_before_cancel),
                    reschedule_limit_days: Number(form.reschedule_limit_days),
                    require_justification_after_limit: form.require_justification_after_limit,
                    monthly_reschedule_limit: Number(form.monthly_reschedule_limit),
                })
                .eq("id", form.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cancellation-policy"] });
            toast.success("✅ Política de cancelamento salva!");
        },
        onError: (err) => {
            toast.error("Erro ao salvar", { description: String(err) });
        },
    });

    if (isLoading || !form) {
        return <p className="text-sm text-muted-foreground">Carregando política...</p>;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <Label className="text-xs">Antecedência mínima para cancelar (horas)</Label>
                    <Input
                        type="number"
                        min={0}
                        className="mt-1"
                        value={form.min_hours_before_cancel}
                        onChange={(e) => setForm({ ...form, min_hours_before_cancel: e.target.value })}
                    />
                </div>
                <div>
                    <Label className="text-xs">Prazo máximo para reposição (dias)</Label>
                    <Input
                        type="number"
                        min={1}
                        className="mt-1"
                        value={form.reschedule_limit_days}
                        onChange={(e) => setForm({ ...form, reschedule_limit_days: e.target.value })}
                    />
                </div>
                <div>
                    <Label className="text-xs">Limite de reposições por mês</Label>
                    <Input
                        type="number"
                        min={0}
                        className="mt-1"
                        value={form.monthly_reschedule_limit}
                        onChange={(e) => setForm({ ...form, monthly_reschedule_limit: e.target.value })}
                    />
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    checked={form.require_justification_after_limit}
                    onCheckedChange={(v) => setForm({ ...form, require_justification_after_limit: v })}
                />
                <Label className="text-sm">Exigir justificativa após atingir o limite de reposições</Label>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
                <Settings className="h-4 w-4" />
                {save.isPending ? "Salvando..." : "Salvar Política"}
            </Button>
        </div>
    );
}

// Commission rules are managed exclusively in Equipe (Profissionais) page

// ─────────────────────────────────────────────────────────────
// ENROLLMENT BLOCK MANAGER (Admin manual block)
// ─────────────────────────────────────────────────────────────
function EnrollmentBlockManager() {
    const queryClient = useQueryClient();
    const [blocking, setBlocking] = useState<any>(null);
    const [motive, setMotive] = useState("");

    const { data: enrollments = [], isLoading } = useQuery({
        queryKey: ["enrollments-block-view"],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("matriculas")
                .select("id, status, auto_renew, bloqueado_admin, bloqueio_motivo, paciente_id, valor_mensal, pacientes(nome)")
                .in("status", ["ativa", "suspensa"])
                .order("created_at", { ascending: false });
            return data ?? [];
        },
    });

    const toggleBlock = useMutation({
        mutationFn: async ({ id, block, motivo }: { id: string; block: boolean; motivo: string }) => {
            const { error } = await (supabase as any)
                .from("matriculas")
                .update({
                    bloqueado_admin: block,
                    bloqueio_motivo: block ? motivo : null,
                })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["enrollments-block-view"] });
            queryClient.invalidateQueries({ queryKey: ["matriculas"] });
            toast.success(blocking?.bloqueado_admin ? "✅ Matrícula desbloqueada" : "🔒 Matrícula bloqueada");
            setBlocking(null);
            setMotive("");
        },
        onError: (err) => {
            toast.error("Erro", { description: String(err) });
        },
    });

    const { user } = useAuth();
    const { activeClinicId } = useClinic();

    const generateSessions = useMutation({
        mutationFn: async (enrollmentId: string) => {
            if (!user) throw new Error("Não autenticado");

            const { data: fullMat } = await supabase
                .from("matriculas")
                .select("*, weekly_schedules(*)")
                .eq("id", enrollmentId)
                .single();

            if (!fullMat) throw new Error("Matrícula não encontrada");

            const { data: lastAgend } = await supabase
                .from("agendamentos")
                .select("data_horario")
                .eq("enrollment_id", enrollmentId)
                .order("data_horario", { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextMonth = lastAgend 
                ? addMonths(new Date(lastAgend.data_horario), 1)
                : addMonths(new Date(), 1);
            
            const startDate = format(startOfMonth(nextMonth), "yyyy-MM-dd");
            const endDate = format(endOfMonth(nextMonth), "yyyy-MM-dd");

            return await enrollmentService.generateSessions({
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
                monthlyValue: Number(fullMat.valor_mensal || 0),
                tipoSessao: (fullMat.tipo_sessao || "grupo") as "grupo" | "individual",
                clinicId: fullMat.clinic_id || activeClinicId || "",
                userId: user.id
            });
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula"] });
            queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
            toast.success(`✅ ${count} sessões e cobrança mensal geradas com sucesso!`);
        },
        onError: (err) => toast.error("Erro ao gerar sessões", { description: String(err) }),
    });

    const processAutoRenewals = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Não autenticado");
            // Filter only those with auto_renew = true and status = 'ativa'
            const toRenew = enrollments.filter((e: any) => e.status === "ativa" && e.auto_renew);
            if (toRenew.length === 0) return 0;

            let totalCount = 0;
            const promises = toRenew.map(async (enrollment: any) => {
                // Fetch full enrollment with weekly schedules
                const { data: fullMat } = await supabase
                    .from("matriculas")
                    .select("*, weekly_schedules(*)")
                    .eq("id", enrollment.id)
                    .single();

                if (!fullMat) return;

                // Check if already has sessions for next month
                const { data: lastAgend } = await supabase
                    .from("agendamentos")
                    .select("data_horario")
                    .eq("enrollment_id", enrollment.id)
                    .order("data_horario", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const nextMonth = lastAgend 
                    ? addMonths(new Date(lastAgend.data_horario), 1)
                    : addMonths(new Date(), 1);
                
                const startDate = format(startOfMonth(nextMonth), "yyyy-MM-dd");
                const endDate = format(endOfMonth(nextMonth), "yyyy-MM-dd");

                // Check if this next month already has a monthly payment
                const { data: existingPay } = await supabase
                    .from("pagamentos_mensalidade")
                    .select("id")
                    .eq("matricula_id", fullMat.id)
                    .eq("mes_referencia", format(startOfMonth(nextMonth), "yyyy-MM-01"))
                    .maybeSingle();
                
                if (existingPay) return; // Already processed

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
                    monthlyValue: Number(fullMat.valor_mensal || 0),
                    tipoSessao: (fullMat.tipo_sessao || "grupo") as "grupo" | "individual",
                    clinicId: fullMat.clinic_id || activeClinicId || "",
                    userId: user.id
                });
                totalCount += count;
            });

            await Promise.all(promises);
            return totalCount;
        },
        onSuccess: (total) => {
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            queryClient.invalidateQueries({ queryKey: ["pagamentos_mensalidade"] });
            queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
            if (total > 0) {
              toast.success(`✅ Renovações automáticas concluídas! ${total} sessões geradas.`);
            } else {
              toast.info("Não há novas renovações pendentes para as matrículas marcadas.");
            }
        },
        onError: (err) => toast.error("Erro no processamento automático", { description: String(err) }),
    });

    const generateAllActive = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Não autenticado");
            const activeEnrollments = enrollments.filter((e: any) => e.status === "ativa");
            if (activeEnrollments.length === 0) return 0;

            let totalCount = 0;
            const promises = activeEnrollments.map(async (enrollment: any) => {
                // Fetch full enrollment with weekly schedules
                const { data: fullMat } = await supabase
                    .from("matriculas")
                    .select("*, weekly_schedules(*)")
                    .eq("id", enrollment.id)
                    .single();

                if (!fullMat) return;

                const { data: lastAgend } = await supabase
                    .from("agendamentos")
                    .select("data_horario")
                    .eq("enrollment_id", enrollment.id)
                    .order("data_horario", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const nextMonth = lastAgend 
                    ? addMonths(new Date(lastAgend.data_horario), 1)
                    : addMonths(new Date(), 1);
                
                const startDate = format(startOfMonth(nextMonth), "yyyy-MM-dd");
                const endDate = format(endOfMonth(nextMonth), "yyyy-MM-dd");

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
                    monthlyValue: Number(fullMat.valor_mensal || 0),
                    tipoSessao: (fullMat.tipo_sessao || "grupo") as "grupo" | "individual",
                    clinicId: fullMat.clinic_id || activeClinicId || "",
                    userId: user.id
                });
                totalCount += count;
            });

            await Promise.all(promises);
            return totalCount;
        },
        onSuccess: (total) => {
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula"] });
            queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
            toast.success(`✅ Concluído! Total de ${total} sessões geradas para todas as matrículas ativas.`);
        },
        onError: (err) => toast.error("Erro na geração em lote", { description: String(err) }),
    });

    if (isLoading) return <p className="text-sm text-muted-foreground">Carregando matrículas...</p>;

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-3">
                <Button 
                    variant="outline" 
                    className="gap-2 border-primary text-primary hover:bg-primary/5"
                    onClick={() => processAutoRenewals.mutate()}
                    disabled={processAutoRenewals.isPending}
                >
                    <RefreshCw className={`h-4 w-4 ${processAutoRenewals.isPending ? "animate-spin" : ""}`} />
                    {processAutoRenewals.isPending ? "Processando..." : "Processar Renovações Automáticas"}
                </Button>
                <Button 
                    variant="secondary" 
                    className="gap-2"
                    onClick={() => generateAllActive.mutate()}
                    disabled={generateAllActive.isPending}
                >
                    <RefreshCw className={`h-4 w-4 ${generateAllActive.isPending ? "animate-spin" : ""}`} />
                    {generateAllActive.isPending ? "Gerando..." : "Forçar Próximo Mês (Todas as Ativas)"}
                </Button>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Valor/mês</TableHead>
                        <TableHead>Renovação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Bloqueio</TableHead>
                        <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {enrollments.map((e: any) => (
                        <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.pacientes?.nome ?? "—"}</TableCell>
                            <TableCell>R$ {Number(e.valor_mensal).toFixed(2)}</TableCell>
                            <TableCell>
                                <Badge variant={e.auto_renew ? "default" : "outline"} className={e.auto_renew ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" : ""}>
                                    {e.auto_renew ? "Sim" : "Não"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={e.status === "ativa" ? "default" : "secondary"}>
                                    {e.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {e.bloqueado_admin ? (
                                    <div>
                                        <Badge variant="destructive">Bloqueada</Badge>
                                        {e.bloqueio_motivo && (
                                            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                                                {e.bloqueio_motivo}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <Badge variant="outline">Livre</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant={e.bloqueado_admin ? "outline" : "destructive"}
                                        className="gap-1"
                                        onClick={() => setBlocking(e)}
                                    >
                                        {e.bloqueado_admin ? (
                                            <><Unlock className="h-3 w-3" />Desbloquear</>
                                        ) : (
                                            <><Lock className="h-3 w-3" />Bloquear</>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        title="Gerar sessões do próximo mês"
                                        onClick={() => generateSessions.mutate(e.id)}
                                        disabled={generateSessions.isPending || e.bloqueado_admin}
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Gerar mês
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {enrollments.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                Nenhuma matrícula ativa ou suspensa.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Dialog de confirmação de bloqueio */}
            <AlertDialog open={!!blocking} onOpenChange={(v) => !v && setBlocking(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {blocking?.bloqueado_admin ? "Desbloquear matrícula?" : "Bloquear matrícula?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Paciente: <strong>{blocking?.pacientes?.nome}</strong>
                            {!blocking?.bloqueado_admin && (
                                <div className="mt-3">
                                    <Label className="text-xs">Motivo do bloqueio (opcional)</Label>
                                    <Textarea
                                        className="mt-1"
                                        placeholder="Ex: mensalidade em atraso, pendência financeira..."
                                        value={motive}
                                        onChange={(e) => setMotive(e.target.value)}
                                        rows={2}
                                    />
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                toggleBlock.mutate({
                                    id: blocking.id,
                                    block: !blocking.bloqueado_admin,
                                    motivo: motive,
                                })
                            }
                            className={blocking?.bloqueado_admin ? "" : "bg-destructive hover:bg-destructive/90"}
                        >
                            {blocking?.bloqueado_admin ? "Desbloquear" : "Bloquear"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export function EnrollmentAdminPanel() {
    return (
        <div className="space-y-6">
            {/* Política de Cancelamento */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Política de Cancelamento e Reposição
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CancellationPolicyEditor />
                </CardContent>
            </Card>

            {/* Bloqueio de Matrículas */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        Controle de Bloqueio de Matrículas
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Bloqueie manualmente matrículas em atraso ou pendência financeira.
                        Também use o botão "Gerar mês" para criar as sessões do próximo mês antecipadamente.
                    </p>
                </CardHeader>
                <CardContent>
                    <EnrollmentBlockManager />
                </CardContent>
            </Card>
        </div>
    );
}
