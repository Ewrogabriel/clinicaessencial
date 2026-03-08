import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, XCircle, RefreshCw, DollarSign } from "lucide-react";
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

type CommissionSplit = {
    id: string;
    professional_id: string;
    commission_value: number;
    profiles?: { nome: string };
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
        pacientes?: { nome: string };
    };
};

export function EnrollmentDetails({ enrollment }: Props) {
    const { isAdmin } = useAuth();
    const queryClient = useQueryClient();
    const [justificationDialog, setJustificationDialog] = useState<{ open: boolean; sessionId: string; text: string }>({ open: false, sessionId: "", text: "" });
    const [activeTab, setActiveTab] = useState("sessions");
    const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);

    // Sessions (agendamentos linked to this enrollment)
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

            // Fetch professionals to map names
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

    // Commission splits for this enrollment's sessions
    const { data: commissions = [], isLoading: loadingComm } = useQuery({
        queryKey: ["enrollment-commissions", enrollment.id],
        queryFn: async () => {
            const sessionIds = sessions.map((s) => s.id);
            if (sessionIds.length === 0) return [];
            const { data, error } = await (supabase as any)
                .from("commission_splits")
                .select("*, profiles:professional_id(nome)")
                .in("session_id", sessionIds);
            if (error) throw error;
            return data as CommissionSplit[];
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

            // If approved, generate credit
            if (action === "approved") {
                const session = sessions.find((s) => s.id === sessionId);
                if (session) {
                    const expDate = new Date();
                    expDate.setDate(expDate.getDate() + 30); // default 30 days
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

    // Group commissions by professional
    const commissionByProfessional: Record<string, { nome: string; total: number }> = {};
    commissions.forEach((c) => {
        const id = c.professional_id;
        if (!commissionByProfessional[id]) {
            commissionByProfessional[id] = { nome: c.profiles?.nome || "—", total: 0 };
        }
        commissionByProfessional[id].total += c.commission_value;
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
                        <XCircle className="h-4 w-4 text-red-500" />
                        <div>
                            <div className="text-xs text-muted-foreground">Canceladas</div>
                            <div className="text-lg font-bold text-red-600">{canceledSessions}</div>
                        </div>
                    </div>
                </Card>
                <Card className="p-3">
                    <div className="flex gap-2 items-center">
                        <DollarSign className="h-4 w-4 text-blue-500" />
                        <div>
                            <div className="text-xs text-muted-foreground">Valor/Sessão</div>
                            <div className="text-lg font-bold text-blue-600">R$ {sessionValue}</div>
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
                                                {/* Reagendar: disponível para agendado/confirmado */}
                                                {["agendado", "confirmado"].includes(s.status) && (
                                                    <Button size="sm" variant="outline" className="text-xs gap-1"
                                                        onClick={() => setRescheduleSession(s)}>
                                                        <RefreshCw className="h-3 w-3" />
                                                        Reagendar
                                                    </Button>
                                                )}
                                                {/* Admin: aprovar/negar justificativa */}
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

                {/* COMMISSIONS TAB */}
                <TabsContent value="commissions" className="mt-3">
                    {loadingComm ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Carregando comissões...</p>
                    ) : Object.keys(commissionByProfessional).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma comissão calculada para esta matrícula.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Profissional</TableHead>
                                        <TableHead>Total Comissão</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(commissionByProfessional).map(([id, data]) => (
                                        <TableRow key={id}>
                                            <TableCell className="font-medium">{data.nome}</TableCell>
                                            <TableCell className="text-green-600 font-semibold">R$ {data.total.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
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
