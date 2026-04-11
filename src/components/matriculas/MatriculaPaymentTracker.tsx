import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, AlertTriangle, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  aberto: { label: "Em Aberto", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  pago: { label: "Pago", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  atrasado: { label: "Atrasado", icon: AlertTriangle, color: "bg-red-100 text-red-800" },
};

interface Props {
  matriculaId: string;
  pacienteId: string;
  pacienteNome: string;
  valorMensal: number;
}

export function MatriculaPaymentTracker({ matriculaId, pacienteId, pacienteNome, valorMensal }: Props) {
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formaPagamentoId, setFormaPagamentoId] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["matricula-payments", matriculaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("matricula_payment_tracking")
        .select("*, formas_pagamento(nome)")
        .eq("matricula_id", matriculaId)
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas-pagamento-list"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const generateMonths = useMutation({
    mutationFn: async () => {
      if (!activeClinicId) throw new Error("Clínica não selecionada");
      const existingMonths = new Set(payments.map((p: any) => p.mes_referencia));
      const now = new Date();
      const toInsert: any[] = [];
      
      for (let i = 0; i < 12; i++) {
        const monthDate = addMonths(now, i);
        const mesRef = format(monthDate, "yyyy-MM");
        if (!existingMonths.has(mesRef)) {
          toInsert.push({
            matricula_id: matriculaId,
            paciente_id: pacienteId,
            mes_referencia: mesRef,
            valor: valorMensal,
            status: "aberto",
            clinic_id: activeClinicId,
          });
        }
      }

      if (toInsert.length > 0) {
        const { error } = await (supabase as any).from("matricula_payment_tracking").insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matricula-payments", matriculaId] });
      toast.success("Meses gerados com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const markAsPaid = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) throw new Error("Pagamento não selecionado");
      const { error } = await (supabase as any)
        .from("matricula_payment_tracking")
        .update({
          status: "pago",
          data_pagamento: paymentDate,
          forma_pagamento_id: formaPagamentoId || null,
        })
        .eq("id", selectedPayment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matricula-payments", matriculaId] });
      setPayDialogOpen(false);
      setSelectedPayment(null);
      toast.success("Pagamento registrado!");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const openPayDialog = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setFormaPagamentoId("");
    setPayDialogOpen(true);
  };

  const totalPago = payments.filter((p: any) => p.status === "pago").reduce((acc: number, p: any) => acc + Number(p.valor), 0);
  const totalAberto = payments.filter((p: any) => p.status !== "pago").reduce((acc: number, p: any) => acc + Number(p.valor), 0);

  const formatMonth = (mesRef: string) => {
    const [year, month] = mesRef.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return format(date, "MMM/yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pagamentos — {pacienteNome}</h3>
        <Button size="sm" variant="outline" onClick={() => generateMonths.mutate()} disabled={generateMonths.isPending} className="gap-1 text-xs">
          <Calendar className="h-3 w-3" /> Gerar Próximos 12 Meses
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 bg-green-50 dark:bg-green-900/20">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Pago</div>
          <div className="text-lg font-bold text-green-600">R$ {totalPago.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-3 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total em Aberto</div>
          <div className="text-lg font-bold text-yellow-600">R$ {totalAberto.toFixed(2)}</div>
        </div>
      </div>

      {/* Payment grid */}
      {isLoading ? (
        <p className="text-sm text-center text-muted-foreground py-4">Carregando...</p>
      ) : payments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum pagamento registrado.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => generateMonths.mutate()}>
            Gerar Meses
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {payments.map((p: any) => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.aberto;
            const Icon = cfg.icon;
            return (
              <div
                key={p.id}
                className="border rounded-lg p-2.5 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => p.status !== "pago" && openPayDialog(p)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold capitalize">{formatMonth(p.mes_referencia)}</span>
                  <Badge className={`text-[9px] px-1.5 py-0 ${cfg.color}`}>
                    <Icon className="h-2.5 w-2.5 mr-0.5" />
                    {cfg.label}
                  </Badge>
                </div>
                <div className="text-sm font-bold">R$ {Number(p.valor).toFixed(2)}</div>
                {p.status === "pago" && p.data_pagamento && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Pago em {format(new Date(p.data_pagamento + "T12:00:00"), "dd/MM/yyyy")}
                  </div>
                )}
                {p.formas_pagamento?.nome && (
                  <div className="text-[10px] text-muted-foreground">{p.formas_pagamento.nome}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pay dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Mês: </span>
              <strong className="capitalize">{selectedPayment ? formatMonth(selectedPayment.mes_referencia) : ""}</strong>
              <br />
              <span className="text-muted-foreground">Valor: </span>
              <strong>R$ {Number(selectedPayment?.valor || 0).toFixed(2)}</strong>
            </div>
            <div>
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((fp: any) => (
                    <SelectItem key={fp.id} value={fp.id}>{fp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => markAsPaid.mutate()} disabled={markAsPaid.isPending} className="w-full gap-2">
              <CheckCircle2 className="h-4 w-4" /> {markAsPaid.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
