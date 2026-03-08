import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, XCircle, RefreshCw, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RescheduleDialog } from "./RescheduleDialog";
import { MatriculaPayments } from "@/components/matriculas/MatriculaPayments";

type Session = {
    id: string;
    data_horario: string;
    status: string;
    profissional_id: string;
    profiles?: { nome: string };
    valor_sessao?: number;
    rescheduled_from_id?: string;
    cancellation_justification?: string;
    justification_status?: string;
};

type Credit = {
    id: string;
    expiration_date: string;
    status: string;
    generated_from_session_id: string;
};

const SESSION_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    agendado: { label: "Agendado", variant: "secondary" },
    confirmado: { label: "Confirmado", variant: "default" },
    realizado: { label: "Realizado", variant: "default" },
    cancelado: { label: "Cancelado", variant: "destructive" },
    falta: { label: "Falta", variant: "destructive" },
    reagendado: { label: "Reagendado", variant: "outline" },
};

type Props = {
    enrollment: {
        id: string;
        valor_mensal: number;
        paciente_id: string;
        tipo_atendimento?: string;
        pacientes?: { nome: string };
    };
};

export function EnrollmentDetails({ enrollment }: Props) {
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();
    const [justificationDialog, setJustificationDialog] = useState<{ open: boolean; sessionId: string; text: string }>({ open: false, sessionId: "", text: "" });
    const [activeTab, setActiveTab] = useState("sessions");
    const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);

    // Sessions
    const { data: sessions = [], isLoading: loadingSessions } = useQuery({
        queryKey: ["enrollment-sessions", enrollment.id],
        queryFn: async () => {
            const { data: agendamentos, error: sErr } = await supabase
                .from("agendamentos")
                .select("*")
                .eq("enrollment_id", enrollment.id)
                .order("data_horario", { ascending: true });

            if (sErr) throw sErr;
            if (!agendamentos || agendamentos.length === 0) return [];

            const { data: profs } = await supabase.from("profiles").select("user_id, nome");

            return agendamentos.map(s => ({
                ...s,
                profiles: { nome: profs?.find(p => p.user_id === s.profissional_id)?.nome || "—" }
            })) as Session[];
        },
    });

    // Make-up credits
    const { data: credits = [], isLoading: loadingCredits } = useQuery({
        queryKey: ["enrollment-credits", enrollment.id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("reschedule_credits")
                .select("*")
                .eq("enrollment_id", enrollment.id)
                .order("expiration_date", { ascending: true });
            if (error) throw error;
            return data as Credit[];
        },
    });

    // Predicted commissions from regras_comissao
    const { data: predictedCommissions = [] } = useQuery({
        queryKey: ["predicted-commissions", enrollment.id],
        queryFn: async () => {
            // Get unique professional IDs from sessions
            const profIds = [...new Set(sessions.map(s => s.profissional_id))];
            if (profIds.length === 0) return [];

            // Fetch commission rules for these professionals
            const { data: regras } = await supabase
                .from("regras_comissao")
                .select("*")
                .in("profissional_id", profIds)
                .eq("ativo", true);

            // Fetch profiles for fallback rates
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, nome, commission_rate, commission_fixed")
                .in("user_id", profIds);

            const tipoAtendimento = enrollment.tipo_atendimento || "pilates";

            return profIds.map(profId => {
                const prof = profiles?.find(p => p.user_id === profId);
                const profName = prof?.nome || "—";

                // Find specific rule for this tipo_atendimento
                const regraEspecifica = (regras || []).find(
                    r => r.profissional_id === profId && r.tipo_atendimento.toLowerCase() === tipoAtendimento.toLowerCase()
                );
                // Fallback to generic rule
                const regraGenerica = (regras || []).find(
                    r => r.profissional_id === profId && r.tipo_atendimento === "todos"
                );
                const regra = regraEspecifica || regraGenerica;

                // Count sessions for this professional
                const profSessions = sessions.filter(s => s.profissional_id === profId);
                const totalSessoes = profSessions.length;
                const sessoesRealizadas = profSessions.filter(s => s.status === "realizado").length;
                const sessoesPendentes = profSessions.filter(s => ["agendado", "confirmado"].includes(s.status)).length;

                // Calculate commission per session
                let commissionPerSession = 0;
                if (regra) {
                    if (regra.valor_fixo && regra.valor_fixo > 0) {
                        commissionPerSession = regra.valor_fixo;
                    } else if (regra.percentual && regra.percentual > 0) {
                        const valorSessao = totalSessoes > 0 ? enrollment.valor_mensal / totalSessoes : 0;
                        commissionPerSession = (valorSessao * regra.percentual) / 100;
                    }
                } else if (prof?.commission_rate) {
                    const valorSessao = totalSessoes > 0 ? enrollment.valor_mensal / totalSessoes : 0;
                    commissionPerSession = (valorSessao * prof.commission_rate) / 100;
                } else if (prof?.commission_fixed) {
                    commissionPerSession = prof.commission_fixed;
                }

                const totalPrevisto = commissionPerSession * totalSessoes;
                const totalRealizado = commissionPerSession * sessoesRealizadas;
                const totalPendente = commissionPerSession * sessoesPendentes;

                return {
                    profissional_id: profId,
                    nome: profName,
                    tipo_regra: regra ? (regra.valor_fixo && regra.valor_fixo > 0 ? "Valor fixo" : "Percentual") : (prof?.commission_fixed ? "Fixo (perfil)" : "% (perfil)"),
                    valor_por_sessao: commissionPerSession,
                    total_sessoes: totalSessoes,
                    sessoes_realizadas: sessoesRealizadas,
                    sessoes_pendentes: sessoesPendentes,
                    total_previsto: totalPrevisto,
                    total_realizado: totalRealizado,
                    total_pendente: totalPendente,
                };
            });
        },
        enabled: sessions.length > 0,
    });

    // Stats
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "realizado").length;
    const canceledSessions = sessions.filter((s) => s.status === "cancelado").length;
    const monthValue = enrollment.valor_mensal || 0;
    const sessionValue = totalSessions > 0 ? (monthValue / totalSessions).toFixed(2) : "0.00";

    // Justify late cancellation
    const submitJustification = useMutation({
        mutationFn: async () => {
            const { error } = await (supabase as any)
                .from("agendamentos")
                .update({
                    cancellation_justification: justificationDialog.text,
                    justification_status: "pending",
                })
                .eq("id", justificationDialog.sessionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["enrollment-sessions", enrollment.id] });
            setJustificationDialog({ open: false, sessionId: "", text: "" });
            toast({ title: "Justificativa enviada para aprovação." });
        },
    });

    // Admin: approve or deny justification
    const reviewJustification = useMutation({
        mutationFn: async ({ sessionId, action }: { sessionId: string; action: "approved" | "denied" }) => {
            const { error } = await (supabase as any)
                .from("agendamentos")
                .update({ justification_status: action })
                .eq("id", sessionId);
            if (error) throw error;

            if (action === "approved") {
                const session = sessions.find((s) => s.id === sessionId);
                if (session) {
                    const expDate = new Date();
                    expDate.setDate(expDate.getDate() + 30);
                    await (supabase as any).from("reschedule_credits").insert({
                        enrollment_id: enrollment.id,
                        generated_from_session_id: sessionId,
                        expiration_date: expDate.toISOString().split("T")[0],
                        status: "available",
                    });
                }
            }
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ["enrollment-sessions", enrollment.id] });
            queryClient.invalidateQueries({ queryKey: ["enrollment-credits", enrollment.id] });
            toast({ title: vars.action === "approved" ? "Justificativa aprovada. Crédito gerado!" : "Justificativa negada." });
        },
    });

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                    <div className="flex gap-2 items-center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <div className="text-xs text-muted-foreground">Total Sessões</div>
                            <div className="text-lg font-bold">{totalSessions}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex gap-2 items-center">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                            <div className="text-xs text-muted-foreground">Realizadas</div>
                            <div className="text-lg font-bold text-green-600">{completedSessions}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex gap-2 items-center">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <div>
                            <div className="text-xs text-muted-foreground">Canceladas</div>
                            <div className="text-lg font-bold text-destructive">{canceledSessions}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex gap-2 items-center">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <div>
                            <div className="text-xs text-muted-foreground">Valor/Sessão</div>
                            <div className="text-lg font-bold text-primary">R$ {sessionValue}</div>
                        </div>
                    </div>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="sessions">Sessões</TabsTrigger>
                    <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                    <TabsTrigger value="credits">Reposições</TabsTrigger>
                    <TabsTrigger value="commissions">Comissões</TabsTrigger>
                </TabsList>

                {/* SESSIONS TAB */}
                <TabsContent value="sessions" className="mt-3">
                    {loadingSessions ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Carregando sessões...</p>
                    ) : sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma sessão gerada ainda.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Profissional</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sessions.map((s) => (
                                        <TableRow key={s.id}>
                                            <TableCell className="text-sm">
                                                {format(new Date(s.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </TableCell>
                                            <TableCell className="text-sm">{s.profiles?.nome || "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={SESSION_STATUS_CONFIG[s.status]?.variant || "outline"}>
                                                    {SESSION_STATUS_CONFIG[s.status]?.label || s.status}
                                                </Badge>
                                                {s.justification_status === "pending" && (
                                                    <Badge variant="secondary" className="ml-1">Justif. Pendente</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">R$ {(s.valor_sessao || 0).toFixed(2)}</TableCell>
                                            <TableCell className="space-x-1">
                                                {["agendado", "confirmado"].includes(s.status) && (
                                                    <Button size="sm" variant="outline" className="text-xs gap-1"
                                                        onClick={() => setRescheduleSession(s)}>
                                                        <RefreshCw className="h-3 w-3" />
                                                        Reagendar
                                                    </Button>
                                                )}
                                                {isAdmin && s.justification_status === "pending" && (
                                                    <>
                                                        <Button size="sm" variant="outline" className="text-xs"
                                                            onClick={() => reviewJustification.mutate({ sessionId: s.id, action: "approved" })}>
                                                            Aprovar
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="text-xs text-destructive"
                                                            onClick={() => reviewJustification.mutate({ sessionId: s.id, action: "denied" })}>
                                                            Negar
                                                        </Button>
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* PAYMENTS TAB */}
                <TabsContent value="payments" className="mt-3">
                    <MatriculaPayments
                        matriculaId={enrollment.id}
                        pacienteId={enrollment.paciente_id}
                        valorMensal={enrollment.valor_mensal}
                    />
                </TabsContent>

                {/* CREDITS TAB */}
                <TabsContent value="credits" className="mt-3">
                    {loadingCredits ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Carregando créditos...</p>
                    ) : credits.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum crédito de reposição disponível.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Gerado em</TableHead>
                                        <TableHead>Expira em</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {credits.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="text-sm">{c.generated_from_session_id.slice(0, 8)}...</TableCell>
                                            <TableCell className="text-sm">
                                                {format(new Date(c.expiration_date), "dd/MM/yyyy", { locale: ptBR })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    c.status === "available" ? "default" :
                                                        c.status === "used" ? "secondary" : "destructive"
                                                }>
                                                    {c.status === "available" ? "Disponível" : c.status === "used" ? "Usado" : "Expirado"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* COMMISSIONS TAB - Predicted */}
                <TabsContent value="commissions" className="mt-3">
                    {predictedCommissions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhuma comissão prevista. Verifique se há regras de comissão configuradas para os profissionais.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border text-sm">
                                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-muted-foreground">
                                    Previsão de comissões com base nas regras configuradas. O pagamento efetivo é feito no módulo Financeiro.
                                </span>
                            </div>
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Profissional</TableHead>
                                            <TableHead>Regra</TableHead>
                                            <TableHead>R$/Sessão</TableHead>
                                            <TableHead>Previsto</TableHead>
                                            <TableHead>Realizado</TableHead>
                                            <TableHead>Pendente</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {predictedCommissions.map((c: any) => (
                                            <TableRow key={c.profissional_id}>
                                                <TableCell className="font-medium">{c.nome}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">{c.tipo_regra}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">R$ {c.valor_por_sessao.toFixed(2)}</TableCell>
                                                <TableCell className="text-sm font-semibold">
                                                    R$ {c.total_previsto.toFixed(2)}
                                                    <span className="text-xs text-muted-foreground ml-1">({c.total_sessoes} sess.)</span>
                                                </TableCell>
                                                <TableCell className="text-sm font-semibold text-green-600">
                                                    R$ {c.total_realizado.toFixed(2)}
                                                    <span className="text-xs text-muted-foreground ml-1">({c.sessoes_realizadas})</span>
                                                </TableCell>
                                                <TableCell className="text-sm font-semibold text-amber-600">
                                                    R$ {c.total_pendente.toFixed(2)}
                                                    <span className="text-xs text-muted-foreground ml-1">({c.sessoes_pendentes})</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* Totals */}
                            <div className="grid grid-cols-3 gap-3">
                                <Card className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Total Previsto</p>
                                    <p className="text-lg font-bold">
                                        R$ {predictedCommissions.reduce((s: number, c: any) => s + c.total_previsto, 0).toFixed(2)}
                                    </p>
                                </Card>
                                <Card className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Realizado</p>
                                    <p className="text-lg font-bold text-green-600">
                                        R$ {predictedCommissions.reduce((s: number, c: any) => s + c.total_realizado, 0).toFixed(2)}
                                    </p>
                                </Card>
                                <Card className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Pendente</p>
                                    <p className="text-lg font-bold text-amber-600">
                                        R$ {predictedCommissions.reduce((s: number, c: any) => s + c.total_pendente, 0).toFixed(2)}
                                    </p>
                                </Card>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Justification Dialog */}
            <Dialog open={justificationDialog.open} onOpenChange={(v) => setJustificationDialog({ open: v, sessionId: "", text: "" })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Justificativa de Cancelamento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            O cancelamento foi feito fora do prazo. Descreva o motivo para que o admin possa aprovar o crédito de reposição.
                        </p>
                        <Textarea
                            value={justificationDialog.text}
                            onChange={(e) => setJustificationDialog({ ...justificationDialog, text: e.target.value })}
                            placeholder="Ex: Emergência médica..."
                            rows={4}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setJustificationDialog({ open: false, sessionId: "", text: "" })}>Cancelar</Button>
                            <Button onClick={() => submitJustification.mutate()} disabled={!justificationDialog.text || submitJustification.isPending}>
                                Enviar Justificativa
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* RescheduleDialog */}
            {rescheduleSession && (
                <RescheduleDialog
                    session={rescheduleSession}
                    enrollmentId={enrollment.id}
                    open={!!rescheduleSession}
                    onClose={() => setRescheduleSession(null)}
                />
            )}
        </div>
    );
}
