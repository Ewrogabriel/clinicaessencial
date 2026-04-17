import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { permissionService } from "@/modules/permissions/services/permissionService";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Profissional {
  user_id: string;
  nome: string | null;
}

export function ScheduleAccessManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>("");

  const { data: profs = [], isLoading: loadingProfs } = useQuery({
    queryKey: ["schedule-perm:professionals"],
    queryFn: async (): Promise<Profissional[]> => {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "profissional");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids);
      return (profiles ?? []) as Profissional[];
    },
  });

  const { data: schedulePerm } = useQuery({
    queryKey: ["schedule-perm", selectedUser],
    queryFn: () => permissionService.getSchedulePermission(selectedUser),
    enabled: !!selectedUser,
  });

  const scope = schedulePerm?.scope ?? "own";
  const allowedSet = useMemo(
    () => new Set(schedulePerm?.allowed_professionals ?? []),
    [schedulePerm]
  );

  const setScope = async (newScope: "own" | "others" | "all") => {
    if (!selectedUser || !user?.id) return;
    try {
      await permissionService.setSchedulePermission(
        selectedUser,
        newScope,
        newScope === "others" ? (schedulePerm?.allowed_professionals ?? null) : null,
        user.id,
      );
      qc.invalidateQueries({ queryKey: ["schedule-perm", selectedUser] });
      toast.success("Permissão de agendamento atualizada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  const toggleProf = async (profId: string, allowed: boolean) => {
    if (!selectedUser || !user?.id) return;
    const current = schedulePerm?.allowed_professionals ?? [];
    const next = allowed ? [...current, profId] : current.filter((p) => p !== profId);
    try {
      await permissionService.setSchedulePermission(selectedUser, "others", next, user.id);
      qc.invalidateQueries({ queryKey: ["schedule-perm", selectedUser] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Agendamento entre Profissionais
        </CardTitle>
        <CardDescription>
          Defina se cada profissional pode agendar sessões apenas para si, para outros profissionais específicos, ou para todos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Profissional:</span>
          {loadingProfs ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {profs.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.nome || p.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedUser && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={scope === "own" ? "default" : "outline"}
                onClick={() => setScope("own")}
              >
                Apenas para si
              </Button>
              <Button
                size="sm"
                variant={scope === "others" ? "default" : "outline"}
                onClick={() => setScope("others")}
              >
                Para profissionais específicos
              </Button>
              <Button
                size="sm"
                variant={scope === "all" ? "default" : "outline"}
                onClick={() => setScope("all")}
              >
                Para todos
              </Button>
              <Badge variant="secondary">
                {scope === "own" ? "Restrito" : scope === "all" ? "Acesso total" : "Específico"}
              </Badge>
            </div>

            {scope === "others" && (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Pode agendar para:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profs.filter((p) => p.user_id !== selectedUser).map((p) => (
                    <label key={p.user_id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowedSet.has(p.user_id)}
                        onCheckedChange={(v) => toggleProf(p.user_id, !!v)}
                      />
                      {p.nome || p.user_id.slice(0, 8)}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vazio = pode agendar para qualquer outro profissional.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
