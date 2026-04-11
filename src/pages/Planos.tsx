import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, AlertTriangle, CheckCircle2, XCircle, Clock, Pencil, CalendarPlus, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
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
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PlanoFormDialog } from "@/components/planos/PlanoFormDialog";
import { PlanoSessoesDialog } from "@/components/planos/PlanoSessoesDialog";
import { toast } from "sonner";

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

const TIPO_TO_FORMA_ENUM: Record<string, string> = {
  pix: "pix",
  dinheiro: "dinheiro",
  boleto: "boleto",
  transferencia: "transferencia",
  cartao: "cartao_credito",
  cartao_credito: "cartao_credito",
  cartao_debito: "cartao_debito",
  cheque: "transferencia",
};

const Planos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editPlano, setEditPlano] = useState<PlanoRow | null>(null);
  const [sessoesPlano, setSessoesPlano] = useState<PlanoRow | null>(null);
  const [filterPaciente, setFilterPaciente] = useState("");
  const [filterStatus, setFilterStatus] = useState("ativo");
  const [confirmDialog, setConfirmDialog] = useState<{ planoId: string; open: boolean } | null>(null);
  const [confirmData, setConfirmData] = useState({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  // Fetch scheduled (non-completed) sessions count per plano
  const { data: agendadasMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["planos-agendadas", planos.map(p => p.id).join(",")],
    queryFn: async () => {
      if (planos.length === 0) return {};
      const { data } = await supabase
        .from("agendamentos")
        .select("observacoes, status")
        .in("status", ["agendado", "confirmado", "pendente"] as any[])
        .ilike("observacoes", "plano:%");
      const map: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        const match = a.observacoes?.match(/plano:([0-9a-f-]+)/);
        if (match) {
          map[match[1]] = (map[match[1]] || 0) + 1;
        }
      });
      return map;
    },
    enabled: planos.length > 0,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
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

  const { data: formasPagamentoList = [] } = useQuery({
    queryKey: ["formas-pagamento-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome, tipo").eq("ativo", true);
      return data ?? [];
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async ({ planoId, data_pagamento, forma_pagamento_id }: { planoId: string; data_pagamento: string; forma_pagamento_id: string }) => {
      const tipo = formasPagamentoList.find((f: { id: string; tipo: string }) => f.id === forma_pagamento_id)?.tipo ?? "pix";
      const formaEnum = TIPO_TO_FORMA_ENUM[tipo] ?? "pix";
      
      const { data: updated, error: updateError } = await supabase
        .from("pagamentos")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ status: "pago" as any, data_pagamento, forma_pagamento: formaEnum } as any)
        .eq("plano_id", planoId)
        .eq("status", "pendente")
        .select();

      if (updateError) throw updateError;

      // Se não atualizou nada, significa que é um plano antigo sem cobrança pendente. Vamos criar uma PAGA direto.
      if (!updated || updated.length === 0) {
         const planoToUpdate = planos.find(p => p.id === planoId);
         if (planoToUpdate) {
            const { error: insertError } = await supabase.from("pagamentos").insert({
               paciente_id: planoToUpdate.paciente_id,
               profissional_id: planoToUpdate.profissional_id,
               plano_id: planoId,
               valor: planoToUpdate.valor,
               data_pagamento: data_pagamento,
               forma_pagamento: formaEnum as any,
               status: "pago",
               descricao: `Plano - Baixa manual retrospectiva`,
               created_by: user!.id,
             });
             if (insertError) throw insertError;
         }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      setConfirmDialog(null);
      toast.success("Pagamento confirmado!");
    },
    onError: (e: Error) => toast.error("Erro ao confirmar", { description: e.message }),
  });
  
  const toggleAutoRenew = useMutation({
    mutationFn: async ({ id, auto_renew }: { id: string; auto_renew: boolean }) => {
      const { error } = await supabase.from("planos").update({ auto_renew }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      toast.success("Renovação automática atualizada.");
    },
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
            <div className="flex items-end justify-end">
              <div className="flex border rounded-md p-1 bg-muted/50 h-10">
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "secondary" : "ghost"} 
                  size="sm" 
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
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

      {/* Planos Display */}
      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Carregando...</div>
      ) : planos.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground border rounded-lg bg-card">
          <Package className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">Nenhum plano cadastrado</p>
          <Button className="mt-4" onClick={() => { setEditPlano(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro plano
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planos.map((plano) => {
            const agendadas = agendadasMap[plano.id] || 0;
            const pct = plano.total_sessoes > 0 ? ((plano.sessoes_utilizadas + agendadas) / plano.total_sessoes) * 100 : 0;
            const restante = plano.total_sessoes - plano.sessoes_utilizadas - agendadas;
            const st = statusConfig[plano.status] || statusConfig.ativo;
            return (
              <Card key={plano.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <span className="font-semibold text-sm truncate block">{plano.pacientes?.nome || "—"}</span>
                      <span className="text-xs text-muted-foreground capitalize">{plano.tipo_atendimento}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {(plano as any).auto_renew && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                          Auto
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Auto Renew Quick Toggle */}
                  <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md border border-muted/50">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={(plano as any).auto_renew} 
                        onCheckedChange={(v) => toggleAutoRenew.mutate({ id: plano.id, auto_renew: v })}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">Renovação Automática</span>
                    </div>
                  </div>

                  {/* Sessions Info */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span>Progresso</span>
                      <span className="font-medium">{plano.sessoes_utilizadas}/{plano.total_sessoes} sessões</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{agendadas > 0 ? `${agendadas} agendadas` : "Nenhum agendamento"}</span>
                      <span>{Math.max(0, restante)} disponíveis</span>
                    </div>
                  </div>

                  {/* Value & Expiry */}
                  <div className="flex justify-between items-center text-sm pt-1 border-t">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Valor Total</span>
                      <span className="font-bold text-primary">R$ {Number(plano.valor).toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-[10px] block">Vencimento</span>
                      <span className={plano.status === "vencido" ? "text-destructive font-bold" : ""}>
                        {plano.data_vencimento ? format(new Date(plano.data_vencimento), "dd/MM") : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                      onClick={() => { setEditPlano(plano); setFormOpen(true); }}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                      onClick={() => setSessoesPlano(plano)}>
                      Sessões
                    </Button>
                    <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs"
                      onClick={() => {
                        setConfirmData({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
                        setConfirmDialog({ planoId: plano.id, open: true });
                      }}>
                      Pagar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sessões</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Renovação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((plano) => {
                  const agendadas = agendadasMap[plano.id] || 0;
                  const pct = plano.total_sessoes > 0 ? ((plano.sessoes_utilizadas + agendadas) / plano.total_sessoes) * 100 : 0;
                  const restante = plano.total_sessoes - plano.sessoes_utilizadas - agendadas;
                  const st = statusConfig[plano.status] || statusConfig.ativo;
                  return (
                    <TableRow
                      key={plano.id}
                      className={plano.status === "vencido" ? "bg-destructive/10 hover:bg-destructive/20" : ""}
                    >
                      <TableCell className="font-medium">{plano.pacientes?.nome ?? "—"}</TableCell>
                      <TableCell className="capitalize">{plano.tipo_atendimento}</TableCell>
                      <TableCell>{plano.sessoes_utilizadas}/{plano.total_sessoes} <span className="text-xs text-muted-foreground">({Math.max(0, restante)} disponíveis{agendadas > 0 ? `, ${agendadas} agendadas` : ""})</span></TableCell>
                      <TableCell className="w-32">
                        <Progress value={pct} className="h-2" />
                      </TableCell>
                      <TableCell>R$ {Number(plano.valor).toFixed(2)}</TableCell>
                      <TableCell className={plano.status === "vencido" ? "text-destructive font-bold" : ""}>
                        {plano.data_vencimento ? format(new Date(plano.data_vencimento), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Switch 
                            checked={(plano as any).auto_renew} 
                            onCheckedChange={(v) => toggleAutoRenew.mutate({ id: plano.id, auto_renew: v })}
                          />
                        </div>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Ver sessões do plano"
                            onClick={() => setSessoesPlano(plano)}
                          >
                            <CalendarPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              setConfirmData({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
                              setConfirmDialog({ planoId: plano.id, open: true });
                            }}
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
          </CardContent>
        </Card>
      )}

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

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input type="date" value={confirmData.data_pagamento} onChange={(e) => setConfirmData(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={confirmData.forma_pagamento_id} onValueChange={(v) => setConfirmData(p => ({ ...p, forma_pagamento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                <SelectContent>
                  {formasPagamentoList.map((f: { id: string; nome: string }) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
              <Button
                disabled={!confirmData.data_pagamento || !confirmData.forma_pagamento_id || confirmPayment.isPending}
                onClick={() => confirmDialog && confirmPayment.mutate({
                  planoId: confirmDialog.planoId,
                  data_pagamento: confirmData.data_pagamento,
                  forma_pagamento_id: confirmData.forma_pagamento_id,
                })}
              >
                {confirmPayment.isPending ? "Confirmando..." : "Confirmar Pagamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planos;