import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { permissionService } from "@/modules/permissions/services/permissionService";
import {
  ALL_MODULES, ALL_ACTIONS, ALL_SCOPES,
  MODULE_LABELS, ACTION_LABELS,
  type Permission,
} from "@/modules/permissions/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Shield, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gestor", label: "Gestor" },
  { value: "secretario", label: "Secretário" },
  { value: "profissional", label: "Profissional" },
  { value: "paciente", label: "Paciente" },
];

export function PermissionsManager() {
  const qc = useQueryClient();
  const [role, setRole] = useState("secretario");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: perms = [], isLoading } = useQuery({
    queryKey: ["perm:catalog"],
    queryFn: () => permissionService.listPermissions(),
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["perm:role", role],
    queryFn: () => permissionService.listRolePermissions(role),
  });

  const grantedSet = useMemo(
    () => new Set(rolePerms.map((rp) => rp.permission_id)),
    [rolePerms]
  );

  const permsByModule = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    perms.forEach((p) => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return map;
  }, [perms]);

  const toggle = async (perm: Permission, allowed: boolean) => {
    const key = `${role}:${perm.id}`;
    setSavingKey(key);
    try {
      await permissionService.setRolePermission(role, perm.id, allowed);
      qc.invalidateQueries({ queryKey: ["perm:role", role] });
      qc.invalidateQueries({ queryKey: ["permissions:roles"] });
      toast.success("Permissão atualizada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar permissão");
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Carregando permissões...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Permissões por Perfil
          </CardTitle>
          <CardDescription>
            Configure quais ações cada perfil pode executar em cada módulo. As alterações se aplicam imediatamente a todos os usuários do perfil selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Perfil:</span>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{rolePerms.length} permissões ativas</Badge>
          </div>

          <TooltipProvider>
            {ALL_MODULES.map((mod) => {
              const list = permsByModule[mod] || [];
              if (list.length === 0) return null;
              return (
                <div key={mod} className="border rounded-lg p-3">
                  <div className="font-semibold text-sm mb-2">{MODULE_LABELS[mod]}</div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">Ação</TableHead>
                          {ALL_SCOPES.map((s) => (
                            <TableHead key={s} className="text-center capitalize">
                              {s === "own" ? "Próprio" : s === "others" ? "Outros" : "Global"}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ALL_ACTIONS.map((act) => {
                          const row = ALL_SCOPES.map((s) =>
                            list.find((p) => p.action === act && p.scope_type === s)
                          );
                          if (row.every((r) => !r)) return null;
                          return (
                            <TableRow key={act}>
                              <TableCell className="font-medium">
                                <Tooltip>
                                  <TooltipTrigger>{ACTION_LABELS[act]}</TooltipTrigger>
                                  <TooltipContent>{act}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                              {row.map((p, i) => (
                                <TableCell key={i} className="text-center">
                                  {p ? (
                                    <Checkbox
                                      checked={grantedSet.has(p.id)}
                                      disabled={savingKey === `${role}:${p.id}`}
                                      onCheckedChange={(v) => toggle(p, !!v)}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
