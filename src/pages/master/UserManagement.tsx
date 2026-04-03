import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Shield, UserPlus, UserX, Mail, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMasterUsers } from "@/modules/master/hooks/useMasterAdmin";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useMasterUsers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", role: "admin" });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.admin.inviteUserByEmail(form.email, {
        data: { nome: form.nome, role: form.role },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite enviado ✅");
      setInviteOpen(false);
      setForm({ nome: "", email: "", role: "admin" });
      queryClient.invalidateQueries({ queryKey: ["master-users"] });
    },
    onError: (e: Error) =>
      toast.error("Erro ao convidar", { description: e.message }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase.from("profiles") as any)
        .update({ ativo: false })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário desativado");
      queryClient.invalidateQueries({ queryKey: ["master-users"] });
    },
    onError: (e: Error) =>
      toast.error("Erro", { description: e.message }),
  });

  const roleVariant: Record<string, "default" | "secondary"> = {
    master: "default",
    admin: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
            <p className="text-muted-foreground text-sm">
              Administradores e usuários master da plataforma
            </p>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Convidar Usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-muted-foreground text-sm">Carregando…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleVariant[u.role] ?? "secondary"}>{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.ativo ? "default" : "destructive"}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(u.last_login), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.ativo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deactivateMutation.mutate(u.id)}
                            disabled={deactivateMutation.isPending}
                          >
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
            <DialogDescription>
              O usuário receberá um e-mail com o link de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => inviteMutation.mutate()}
              disabled={!form.nome || !form.email || inviteMutation.isPending}
            >
              Enviar Convite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
