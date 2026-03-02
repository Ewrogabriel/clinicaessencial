import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Package, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo: { label: "Ativo", variant: "default" },
  vencido: { label: "Vencido", variant: "destructive" },
  cancelado: { label: "Cancelado", variant: "outline" },
  finalizado: { label: "Finalizado", variant: "secondary" },
};

const Planos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    paciente_id: "",
    tipo_atendimento: "",
    total_sessoes: 10,
    valor: "",
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_vencimento: "",
    observacoes: "",
  });

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("*, pacientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  const createPlano = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data: plano, error: planoError } = await supabase.from("planos").insert({
        paciente_id: formData.paciente_id,
        profissional_id: user.id,
        tipo_atendimento: formData.tipo_atendimento,
        total_sessoes: formData.total_sessoes,
        valor: parseFloat(formData.valor) || 0,
        data_inicio: formData.data_inicio,
        data_vencimento: formData.data_vencimento || null,
        observacoes: formData.observacoes || null,
        created_by: user.id,
      }).select().single();

      if (planoError) throw planoError;

      // Auto-create pending payment
      const { error: pgtoError } = await supabase.from("pagamentos").insert({
        paciente_id: formData.paciente_id,
        profissional_id: user.id,
        plano_id: plano.id,
        valor: parseFloat(formData.valor) || 0,
        data_vencimento: formData.data_vencimento || null,
        status: "pendente",
        descricao: `Plano ${formData.tipo_atendimento} - ${formData.total_sessoes} sessões`,
        created_by: user.id,
      });

      if (pgtoError) throw pgtoError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      setFormOpen(false);
      setFormData({ paciente_id: "", tipo_atendimento: "", total_sessoes: 10, valor: "", data_inicio: format(new Date(), "yyyy-MM-dd"), data_vencimento: "", observacoes: "" });
      toast({ title: "Plano criado com sucesso!" });
    },
    onError: (e: Error | any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
  });

  const planosAtivos = (planos as any[]).filter((p) => p.status === "ativo");
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
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Plano
        </Button>
      </div>

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
              <Button className="mt-4" onClick={() => setFormOpen(true)}>
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
                {(planos as any[]).map((plano) => {
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => confirmPayment.mutate(plano.id)}
                          disabled={confirmPayment.isPending}
                        >
                          Confirmar Pagamento
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

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Novo Plano de Sessões</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Paciente</Label>
              <Select value={formData.paciente_id} onValueChange={(v) => setFormData(p => ({ ...p, paciente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(pacientes as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Modalidade</Label>
                <Select value={formData.tipo_atendimento} onValueChange={(v: any) => setFormData(p => ({ ...p, tipo_atendimento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(modalidades as any[]).map((mod) => (
                      <SelectItem key={mod.id} value={mod.nome.toLowerCase()}>{mod.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qtd. Sessões</Label>
                <Select value={String(formData.total_sessoes)} onValueChange={(v) => setFormData(p => ({ ...p, total_sessoes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 sessões</SelectItem>
                    <SelectItem value="10">10 sessões</SelectItem>
                    <SelectItem value="15">15 sessões</SelectItem>
                    <SelectItem value="20">20 sessões</SelectItem>
                    <SelectItem value="30">30 sessões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={formData.valor} onChange={(e) => setFormData(p => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={formData.data_inicio} onChange={(e) => setFormData(p => ({ ...p, data_inicio: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Data de Vencimento (opcional)</Label>
              <Input type="date" value={formData.data_vencimento} onChange={(e) => setFormData(p => ({ ...p, data_vencimento: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Observações sobre o plano..." value={formData.observacoes} onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => createPlano.mutate()} disabled={!formData.paciente_id || createPlano.isPending}>
                {createPlano.isPending ? "Salvando..." : "Criar Plano"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planos;
