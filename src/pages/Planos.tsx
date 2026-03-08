import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, AlertTriangle, CheckCircle2, XCircle, Clock, Pencil, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PlanoFormDialog } from "@/components/planos/PlanoFormDialog";
import { PlanoSessoesDialog } from "@/components/planos/PlanoSessoesDialog";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  finalizado: { label: "Finalizado", variant: "secondary" },
};

interface PlanoRow {
  id: string;
  paciente_id: string;
  profissional_id: string;
  tipo_atendimento: string;
  total_sessoes: number;
  sessoes_utilizadas: number;
  valor: number;
  status: string;
  data_inicio: string;
  data_vencimento: string | null;
  observacoes: string | null;
  created_at: string;
  pacientes: { nome: string } | null;
  profiles: { nome: string } | null;
}

const Planos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editPlano, setEditPlano] = useState<PlanoRow | null>(null);
  const [sessoesPlano, setSessoesPlano] = useState<PlanoRow | null>(null);
  const [filterPaciente, setFilterPaciente] = useState("");
  const [filterStatus, setFilterStatus] = useState("ativo");

  const { data: planos = [], isLoading } = useQuery<PlanoRow[]>({
    queryKey: ["planos", filterPaciente, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("planos")
        .select("*, pacientes(nome), profiles(nome)");
      
      if (filterStatus) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.eq("status", filterStatus as any);
      }
      if (filterPaciente) {
        query = query.ilike("pacientes.nome", `%${filterPaciente}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PlanoRow[];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: modalidades = [] } = useQuery({
    queryKey: ["modalidades-ativas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("modalidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async (planoId: string) => {
      const { error } = await supabase
        .from("pagamentos")
        .update({ status: "pago", data_pagamento: new Date().toISOString() })
        .eq("plano_id", planoId)
        .eq("status", "pendente");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      toast({ title: "Pagamento confirmado!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  const planosAtivos = planos.filter((p) => p.status === "ativo");
  const planosVencendo = planosAtivos.filter((p) => {
    if (!p.data_vencimento) return false;
    const diff = new Date(p.data_vencimento).getTime() - Date.now();
    return diff > 0 && diff < 15 * 24 * 60 * 60 * 1000;
  });
  const planosEsgotando = planosAtivos.filter((p) => {
    const restante = p.total_sessoes - p.sessoes_utilizadas;
    return restante > 0 && restante <= 3;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos de Sessões</h1>
          <p className="text-muted-foreground">Controle de pacotes e saldo de sessões</p>
        </div>
        <Button onClick={() => { setEditPlano(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Paciente</Label>
              <Input
                placeholder="Filtrar por nome..."
                value={filterPaciente}
                onChange={(e) => setFilterPaciente(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{planosAtivos.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{planos.length}</p></CardContent>
        </Card>
        <Card className={planosVencendo.length > 0 ? "border-warning/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em breve</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{planosVencendo.length}</p></CardContent>
        </Card>
        <Card className={planosEsgotando.length > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sessões esgotando</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{planosEsgotando.length}</p></CardContent>
        </Card>
      </div>

      {/* Planos Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : planos.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Nenhum plano cadastrado</p>
              <Button className="mt-4" onClick={() => { setEditPlano(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeiro plano
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sessões</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((plano) => {
                  const pct = plano.total_sessoes > 0 ? (plano.sessoes_utilizadas / plano.total_sessoes) * 100 : 0;
                  const restante = plano.total_sessoes - plano.sessoes_utilizadas;
                  const st = statusConfig[plano.status] || statusConfig.ativo;
                  return (
                    <TableRow
                      key={plano.id}
                      className={plano.status === "vencido" ? "bg-destructive/10 hover:bg-destructive/20" : ""}
                    >
                      <TableCell className="font-medium">{plano.pacientes?.nome ?? "—"}</TableCell>
                      <TableCell className="capitalize">{plano.tipo_atendimento}</TableCell>
                      <TableCell>{plano.sessoes_utilizadas}/{plano.total_sessoes} <span className="text-xs text-muted-foreground">({restante} restantes)</span></TableCell>
                      <TableCell className="w-32">
                        <Progress value={pct} className="h-2" />
                      </TableCell>
                      <TableCell>R$ {Number(plano.valor).toFixed(2)}</TableCell>
                      <TableCell className={plano.status === "vencido" ? "text-destructive font-bold" : ""}>
                        {plano.data_vencimento ? format(new Date(plano.data_vencimento), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Editar plano"
                            onClick={() => { setEditPlano(plano); setFormOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {plano.status === "ativo" && restante > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              title="Agendar sessões"
                              onClick={() => setSessoesPlano(plano)}
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => confirmPayment.mutate(plano.id)}
                            disabled={confirmPayment.isPending}
                          >
                            Confirmar Pgto
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog (create/edit) */}
      <PlanoFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editPlano={editPlano}
        pacientes={pacientes}
        modalidades={modalidades}
        userId={user?.id || ""}
      />

      {/* Sessoes Dialog */}
      {sessoesPlano && (
        <PlanoSessoesDialog
          open={!!sessoesPlano}
          onOpenChange={(open) => { if (!open) setSessoesPlano(null); }}
          plano={sessoesPlano}
          userId={user?.id || ""}
        />
      )}
    </div>
  );
};

export default Planos;
