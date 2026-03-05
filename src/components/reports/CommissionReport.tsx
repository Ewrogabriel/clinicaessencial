import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, Users, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CommissionReport() {
    const [month, setMonth] = useState(new Date());

    const start = format(startOfMonth(month), "yyyy-MM-dd");
    const end = format(endOfMonth(month), "yyyy-MM-dd");

    // Total MRR (active enrollments)
    const { data: mrrData } = useQuery({
        queryKey: ["mrr", start],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("matriculas")
                .select("valor_mensal")
                .eq("status", "ativa");
            if (error) throw error;
            const total = (data || []).reduce((acc: number, r: any) => acc + (parseFloat(r.valor_mensal) || 0), 0);
            return total;
        },
    });

    // Sessions this month
    const { data: sessions = [] } = useQuery({
        queryKey: ["sessions-month", start, end],
        queryFn: async () => {
            const { data: agendamentos, error } = await (supabase as any)
                .from("agendamentos")
                .select("id, status, profissional_id, valor_sessao")
                .not("enrollment_id", "is", null)
                .gte("data_horario", `${start}T00:00:00`)
                .lte("data_horario", `${end}T23:59:59`);

            if (error) throw error;

            if (!agendamentos || agendamentos.length === 0) return [];

            // Fetch profiles to get names
            const { data: profs } = await supabase.from("profiles").select("user_id, nome");

            return agendamentos.map((s: any) => ({
                ...s,
                profiles: { nome: profs?.find(p => p.user_id === s.profissional_id)?.nome || "—" }
            }));
        },
    });

    // Commission splits this month
    const { data: splits = [] } = useQuery({
        queryKey: ["commission-splits-month", start, end],
        queryFn: async () => {
            const sessionIds = sessions.map((s: any) => s.id);
            if (sessionIds.length === 0) return [];

            const { data: splitData, error } = await (supabase as any)
                .from("commission_splits")
                .select("*")
                .in("session_id", sessionIds);

            if (error) throw error;

            if (!splitData || splitData.length === 0) return [];

            // Fetch profiles for splits
            const { data: profs } = await supabase.from("profiles").select("user_id, nome");

            return splitData.map((sp: any) => ({
                ...sp,
                profiles: { nome: profs?.find(p => p.user_id === sp.professional_id)?.nome || "—" }
            }));
        },
        enabled: sessions.length > 0,
    });

    // Aggregate
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s: any) => s.status === "realizado").length;
    const canceledSessions = sessions.filter((s: any) => ["cancelado", "falta"].includes(s.status)).length;

    const commByProfessional: Record<string, { nome: string; sessions: number; total: number }> = {};
    splits.forEach((sp: any) => {
        const id = sp.professional_id;
        if (!commByProfessional[id]) commByProfessional[id] = { nome: sp.profiles?.nome || "—", sessions: 0, total: 0 };
        commByProfessional[id].total += sp.commission_value;
        commByProfessional[id].sessions += 1;
    });

    const totalCommission = Object.values(commByProfessional).reduce((acc, v) => acc + v.total, 0);

    // Credits expiring this month
    const { data: expiringCredits = [] } = useQuery({
        queryKey: ["expiring-credits", end],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("reschedule_credits")
                .select("*, matriculas:enrollment_id(pacientes(nome))")
                .eq("status", "available")
                .lte("expiration_date", end);
            if (error) throw error;
            return data || [];
        },
    });

    const prevMonth = () => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; });
    const nextMonth = () => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; });

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <h2 className="text-lg font-semibold min-w-[180px] text-center capitalize">
                    {format(month, "MMMM yyyy", { locale: ptBR })}
                </h2>
                <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" /> MRR (Receita Recorrente)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-green-600">R$ {(mrrData || 0).toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> Total Sessões
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <p className="text-2xl font-bold">{totalSessions}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Realizadas
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-green-600">{completedSessions}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5 text-red-500" /> Canceladas/Falta
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <p className="text-2xl font-bold text-red-500">{canceledSessions}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Commission breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Comissão por Profissional</CardTitle>
                </CardHeader>
                <CardContent>
                    {Object.keys(commByProfessional).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comissão calculada para este mês.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Profissional</TableHead>
                                    <TableHead>Sessões</TableHead>
                                    <TableHead>Total Comissão</TableHead>
                                    <TableHead>% do Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(commByProfessional).map(([id, data]) => (
                                    <TableRow key={id}>
                                        <TableCell className="font-medium">{data.nome}</TableCell>
                                        <TableCell>{data.sessions}</TableCell>
                                        <TableCell className="font-semibold text-green-600">R$ {data.total.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {totalCommission > 0 ? ((data.total / totalCommission) * 100).toFixed(1) : 0}%
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="border-t-2">
                                    <TableCell className="font-bold" colSpan={2}>Total</TableCell>
                                    <TableCell className="font-bold text-green-700">R$ {totalCommission.toFixed(2)}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Expiring credits */}
            {expiringCredits.length > 0 && (
                <Card className="border-orange-200">
                    <CardHeader>
                        <CardTitle className="text-base text-orange-600">⚠️ Créditos a Vencer Este Mês ({expiringCredits.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Expira em</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expiringCredits.map((c: any) => (
                                    <TableRow key={c.id}>
                                        <TableCell>{c.matriculas?.pacientes?.nome || "—"}</TableCell>
                                        <TableCell>{format(new Date(c.expiration_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-orange-600">Disponível</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
