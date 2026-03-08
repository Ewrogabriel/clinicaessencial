import { useState } from "react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type Session = {
    id: string;
    data_horario: string;
    profissional_id: string;
    paciente_id?: string;
    profiles?: { nome: string };
    enrollment_id?: string;
    valor_sessao?: number;
};

type Credit = {
    id: string;
    expiration_date: string;
    status: string;
};

type Props = {
    session: Session;
    enrollmentId: string;
    open: boolean;
    onClose: () => void;
};

export function RescheduleDialog({ session, enrollmentId, open, onClose }: Props) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [newTime, setNewTime] = useState("08:00");
    const [newProfessional, setNewProfessional] = useState(session.profissional_id);
    const [selectedCreditId, setSelectedCreditId] = useState<string>("");

    const { data: profissionais = [] } = useQuery({
        queryKey: ["profissionais-list"],
        queryFn: async () => {
            const { data } = await supabase.from("profiles").select("user_id, nome").order("nome");
            return data ?? [];
        },
    });

    const { data: credits = [] } = useQuery({
        queryKey: ["enrollment-credits", enrollmentId],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("reschedule_credits")
                .select("*")
                .eq("enrollment_id", enrollmentId)
                .eq("status", "available")
                .gte("expiration_date", format(new Date(), "yyyy-MM-dd"))
                .order("expiration_date");
            if (error) throw error;
            return data as Credit[];
        },
    });

    const { data: policy } = useQuery({
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

    const reschedule = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Não autenticado");
            const newDatetime = `${newDate}T${newTime}:00-03:00`;

            // Get paciente_id from original session
            const { data: origSession } = await supabase
                .from("agendamentos")
                .select("paciente_id, duracao_minutos, tipo_atendimento, tipo_sessao")
                .eq("id", session.id)
                .single();

            if (!origSession) throw new Error("Sessão original não encontrada");

            // 1. Mark original session as rescheduled
            const { error: updateErr } = await supabase
                .from("agendamentos")
                .update({ status: "reagendado" })
                .eq("id", session.id);
            if (updateErr) throw new Error(updateErr.message);

            // 2. Create new session linked to same enrollment
            const { data: newSession, error: insertErr } = await supabase
                .from("agendamentos")
                .insert({
                    paciente_id: origSession.paciente_id,
                    profissional_id: newProfessional,
                    data_horario: newDatetime,
                    duracao_minutos: origSession.duracao_minutos || 60,
                    tipo_atendimento: origSession.tipo_atendimento || "pilates",
                    tipo_sessao: origSession.tipo_sessao || "individual",
                    status: "agendado",
                    recorrente: true,
                    enrollment_id: enrollmentId,
                    valor_sessao: session.valor_sessao ?? 0,
                    created_by: user.id,
                    observacoes: `Reagendado da sessão de ${format(new Date(session.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                })
                .select()
                .single();

            if (insertErr) throw new Error(insertErr.message);

            // 3. Use credit if selected
            if (selectedCreditId && newSession) {
                await (supabase as any)
                    .from("reschedule_credits")
                    .update({ status: "used", used_for_session_id: newSession.id })
                    .eq("id", selectedCreditId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["enrollment-sessions", enrollmentId] });
            queryClient.invalidateQueries({ queryKey: ["enrollment-credits", enrollmentId] });
            queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
            toast({ title: "✅ Sessão reagendada com sucesso!" });
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Erro ao reagendar", description: err?.message || "Erro desconhecido", variant: "destructive" });
        },
    });

    const maxDate = policy ? format(addDays(new Date(), policy.reschedule_limit_days || 30), "yyyy-MM-dd") : undefined;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Reagendar Sessão
                    </DialogTitle>
                    <DialogDescription>
                        Escolha a nova data, horário e profissional para esta sessão.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Sessão original */}
                    <div className="rounded-md bg-muted/50 p-3 text-sm">
                        <span className="text-muted-foreground">Sessão original: </span>
                        <span className="font-medium">
                            {format(new Date(session.data_horario), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-muted-foreground ml-2">• {session.profiles?.nome || "—"}</span>
                    </div>

                    {/* Créditos disponíveis */}
                    {credits.length > 0 && (
                        <div>
                            <Label className="text-xs">Usar Crédito de Reposição</Label>
                            <Select value={selectedCreditId} onValueChange={setSelectedCreditId}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Nenhum crédito (reposição extra)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Nenhum (reagendamento normal)</SelectItem>
                                    {credits.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            Crédito • expira {format(new Date(c.expiration_date), "dd/MM/yyyy", { locale: ptBR })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {credits.length === 0 && (
                        <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">
                            ⚠️ Sem créditos de reposição disponíveis. O reagendamento será registrado normalmente.
                        </div>
                    )}

                    {/* Nova data e hora */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Nova Data</Label>
                            <Input
                                type="date"
                                className="mt-1"
                                value={newDate}
                                min={format(new Date(), "yyyy-MM-dd")}
                                max={maxDate}
                                onChange={(e) => setNewDate(e.target.value)}
                            />
                            {maxDate && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Até {format(new Date(maxDate), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                            )}
                        </div>
                        <div>
                            <Label className="text-xs">Horário</Label>
                            <Input
                                type="time"
                                className="mt-1"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Profissional */}
                    <div>
                        <Label className="text-xs">Profissional</Label>
                        <Select value={newProfessional} onValueChange={setNewProfessional}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {profissionais.map((p: any) => (
                                    <SelectItem key={p.user_id} value={p.user_id}>
                                        {p.nome}
                                        {p.user_id === session.profissional_id && (
                                            <span className="text-muted-foreground ml-2">(atual)</span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {newProfessional !== session.profissional_id && (
                        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
                            💡 A comissão será recalculada automaticamente com base nas regras do novo profissional.
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button
                            onClick={() => reschedule.mutate()}
                            disabled={!newDate || !newTime || !newProfessional || reschedule.isPending}
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            {reschedule.isPending ? "Reagendando..." : "Confirmar Reagendamento"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
