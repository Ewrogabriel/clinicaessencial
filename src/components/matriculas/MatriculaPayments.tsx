import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CommissionEngine } from "@/modules/commissions/commissionEngine";
import { Plus, DollarSign, Ban, CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enrollmentService } from "@/modules/matriculas/services/enrollmentService";
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
  diaVencimento?: number; // dia do mês para vencimento (padrão: 10)
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

export function MatriculaPayments({ matriculaId, pacienteId, valorMensal, diaVencimento = 10 }: MatriculaPaymentsProps) {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMonths, setBulkMonths] = useState(3);
  const [editPaymentData, setEditPaymentData] = useState<{ id: string; valor: string; mes_referencia_month: string; mes_referencia_year: string; data_pagamento: string; forma_pagamento_id: string; status: string; observacoes: string } | null>(null);
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
      // Nota: campo created_by não existe na tabela pagamentos_mensalidade
      const { error: mensalidadeError } = await supabase
        .from("pagamentos_mensalidade")
        .insert({
          matricula_id: matriculaId,
          paciente_id: pacienteId,
          mes_referencia: mesRef,
          valor: valorFinal,
          status: formData.status,
          data_pagamento: formData.data_pagamento || null,
          forma_pagamento_id: formData.forma_pagamento_id || null,
          observacoes: formData.observacoes || null,
          clinic_id: activeClinicId
        });

      if (mensalidadeError) throw mensalidadeError;
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

  const updatePayment = useMutation({
    mutationFn: async (data: typeof editPaymentData) => {
      if (!data) return;
      const mesRef = `${data.mes_referencia_year}-${String(Number(data.mes_referencia_month) + 1).padStart(2, "0")}-01`;
      
      const updates: any = {
        valor: parseFloat(data.valor) || 0,
        mes_referencia: mesRef,
        status: data.status,
        data_pagamento: data.data_pagamento || null,
        forma_pagamento_id: data.forma_pagamento_id || null,
        observacoes: data.observacoes || null
      };

      if (data.status === "anulado") {
        updates.data_pagamento = null;
        updates.forma_pagamento_id = null;
      }
      
      const { error } = await supabase.from("pagamentos_mensalidade").update(updates).eq("id", data.id);
      if (error) throw error;
      
      // If updating the value, we should ask if we want to propagate - but the requirement is to propagate editing the Enrollment, not the Payment for now. Let's stick to updatePayment updating this single row.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      setEditPaymentData(null);
      toast.success("Pagamento atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar pagamento", { description: e.message }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos_mensalidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      toast.success("Pagamento excluído com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
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
      
      const { data, error } = await supabase.from("pagamentos_mensalidade").update(updates).eq("id", id).select("id").single();
      if (error) throw error;

      if (status === "pago" && data) {
        await CommissionEngine.releaseCommissionsByPayment(data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar status", { description: e.message }),
  });

  const bulkCreatePayments = useMutation({
    mutationFn: async () => {
      if (!user || !activeClinicId) throw new Error("Dados incompletos");

      // 1. Buscar detalhes da matrícula e horários semanais
      const { data: enrollment, error: matErr } = await supabase
        .from("matriculas")
        .select("*, weekly_schedules(*)")
        .eq("id", matriculaId)
        .single();

      if (matErr || !enrollment) throw new Error("Matrícula não encontrada");

      const base = startOfMonth(new Date());
      let totalSessoes = 0;
      let totalMensalidades = 0;
      const hasSchedules = enrollment.weekly_schedules && enrollment.weekly_schedules.length > 0;

      for (let i = 0; i < bulkMonths; i++) {
        const monthDate = addMonths(base, i);
        const startDate = format(startOfMonth(monthDate), "yyyy-MM-dd");
        const endDate = format(endOfMonth(monthDate), "yyyy-MM-dd");
        const mesRef = format(monthDate, "yyyy-MM") + "-01";

        if (hasSchedules) {
          // Gerar sessões (o serviço agora também garante a mensalidade financeira)
          const count = await enrollmentService.generateSessions({
            enrollmentId: matriculaId,
            pacienteId: pacienteId,
            weeklySchedules: enrollment.weekly_schedules.map((s: any) => ({
              weekday: s.weekday,
              time: s.time,
              professional_id: s.professional_id,
              session_duration: s.session_duration
            })),
            startDate,
            endDate,
            tipoAtendimento: enrollment.tipo_atendimento || "Pilates",
            monthlyValue: Number(valorMensal || 0),
            tipoSessao: (enrollment.tipo_sessao || "grupo") as "grupo" | "individual",
            clinicId: activeClinicId,
            userId: user.id
          });
          totalSessoes += count;
        } else {
          // Sem schedules: criar apenas a mensalidade financeira diretamente
          // Verificar se já existe cobrança para este mês
          const { data: existing } = await supabase
            .from("pagamentos_mensalidade")
            .select("id")
            .eq("matricula_id", matriculaId)
            .eq("mes_referencia", mesRef)
            .maybeSingle();

          if (!existing && valorMensal > 0) {
            const { error: insertError } = await supabase
              .from("pagamentos_mensalidade")
              .insert({
                matricula_id: matriculaId,
                paciente_id: pacienteId,
                clinic_id: activeClinicId,
                valor: valorMensal,
                mes_referencia: mesRef,
                status: "aberto"
              });

            if (insertError) throw insertError;
            totalMensalidades++;
          }
        }
      }

      return { totalSessoes, totalMensalidades };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-matricula", matriculaId] });
      queryClient.invalidateQueries({ queryKey: ["all-payments-unified"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      setBulkOpen(false);
      
      if (result.totalSessoes > 0) {
        toast.success(`${result.totalSessoes} sessões e cobrança(s) gerada(s) com sucesso!`);
      } else if (result.totalMensalidades > 0) {
        toast.success(`${result.totalMensalidades} mensalidade(s) gerada(s) com sucesso!`);
      } else {
        toast.info("Todas as mensalidades para o período já existem.");
      }
    },
    onError: (e: Error) => toast.error("Erro ao gerar mensalidades", { description: e.message }),
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

  const openEditDialog = (payment: any) => {
    const d = new Date(payment.mes_referencia + "T12:00:00");
    setEditPaymentData({
      id: payment.id,
      valor: String(payment.valor),
      mes_referencia_month: String(d.getMonth()),
      mes_referencia_year: String(d.getFullYear()),
      data_pagamento: payment.data_pagamento || "",
      forma_pagamento_id: payment.forma_pagamento_id || "",
      status: payment.status,
      observacoes: payment.observacoes || "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pagamentos Mensais
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} className="gap-1 text-xs">
            <CalendarRange className="h-3 w-3" /> Gerar Mensalidades
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <Plus className="h-3 w-3" /> Registrar Pagamento
          </Button>
        </div>
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
                  <TableCell className="space-x-1 whitespace-nowrap">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={() => openEditDialog(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-destructive"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja excluir esta mensalidade?")) {
                          deletePayment.mutate(p.id);
                        }
                      }}
                    >
                      Excluir
                    </Button>
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
      
      <Dialog open={!!editPaymentData} onOpenChange={(open) => !open && setEditPaymentData(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>
          {editPaymentData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mês de Referência</Label>
                  <Select
                    value={editPaymentData.mes_referencia_month}
                    onValueChange={(v) => setEditPaymentData({ ...editPaymentData, mes_referencia_month: v })}
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
                    value={editPaymentData.mes_referencia_year}
                    onValueChange={(v) => setEditPaymentData({ ...editPaymentData, mes_referencia_year: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaymentData.valor}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, valor: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={editPaymentData.data_pagamento}
                    onChange={(e) => setEditPaymentData({ ...editPaymentData, data_pagamento: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={editPaymentData.forma_pagamento_id}
                    onValueChange={(v) => setEditPaymentData({ ...editPaymentData, forma_pagamento_id: v })}
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
                  value={editPaymentData.status}
                  onValueChange={(v) => setEditPaymentData({ ...editPaymentData, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="anulado">Anulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editPaymentData.observacoes}
                  onChange={(e) => setEditPaymentData({ ...editPaymentData, observacoes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditPaymentData(null)}>Cancelar</Button>
                <Button onClick={() => updatePayment.mutate(editPaymentData)} disabled={updatePayment.isPending}>
                  {updatePayment.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          )}
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

      {/* Dialog de Geração em Lote */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4" /> Gerar Mensalidades em Lote
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gera cobranças mensais em aberto para os próximos meses. Meses já registrados serão ignorados.
            </p>
            <div>
              <Label>Quantos meses gerar?</Label>
              <div className="flex gap-2 mt-2">
                {[1, 3, 6, 12].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBulkMonths(n)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      bulkMonths === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {bulkMonths} parcela(s) de R$ {valorMensal.toFixed(2)} = R$ {(bulkMonths * valorMensal).toFixed(2)} total
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => bulkCreatePayments.mutate()}
                disabled={bulkCreatePayments.isPending}
                className="gap-2"
              >
                <CalendarRange className="h-4 w-4" />
                {bulkCreatePayments.isPending ? "Gerando..." : `Gerar ${bulkMonths} mês(es)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
