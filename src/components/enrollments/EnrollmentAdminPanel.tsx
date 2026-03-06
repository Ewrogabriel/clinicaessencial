import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Shield, Percent, Lock, Unlock, RefreshCw } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

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
            toast({ title: "✅ Política de cancelamento salva!" });
        },
        onError: (err) => {
            toast({ title: "Erro ao salvar", description: String(err), variant: "destructive" });
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

// ─────────────────────────────────────────────────────────────
// COMMISSION RULES EDITOR
// ─────────────────────────────────────────────────────────────
function CommissionRulesEditor() {
    const queryClient = useQueryClient();

    const { data: profissionais = [] } = useQuery({
        queryKey: ["profissionais-list"],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("user_id, nome").order("nome");
            return data ?? [];
        },
    });

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ["commission-rules-all"],
        queryFn: async () => {
            const { data } = await (supabase as any).from("commission_rules").select("*");
            return data ?? [];
        },
    });

    const [editPct, setEditPct] = useState<Record<string, string>>({});

    const saveRule = useMutation({
        mutationFn: async (professional_id: string) => {
            const pct = parseFloat(editPct[professional_id] || "0");
            const existing = rules.find((r: any) => r.professional_id === professional_id);
            if (existing) {
                const { error } = await (supabase as any)
                    .from("commission_rules")
                    .update({ percentage: pct })
                    .eq("id", existing.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from("commission_rules")
                    .insert({ professional_id, percentage: pct });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["commission-rules-all"] });
            toast({ title: "✅ Comissão salva!" });
        },
        onError: (err) => {
            toast({ title: "Erro ao salvar comissão", description: String(err), variant: "destructive" });
        },
    });

    const getRule = (user_id: string) =>
        rules.find((r: any) => r.professional_id === user_id);

    const getEditValue = (user_id: string) => {
        if (editPct[user_id] !== undefined) return editPct[user_id];
        const rule = getRule(user_id);
        return rule ? String(rule.percentage) : "0";
    };

    if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead>% Comissão</TableHead>
                    <TableHead className="w-24">Ação</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {profissionais.map((p: any) => (
                    <TableRow key={p.user_id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    className="w-24 h-8"
                                    value={getEditValue(p.user_id)}
                                    onChange={(e) => setEditPct({ ...editPct, [p.user_id]: e.target.value })}
                                />
                                <Percent className="h-3 w-3 text-muted-foreground" />
                            </div>
                        </TableCell>
                        <TableCell>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveRule.mutate(p.user_id)}
                                disabled={saveRule.isPending}
                            >
                                Salvar
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
                {profissionais.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            Nenhum profissional cadastrado.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

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
                .select("id, status, bloqueado_admin, bloqueio_motivo, paciente_id, valor_mensal, pacientes(nome)")
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
            toast({ title: blocking?.bloqueado_admin ? "✅ Matrícula desbloqueada" : "🔒 Matrícula bloqueada" });
            setBlocking(null);
            setMotive("");
        },
        onError: (err) => {
            toast({ title: "Erro", description: String(err), variant: "destructive" });
        },
    });

    const generateSessions = useMutation({
        mutationFn: async (enrollmentId: string) => {
            // TODO: implement generate_monthly_sessions RPC
            toast({ title: "Funcionalidade ainda não implementada", variant: "destructive" });
            return 0;
        },
        onSuccess: (count) => {
            if (count > 0) {
                queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
                toast({ title: `✅ ${count} sessões geradas para o próximo mês!` });
            }
        },
        onError: (err) => {
            toast({ title: "Erro ao gerar sessões", description: String(err), variant: "destructive" });
        },
    });

    if (isLoading) return <p className="text-sm text-muted-foreground">Carregando matrículas...</p>;

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Valor/mês</TableHead>
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
        </>
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

            {/* Regras de Comissão */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Percent className="h-4 w-4 text-primary" />
                        Regras de Comissão por Profissional
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CommissionRulesEditor />
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
