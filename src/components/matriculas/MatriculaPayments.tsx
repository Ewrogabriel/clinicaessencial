import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, DollarSign, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
interface MatriculaPaymentsProps {
  matriculaId: string;
  pacienteId: string;
  valorMensal: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberto: { label: "Em Aberto", variant: "destructive" },
  pago: { label: "Pago", variant: "default" },
  anulado: { label: "Anulado", variant: "outline" },
};

export function MatriculaPayments({ matriculaId, pacienteId, valorMensal }: MatriculaPaymentsProps) {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; open: boolean } | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [formData, setFormData] = useState({
    mes_referencia_month: String(currentMonth),
    mes_referencia_year: String(currentYear),
    valor: String(valorMensal),
    desconto: "0",
    data_pagamento: "",
    forma_pagamento_id: "",
    observacoes: "",
    status: "aberto",
  });
  
  const [confirmData, setConfirmData] = useState({ 
    data_pagamento: format(new Date(), "yyyy-MM-dd"), 
    forma_pagamento_id: "" 
  });

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["pagamentos-matricula", matriculaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_mensalidade")
        .select(`
          *,
          formas_pagamento:forma_pagamento_id(nome)
        `)
        .eq("matricula_id", matriculaId)
        .order("mes_referencia", { ascending: false });
        
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas-pagamento-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!activeClinicId) throw new Error("Clínica não identificada");

      const mesRef = `${formData.mes_referencia_year}-${String(Number(formData.mes_referencia_month) + 1).padStart(2, "0")}-01`;
      const valor = parseFloat(formData.valor) || 0;
      const desconto = parseFloat(formData.desconto) || 0;
      const valorFinal = Math.max(0, valor - desconto);

      // 1. Inserir na tabela de pagamentos da mensalidade
      const { data: mensalidadePgto, error: mensalidadeError } = await (supabase
        .from("pagamentos_mensalidade") as any)
        .insert({
          matricula_id: matriculaId,
          paciente_id: pacienteId,
          mes_referencia: mesRef,
          valor: valorFinal,
          status: formData.status,
          data_pagamento: formData.data_pagamento || null,
          forma_pagamento_id: formData.forma_pagamento_id || null,
          observacoes: formData.observacoes || null,
          created_by: user.id,
          clinic_id: activeClinicId
        })
        .select()
        .single();

      if (mensalidadeError) throw mensalidadeError;

      // 2. Se estiver PAGO ou PENDENTE, reflete no fluxo de caixa geral (pagamentos)
      if (mensalidadePgto) {
        const descricaoMensalidade = `Mensalidade Pilates - ${format(new Date(mesRef + "T12:00:00"), "MMM/yyyy", { locale: ptBR })}`;
        
        // Payment is tracked in pagamentos_mensalidade, no need to duplicate in pagamentos
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      setFormOpen(false);
      resetForm();
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao registrar pagamento", { description: e.message }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, data_pagamento, forma_pagamento_id }: { id: string; status: string; data_pagamento?: string; forma_pagamento_id?: string }) => {
      const updates: any = { status };
      if (data_pagamento) updates.data_pagamento = data_pagamento;
      if (forma_pagamento_id) updates.forma_pagamento_id = forma_pagamento_id;
      if (status === "anulado") {
          updates.data_pagamento = null;
          updates.forma_pagamento_id = null;
      }
      
      const { error } = await supabase.from("pagamentos_mensalidade").update(updates).eq("id", id);
      if (error) throw error;

      // Payment status is tracked in pagamentos_mensalidade; financeiro reads from all sources
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar status", { description: e.message }),
  });

  const resetForm = () => {
    setFormData({
      mes_referencia_month: String(currentMonth),
      mes_referencia_year: String(currentYear),
      valor: String(valorMensal),
      desconto: "0",
      data_pagamento: "",
      forma_pagamento_id: "",
      observacoes: "",
      status: "aberto",
    });
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const formatMesRef = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return format(d, "MMMM/yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pagamentos Mensais
        </h3>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus className="h-3 w-3" /> Registrar Pagamento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : pagamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum pagamento registrado para esta matrícula.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês Ref.</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Data Pgto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentos.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium capitalize">
                    {formatMesRef(p.mes_referencia)}
                  </TableCell>
                  <TableCell className="text-sm">R$ {Number(p.valor).toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{p.formas_pagamento?.nome || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {p.data_pagamento ? format(new Date(p.data_pagamento), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status]?.variant || "outline"}>
                      {STATUS_BADGE[p.status]?.label || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                    {p.observacoes || "—"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {p.status === "aberto" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => {
                            setConfirmData({ data_pagamento: format(new Date(), "yyyy-MM-dd"), forma_pagamento_id: "" });
                            setConfirmDialog({ id: p.id, open: true });
                        }}
                      >
                        Confirmar Pgto
                      </Button>
                    )}
                    {p.status !== "anulado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-destructive"
                        onClick={() => updateStatus.mutate({ id: p.id, status: "anulado" })}
                      >
                        <Ban className="h-3 w-3 mr-1" /> Anular
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês de Referência</Label>
                <Select
                  value={formData.mes_referencia_month}
                  onValueChange={(v) => setFormData({ ...formData, mes_referencia_month: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Select
                  value={formData.mes_referencia_year}
                  onValueChange={(v) => setFormData({ ...formData, mes_referencia_year: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                />
              </div>
              <div>
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.desconto}
                  onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                />
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.forma_pagamento_id}
                  onValueChange={(v) => setFormData({ ...formData, forma_pagamento_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {formasPagamento.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Em Aberto</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
                placeholder="Ex: Desconto por indicação..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button onClick={() => createPayment.mutate()} disabled={createPayment.isPending}>
                {createPayment.isPending ? "Salvando..." : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!confirmDialog?.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input type="date" value={confirmData.data_pagamento} onChange={(e) => setConfirmData(p => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={confirmData.forma_pagamento_id} onValueChange={(v) => setConfirmData(p => ({ ...p, forma_pagamento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
              <Button
                disabled={!confirmData.data_pagamento || !confirmData.forma_pagamento_id || updateStatus.isPending}
                onClick={() => {
                  if (confirmDialog) {
                    updateStatus.mutate({
                      id: confirmDialog.id,
                      status: "pago",
                      data_pagamento: confirmData.data_pagamento,
                      forma_pagamento_id: confirmData.forma_pagamento_id,
                    });
                    setConfirmDialog(null);
                  }
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}