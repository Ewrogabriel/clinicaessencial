import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Clock, DollarSign, Send, Filter } from "lucide-react";
import { toast } from "@/modules/shared/hooks/use-toast";

type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

interface DelinquentPayment {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  paciente_telefone: string;
  valor: number;
  data_vencimento: string;
  descricao: string;
  dias_atraso: number;
  bucket: AgingBucket;
}

const BUCKET_COLORS: Record<AgingBucket, string> = {
  "0-30": "secondary",
  "31-60": "outline",
  "61-90": "destructive",
  "90+": "destructive",
};

export function InadimplenciaReport() {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: rawPayments = [], isLoading } = useQuery({
    queryKey: ["inadimplencia", activeClinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, paciente_id, valor, data_vencimento, descricao, status, pacientes(nome, telefone)")
        .eq("status", "pendente")
        .not("data_vencimento", "is", null)
        .lt("data_vencimento", new Date().toISOString().split("T")[0])
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const payments: DelinquentPayment[] = useMemo(() => {
    const today = new Date();
    return rawPayments.map((p: any) => {
      const dias = differenceInDays(today, new Date(p.data_vencimento));
      let bucket: AgingBucket = "0-30";
      if (dias > 90) bucket = "90+";
      else if (dias > 60) bucket = "61-90";
      else if (dias > 30) bucket = "31-60";
      return {
        id: p.id,
        paciente_id: p.paciente_id,
        paciente_nome: p.pacientes?.nome || "—",
        paciente_telefone: p.pacientes?.telefone || "",
        valor: Number(p.valor),
        data_vencimento: p.data_vencimento,
        descricao: p.descricao || "",
        dias_atraso: dias,
        bucket,
      };
    });
  }, [rawPayments]);

  const filtered = filterBucket === "all" ? payments : payments.filter((p) => p.bucket === filterBucket);

  const bucketSummary = useMemo(() => {
    const summary: Record<AgingBucket, { count: number; total: number }> = {
      "0-30": { count: 0, total: 0 },
      "31-60": { count: 0, total: 0 },
      "61-90": { count: 0, total: 0 },
      "90+": { count: 0, total: 0 },
    };
    payments.forEach((p) => {
      summary[p.bucket].count++;
      summary[p.bucket].total += p.valor;
    });
    return summary;
  }, [payments]);

  const totalInadimplente = payments.reduce((s, p) => s + p.valor, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const markAsPaid = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("pagamentos")
        .update({ status: "pago", data_pagamento: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inadimplencia"] });
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} pagamento(s) marcado(s) como pago!` });
    },
  });

  const sendReminder = (payment: DelinquentPayment) => {
    if (!payment.paciente_telefone) {
      toast({ title: "Paciente sem telefone", variant: "destructive" });
      return;
    }
    const phone = payment.paciente_telefone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(
      `Olá ${payment.paciente_nome}! 😊\n\nIdentificamos um pagamento em aberto no valor de R$ ${payment.valor.toFixed(2)} com vencimento em ${format(new Date(payment.data_vencimento), "dd/MM/yyyy")}.\n\nPor favor, entre em contato para regularizar. Estamos à disposição!`
    );
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const sendBulkReminder = () => {
    const selected = filtered.filter((p) => selectedIds.has(p.id));
    selected.forEach((p) => sendReminder(p));
    toast({ title: `Cobrança enviada para ${selected.length} paciente(s)` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Relatório de Inadimplência
        </h2>
        <p className="text-sm text-muted-foreground">Aging de pagamentos em atraso com ações em lote</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">R$ {totalInadimplente.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total em atraso</p>
          </CardContent>
        </Card>
        {(["0-30", "31-60", "61-90", "90+"] as AgingBucket[]).map((bucket) => (
          <Card
            key={bucket}
            className={`cursor-pointer transition-all ${filterBucket === bucket ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterBucket(filterBucket === bucket ? "all" : bucket)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-lg font-bold">{bucketSummary[bucket].count}</p>
              <p className="text-xs text-muted-foreground">{bucket} dias</p>
              <p className="text-xs font-medium">R$ {bucketSummary[bucket].total.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <Button size="sm" onClick={() => markAsPaid.mutate(Array.from(selectedIds))} disabled={markAsPaid.isPending}>
            <DollarSign className="h-4 w-4 mr-1" /> Marcar como Pago
          </Button>
          <Button size="sm" variant="outline" onClick={sendBulkReminder}>
            <Send className="h-4 w-4 mr-1" /> Cobrar via WhatsApp
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Dias Atraso</TableHead>
                <TableHead>Faixa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum pagamento em atraso 🎉</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.paciente_nome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.descricao || "—"}</TableCell>
                    <TableCell>{format(new Date(p.data_vencimento), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-bold text-destructive">{p.dias_atraso}d</TableCell>
                    <TableCell>
                      <Badge variant={BUCKET_COLORS[p.bucket] as any}>{p.bucket}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">R$ {p.valor.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => sendReminder(p)} title="Cobrar via WhatsApp">
                        <Send className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
