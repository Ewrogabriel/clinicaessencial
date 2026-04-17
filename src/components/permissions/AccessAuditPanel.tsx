import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { permissionService } from "@/modules/permissions/services/permissionService";
import { MODULE_LABELS, ACTION_LABELS } from "@/modules/permissions/types";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, Loader2 } from "lucide-react";

/**
 * "Quem tem acesso a quê" — visão consolidada de todas as permissões
 * efetivas por usuário do sistema.
 */
export function AccessAuditPanel() {
  const { data: perms = [] } = useQuery({
    queryKey: ["audit:perms"],
    queryFn: () => permissionService.listPermissions(),
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["audit:role-perms"],
    queryFn: () => permissionService.listRolePermissions(),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["audit:users"],
    queryFn: async () => {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role");
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))) as string[];
      if (ids.length === 0) return [];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, nome, email")
        .in("user_id", ids);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Carregando...
      </div>
    );
  }

  const getModulesForUser = (userRoles: string[]) => {
    const permIds = new Set(
      rolePerms.filter((rp) => userRoles.includes(rp.role)).map((rp) => rp.permission_id)
    );
    const userPerms = perms.filter((p) => permIds.has(p.id));
    const byModule: Record<string, Set<string>> = {};
    userPerms.forEach((p) => {
      if (!byModule[p.module]) byModule[p.module] = new Set();
      byModule[p.module].add(p.action);
    });
    return byModule;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" /> Quem tem acesso a quê
        </CardTitle>
        <CardDescription>
          Visão geral consolidada das permissões efetivas de cada usuário do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Módulos com acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => {
                const mods = getModulesForUser(u.roles);
                const modKeys = Object.keys(mods);
                return (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium">{u.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {modKeys.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem permissões</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {modKeys.map((m) => (
                            <Badge key={m} variant="secondary" className="text-xs" title={Array.from(mods[m]).map(a => ACTION_LABELS[a] || a).join(", ")}>
                              {MODULE_LABELS[m] || m} ({mods[m].size})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
