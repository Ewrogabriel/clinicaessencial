import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Stethoscope, User, ChevronRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const Prontuarios = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { activeClinicId } = useClinic();
    const { isAdmin, isProfissional } = useAuth();
    const [busca, setBusca] = useState("");

    // If navigated with ?paciente=<id>, redirect to the patient detail page
    // preserving tab and new query params (e.g. from AppointmentDetailDialog / AgendaViews)
    useEffect(() => {
        const pacienteId = searchParams.get("paciente");
        if (pacienteId) {
            const tab = searchParams.get("tab");
            const isNew = searchParams.get("new");
            const params = new URLSearchParams();
            if (tab) params.set("tab", tab);
            if (isNew) params.set("new", isNew);
            const qs = params.toString();
            navigate(`/pacientes/${pacienteId}/detalhes${qs ? `?${qs}` : ""}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const { data: pacientes = [], isLoading } = useQuery({
        queryKey: ["prontuarios-list", activeClinicId],
        queryFn: async () => {
            let ids: string[] = [];
            if (activeClinicId) {
                const { data: cp } = await supabase.from("clinic_pacientes")
                    .select("paciente_id").eq("clinic_id", activeClinicId);
                ids = (cp || []).map(c => c.paciente_id);
                if (!ids.length) return [];
            }

            let query = supabase.from("pacientes")
                .select("id, nome, tipo_atendimento, status")
                .order("nome");
            if (ids.length > 0) query = query.in("id", ids);

            const { data, error } = await query;
            if (error) throw error;

            // Fetch latest evaluation for each patient
            const patientIds = (data || []).map(p => p.id);
            if (patientIds.length === 0) return [];

            const { data: evals } = await supabase
                .from("evaluations")
                .select("paciente_id, data_avaliacao")
                .in("paciente_id", patientIds)
                .order("data_avaliacao", { ascending: false });

            // Build map of latest evaluation per patient
            const evalMap: Record<string, string> = {};
            (evals || []).forEach(e => {
                if (!evalMap[e.paciente_id]) {
                    evalMap[e.paciente_id] = e.data_avaliacao;
                }
            });

            return (data || []).map(p => ({
                ...p,
                ultima_avaliacao: evalMap[p.id] || null,
            }));
        },
        enabled: isAdmin || isProfissional,
    });

    if (!isAdmin && !isProfissional) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
                <ShieldAlert className="h-12 w-12 opacity-30" />
                <p className="text-lg font-medium">Acesso restrito</p>
                <p className="text-sm">Apenas profissionais e administradores podem acessar prontuários.</p>
            </div>
        );
    }

    const filtrados = pacientes.filter((p: any) =>
        p.nome.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Prontuários</h1>
                <p className="text-muted-foreground">Gestão clínica e histórico de atendimentos</p>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar paciente..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando prontuários...</div>
                    ) : filtrados.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Nenhum prontuário encontrado.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Status Clínico</TableHead>
                                    <TableHead>Última Avaliação</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtrados.map((p: any) => (
                                    <TableRow key={p.id} className="group cursor-pointer" onClick={() => navigate(`/pacientes/${p.id}/detalhes`)}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                {p.nome}
                                            </div>
                                        </TableCell>
                                        <TableCell className="capitalize">{p.tipo_atendimento}</TableCell>
                                        <TableCell>
                                            <Badge variant={p.ultima_avaliacao ? "default" : "destructive"}>
                                                {p.ultima_avaliacao ? "Avaliado" : "Sem Avaliação"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {p.ultima_avaliacao
                                                ? format(new Date(p.ultima_avaliacao), "dd/MM/yyyy")
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                Ver Prontuário
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Prontuarios;
