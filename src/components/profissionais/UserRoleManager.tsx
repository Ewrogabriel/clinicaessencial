import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/modules/shared/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const UserRoleManager = () => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: users = [], isLoading } = useQuery({
        queryKey: ["all-users-roles"],
        queryFn: async () => {
            const { data: profiles, error: pError } = await supabase
                .from("profiles")
                .select("*");

            if (pError) throw pError;

            const { data: roles, error: rError } = await supabase
                .from("user_roles")
                .select("*");

            if (rError) throw rError;

            const { data: pacientes, error: pacError } = await supabase
                .from("pacientes")
                .select("*");

            if (pacError) throw pacError;

            // Merge profiles and patients
            const mergedUsers: any[] = [];

            // First add profiles (users with accounts)
            profiles.forEach(p => {
                mergedUsers.push({
                    id: p.id,
                    user_id: p.user_id,
                    nome: p.nome || "Sem nome",
                    email: p.email,
                    roles: roles.filter(r => r.user_id === p.user_id).map(r => r.role),
                    hasAccount: true
                });
            });

            // Then add patients that don't have an associated profile
            pacientes.forEach((pac: any) => {
                if (!pac.user_id || !mergedUsers.find(mu => mu.user_id === pac.user_id)) {
                    mergedUsers.push({
                        id: pac.id,
                        user_id: pac.user_id, // Might be null
                        nome: pac.nome || "Sem nome",
                        email: pac.email || "(Paciente sem cadastro/email)",
                        roles: pac.user_id ? roles.filter(r => r.user_id === pac.user_id).map(r => r.role) : [],
                        hasAccount: !!pac.user_id
                    });
                }
            });

            return mergedUsers;
        }
    });

    const handleRoleChange = async (userId: string, newRole: string, currentRoles: string[]) => {
        try {
            // For simplicity, we just manage one main role here
            // 1. Remove current roles
            await supabase.from("user_roles").delete().eq("user_id", userId);

            // 2. Add new role
            const { error } = await supabase.from("user_roles").insert({
                user_id: userId,
                role: newRole as any
            });

            if (error) throw error;

            toast({ title: "Cargo atualizado!", description: "As permissões do usuário foram alteradas." });
            queryClient.invalidateQueries({ queryKey: ["all-users-roles"] });
            queryClient.invalidateQueries({ queryKey: ["profissionais"] });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const filteredUsers = users.filter(u =>
        u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) return <p>Carregando usuários...</p>;

    return (
        <div className="w-full space-y-4 text-left">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nome ou e-mail..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Cargo Atual</TableHead>
                            <TableHead className="text-right">Alterar Para</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((u, index) => {
                            const currentRole = u.roles[0] || (u.hasAccount ? "Sem cargo" : "Sem acesso");
                            return (
                                <TableRow key={u.user_id || `pac-${u.id}-${index}`}>
                                    <TableCell>
                                        <div className="font-medium">{u.nome}</div>
                                        <div className="text-xs text-muted-foreground">{u.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={(currentRole as any) === 'admin' ? 'default' : (currentRole as any) === 'gestor' ? 'secondary' : (currentRole as any) === 'profissional' ? 'outline' : 'outline'}>
                                            {currentRole}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {u.hasAccount ? (
                                            <Select
                                                onValueChange={(val) => handleRoleChange(u.user_id, val, u.roles)}
                                                defaultValue={currentRole !== "Sem cargo" ? currentRole : undefined}
                                            >
                                                <SelectTrigger className="w-[140px] ml-auto">
                                                    <SelectValue placeholder="Mudar cargo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="paciente">Paciente</SelectItem>
                                                    <SelectItem value="profissional">Profissional</SelectItem>
                                                    <SelectItem value="gestor">Gestor / Gerente</SelectItem>
                                                    <SelectItem value="admin">Administrador</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="text-xs text-muted-foreground italic text-right">
                                                Para virar profissional, cadastre o CPF do paciente.
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default UserRoleManager;
