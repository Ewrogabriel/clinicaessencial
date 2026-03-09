import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Stethoscope, User, ChevronRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
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

const Prontuarios = () => {
    const navigate = useNavigate();
    const { activeClinicId } = useClinic();
    const { isAdmin, isProfissional } = useAuth();
    const [busca, setBusca] = useState("");

    const { data: pacientes = [], isLoading } = useQuery({
        queryKey: ["prontuarios-list", activeClinicId],
        queryFn: async () => {
            if (activeClinicId) {
                const { data: cp } = await supabase.from("clinic_pacientes")
                    .select("paciente_id").eq("clinic_id", activeClinicId);
                const ids = (cp || []).map(c => c.paciente_id);
                if (!ids.length) return [];
                const { data, error } = await supabase.from("pacientes")
                    .select("id, nome, tipo_atendimento, status")
                    .in("id", ids).order("nome");
                if (error) throw error;
                return data;
            }
            const { data, error } = await supabase
                .from("pacientes")
                .select("id, nome, tipo_atendimento, status")
                .order("nome");
            if (error) throw error;
            return data;
        },
        enabled: isAdmin || isProfissional,
    });

    // Only admin and professionals can access this page
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
                                {filtrados.map((p: any) => {
                                    const ultimaAvaliacao = p.evaluations?.[0]?.data_avaliacao;
                                    return (
                                        <TableRow key={p.id} className="group cursor-pointer" onClick={() => navigate(`/pacientes/${p.id}/detalhes`)}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    {p.nome}
                                                </div>
                                            </TableCell>
                                            <TableCell className="capitalize">{p.tipo_atendimento}</TableCell>
                                            <TableCell>
                                                <Badge variant={ultimaAvaliacao ? "default" : "destructive"}>
                                                    {ultimaAvaliacao ? "Avaliado" : "Sem Avaliação"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {ultimaAvaliacao ? new Date(ultimaAvaliacao).toLocaleDateString() : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Ver Prontuário
                                                    <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Prontuarios;
