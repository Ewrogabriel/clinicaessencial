import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, ChevronDown, X,
  TrendingDown, TrendingUp, Clock, AlertCircle,
  CheckCircle2, AlertTriangle, Ban, Minus, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentEntry {
  id: string;
  source_table: "pagamentos" | "pagamentos_mensalidade" | "pagamentos_sessoes" | "matriculas" | "planos";
  data_pagamento: string | null;
  data_vencimento: string | null;
  descricao: string;
  status: string;
  forma_pagamento: string | null;
  valor: number;
  origem_tipo: string;
  observacoes?: string | null;
  bank_transaction_id?: string | null;
  bank_status?: string | null;
  bank_data_conciliacao?: string | null;
  created_at: string;
  dias_atraso?: number;
  profissional?: string | null;
  mes_referencia?: string | null;
}

interface PaymentHistoryTabProps {
  pacienteId: string;
  pacienteNome: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const labelOrigem: Record<string, string> = {
  plano: "Plano / Pacote",
  mensalidade: "Mensalidade",
  matricula: "Matrícula",
  sessao: "Sessão Avulsa",
  sessao_avulsa: "Sessão Avulsa",
  manual: "Pagamento Manual",
  reembolso: "Reembolso",
  ajuste: "Ajuste",
  credito: "Crédito",
  investimento: "Investimento",
};

const labelStatus: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pago: { label: "Pago", variant: "default" },
  pendente: { label: "Pendente", variant: "secondary" },
  vencido: { label: "Atrasado", variant: "destructive" },
  atrasado: { label: "Atrasado", variant: "destructive" },
  nao_iniciado: { label: "Não Pago", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "outline" },
  reembolsado: { label: "Reembolsado", variant: "outline" },
  aberto: { label: "Em Aberto", variant: "secondary" },
  parcialmente_pago: { label: "Parcial", variant: "secondary" },
};

function getMovimentacaoTipo(valor: number, status: string): { tipo: string; cor: string } {
  if (status === "reembolsado" || valor < 0) return { tipo: "Crédito", cor: "text-green-600" };
  return { tipo: "Débito", cor: "text-red-600" };
}

function ReconciliationBadge({ bankStatus, dataConciliacao }: { bankStatus?: string | null; dataConciliacao?: string | null }) {
  if (bankStatus === "conciliado") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {dataConciliacao
          ? `Conciliada em ${format(new Date(dataConciliacao), "dd/MM", { locale: ptBR })}`
          : "Conciliada"}
      </Badge>
    );
  }
  if (bankStatus === "pendente") {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Aguardando
      </Badge>
    );
  }
  if (bankStatus === "rejeitado") {
    return (
      <Badge variant="destructive" className="gap-1">
        <Ban className="h-3 w-3" />
        Rejeitada
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Minus className="h-3 w-3" />
      Sem banco
    </Badge>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────

function PaymentDetailModal({
  payment,
  onClose,
}: {
  payment: PaymentEntry;
  onClose: () => void;
}) {
  const dateStr = payment.data_pagamento || payment.data_vencimento || payment.created_at;
  const { tipo, cor } = getMovimentacaoTipo(payment.valor, payment.status);
  const statusInfo = labelStatus[payment.status] ?? { label: payment.status, variant: "secondary" as const };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Detalhes do Pagamento</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* ID */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">ID</p>
              <p className="font-mono text-xs truncate">{payment.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Tipo</p>
              <p className={`font-semibold ${cor}`}>{tipo}</p>
            </div>
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Data</p>
              <p>
                {dateStr
                  ? format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Status</p>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </div>

          {/* Atraso */}
          {payment.dias_atraso !== undefined && payment.dias_atraso > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                Atrasado há {payment.dias_atraso} {payment.dias_atraso === 1 ? "dia" : "dias"}
              </span>
              {payment.data_vencimento && (
                <span className="text-xs text-red-500 ml-auto">
                  Venc.: {format(new Date(payment.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
          )}

          {/* Origem + Forma */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Origem</p>
              <p>{labelOrigem[payment.origem_tipo] ?? payment.origem_tipo}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Forma de Pagamento</p>
              <p>{payment.forma_pagamento || "—"}</p>
            </div>
          </div>

          {/* Profissional (if session) */}
          {payment.profissional && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Profissional</p>
              <p className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {payment.profissional}
              </p>
            </div>
          )}

          {/* Mês referência */}
          {payment.mes_referencia && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Mês de Referência</p>
              <p>{payment.mes_referencia}</p>
            </div>
          )}

          {/* Descrição */}
          <div>
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Descrição</p>
            <p>{payment.descricao || "—"}</p>
          </div>

          {/* Valor */}
          <div className="p-3 rounded-lg bg-muted/40">
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Valor</p>
            <p className={`text-xl font-bold ${cor}`}>
              {tipo === "Débito" ? "-" : "+"}{formatBRL(Math.abs(payment.valor))}
            </p>
          </div>

          {/* Data de vencimento */}
          {payment.data_vencimento && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Data de Vencimento</p>
              <p>{format(new Date(payment.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          )}

          {/* Reconciliação bancária */}
          <div>
            <p className="text-muted-foreground text-xs uppercase font-semibold mb-1">Conciliação Bancária</p>
            <ReconciliationBadge
              bankStatus={payment.bank_status}
              dataConciliacao={payment.bank_data_conciliacao}
            />
          </div>

          {/* Observações */}
          {payment.observacoes && (
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold mb-0.5">Observações</p>
              <p className="text-muted-foreground">{payment.observacoes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PaymentHistoryTab({ pacienteId, pacienteNome }: PaymentHistoryTabProps) {
  const [searchText, setSearchText] = useState("");
  const [filterForma, setFilterForma] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState("ultimos3");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [selectedPayment, setSelectedPayment] = useState<PaymentEntry | null>(null);

  // ── Fetch all payment tables + pending items for this patient ────────────
  const { data: payments = [], isLoading } = useQuery<PaymentEntry[]>({
    queryKey: ["patient-payment-history", pacienteId],
    queryFn: async () => {
      const results: PaymentEntry[] = [];
      const now = new Date();

      // ── Helper: compute effective status and dias_atraso ─────────────────
      function resolveStatus(status: string, dataVencimento: string | null): { status: string; dias_atraso?: number } {
        if ((status === "pendente" || status === "aberto") && dataVencimento) {
          const venc = new Date(dataVencimento);
          if (venc < now) {
            const dias = differenceInDays(now, venc);
            return { status: "atrasado", dias_atraso: dias };
          }
        }
        return { status };
      }

      // 1. pagamentos (includes sessao_avulsa, matricula, plano, manual)
      const { data: pgtos } = await supabase
        .from("pagamentos")
        .select("id, valor, data_pagamento, data_vencimento, status, forma_pagamento, descricao, observacoes, created_at, bank_transaction_id, origem_tipo, agendamento_id, profissional_id, matricula_id, plano_id")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      // Gather bank transaction IDs from pagamentos
      const bankIds: string[] = [];
      (pgtos || []).forEach((p: any) => {
        if (p.bank_transaction_id) bankIds.push(p.bank_transaction_id);
      });

      // Fetch bank transactions for reconciliation info
      const bankMap: Record<string, { status: string; data_conciliacao: string | null }> = {};
      if (bankIds.length > 0) {
        const { data: bts } = await (supabase as any)
          .from("bank_transactions")
          .select("id, status, data_conciliacao")
          .in("id", bankIds);
        (bts || []).forEach((bt: any) => {
          bankMap[bt.id] = { status: bt.status, data_conciliacao: bt.data_conciliacao };
        });
      }

      // Fetch profissional names for sessions
      const profissionalIds: string[] = [];
      (pgtos || []).forEach((p: any) => {
        if (p.profissional_id && (p.origem_tipo === "sessao_avulsa" || p.origem_tipo === "plano")) {
          if (!profissionalIds.includes(p.profissional_id)) profissionalIds.push(p.profissional_id);
        }
      });
      const profissionalMap: Record<string, string> = {};
      if (profissionalIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome")
          .in("id", profissionalIds);
        (profs || []).forEach((pr: any) => {
          profissionalMap[pr.id] = pr.nome;
        });
      }

      (pgtos || []).forEach((p: any) => {
        const bt = p.bank_transaction_id ? bankMap[p.bank_transaction_id] : null;
        const { status, dias_atraso } = resolveStatus(p.status ?? "pendente", p.data_vencimento);
        results.push({
          id: p.id,
          source_table: "pagamentos",
          data_pagamento: p.data_pagamento,
          data_vencimento: p.data_vencimento,
          descricao: p.descricao || "Pagamento",
          status,
          dias_atraso,
          forma_pagamento: p.forma_pagamento,
          valor: Number(p.valor),
          origem_tipo: p.origem_tipo ?? "manual",
          observacoes: p.observacoes,
          bank_transaction_id: p.bank_transaction_id,
          bank_status: bt?.status ?? null,
          bank_data_conciliacao: bt?.data_conciliacao ?? null,
          created_at: p.created_at ?? "",
          profissional: p.profissional_id ? (profissionalMap[p.profissional_id] ?? null) : null,
        });
      });

      // 2. pagamentos_mensalidade
      const { data: mensalidades } = await supabase
        .from("pagamentos_mensalidade")
        .select("id, valor, data_pagamento, data_vencimento, status, forma_pagamento_id, mes_referencia, observacoes, created_at")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      (mensalidades || []).forEach((m: any) => {
        const mesRef = m.mes_referencia
          ? format(new Date(m.mes_referencia), "MM/yyyy", { locale: ptBR })
          : null;
        const { status, dias_atraso } = resolveStatus(m.status ?? "aberto", m.data_vencimento ?? m.mes_referencia);
        results.push({
          id: m.id,
          source_table: "pagamentos_mensalidade",
          data_pagamento: m.data_pagamento,
          data_vencimento: m.data_vencimento ?? m.mes_referencia,
          descricao: mesRef ? `Matrícula - ${mesRef}` : "Matrícula",
          status,
          dias_atraso,
          forma_pagamento: m.forma_pagamento_id ?? null,
          valor: Number(m.valor),
          origem_tipo: "matricula",
          observacoes: m.observacoes,
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: m.created_at ?? "",
          mes_referencia: mesRef,
        });
      });

      // 3. pagamentos_sessoes
      const { data: sessoes } = await supabase
        .from("pagamentos_sessoes")
        .select("id, valor, data_pagamento, status, observacoes, created_at, forma_pagamento_id")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      (sessoes || []).forEach((s: any) => {
        const { status, dias_atraso } = resolveStatus(s.status ?? "aberto", null);
        results.push({
          id: s.id,
          source_table: "pagamentos_sessoes",
          data_pagamento: s.data_pagamento,
          data_vencimento: null,
          descricao: s.observacoes || "Sessão Avulsa",
          status,
          dias_atraso,
          forma_pagamento: s.forma_pagamento_id ?? null,
          valor: Number(s.valor),
          origem_tipo: "sessao_avulsa",
          observacoes: s.observacoes,
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: s.created_at ?? "",
        });
      });

      // 4. Active matriculas with no payment record (nao_iniciado / atrasado)
      const { data: matriculas } = await (supabase as any)
        .from("matriculas")
        .select("id, tipo, valor_mensal, data_inicio, data_vencimento, status, created_at")
        .eq("paciente_id", pacienteId)
        .eq("status", "ativa");

      // Build set of matricula IDs that have been paid:
      // (a) via pagamentos table (matricula_id column)
      const paidMatriculaFromPgtos = new Set(
        (pgtos || [])
          .filter((p: any) => p.origem_tipo === "matricula" && p.matricula_id)
          .map((p: any) => p.matricula_id)
      );
      // (b) via pagamentos_mensalidade (matricula_id field)
      const { data: pgMensalWithMatricula } = await (supabase as any)
        .from("pagamentos_mensalidade")
        .select("matricula_id")
        .eq("paciente_id", pacienteId)
        .not("matricula_id", "is", null);
      const paidMatriculaRefIds = new Set([
        ...paidMatriculaFromPgtos,
        ...(pgMensalWithMatricula || []).map((r: any) => r.matricula_id),
      ]);

      (matriculas || []).forEach((m: any) => {
        if (paidMatriculaRefIds.has(m.id)) return; // already has payment records
        const { status, dias_atraso } = resolveStatus("pendente", m.data_vencimento);
        const effectiveStatus = status === "atrasado" ? "atrasado" : "nao_iniciado";
        results.push({
          id: m.id,
          source_table: "matriculas",
          data_pagamento: null,
          data_vencimento: m.data_vencimento,
          descricao: `Matrícula ${m.tipo ? `(${m.tipo})` : ""}`.trim(),
          status: effectiveStatus,
          dias_atraso,
          forma_pagamento: null,
          valor: Number(m.valor_mensal),
          origem_tipo: "matricula",
          observacoes: null,
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: m.created_at ?? "",
        });
      });

      // 5. Active planos (session packages) with no payment record
      const { data: planos } = await (supabase as any)
        .from("planos")
        .select("id, tipo_atendimento, total_sessoes, sessoes_utilizadas, valor, status, data_inicio, data_vencimento, created_at, profissional_id")
        .eq("paciente_id", pacienteId)
        .eq("status", "ativo");

      // Build set of plano IDs that have been paid via pagamentos (plano_id column)
      const paidPlanoIds = new Set(
        (pgtos || [])
          .filter((p: any) => p.origem_tipo === "plano" && p.plano_id)
          .map((p: any) => p.plano_id)
      );

      (planos || []).forEach((pl: any) => {
        if (paidPlanoIds.has(pl.id)) return; // already has payment records
        const { status, dias_atraso } = resolveStatus("pendente", pl.data_vencimento);
        const effectiveStatus = status === "atrasado" ? "atrasado" : "nao_iniciado";
        const sessoesPendentes = (pl.total_sessoes || 0) - (pl.sessoes_utilizadas || 0);
        results.push({
          id: pl.id,
          source_table: "planos",
          data_pagamento: null,
          data_vencimento: pl.data_vencimento,
          descricao: `Plano ${pl.tipo_atendimento || ""} (${pl.sessoes_utilizadas}/${pl.total_sessoes} sessões)`.trim(),
          status: effectiveStatus,
          dias_atraso,
          forma_pagamento: null,
          valor: Number(pl.valor),
          origem_tipo: "plano",
          observacoes: sessoesPendentes > 0 ? `${sessoesPendentes} sessão(ões) restante(s)` : null,
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: pl.created_at ?? "",
          profissional: pl.profissional_id ? (profissionalMap[pl.profissional_id] ?? null) : null,
        });
      });

      // 6. Sessões avulsas realizadas sem pagamento (not in pagamentos nor pagamentos_sessoes)
      // Build sets of agendamento IDs already covered by payment records
      const paidAgendamentoIds = new Set(
        (pgtos || [])
          .filter((p: any) => p.agendamento_id)
          .map((p: any) => p.agendamento_id)
      );
      const { data: paidSessoesByAgendamento } = await (supabase as any)
        .from("pagamentos_sessoes")
        .select("agendamento_id")
        .eq("paciente_id", pacienteId)
        .not("agendamento_id", "is", null);
      (paidSessoesByAgendamento || []).forEach((r: any) => {
        if (r.agendamento_id) paidAgendamentoIds.add(r.agendamento_id);
      });

      const { data: agendamentosRealizados } = await (supabase as any)
        .from("agendamentos")
        .select("id, data_horario, profissional_id, created_at")
        .eq("paciente_id", pacienteId)
        .eq("status", "realizado");

      // Collect profissional IDs from unpaid sessions for name lookup
      const unpaidSessaoIds: string[] = [];
      (agendamentosRealizados || []).forEach((ag: any) => {
        if (!paidAgendamentoIds.has(ag.id)) {
          if (ag.profissional_id && !profissionalIds.includes(ag.profissional_id)) {
            profissionalIds.push(ag.profissional_id);
            unpaidSessaoIds.push(ag.profissional_id);
          }
        }
      });

      // Fetch any additional profissional names not yet loaded
      if (unpaidSessaoIds.length > 0) {
        const missingIds = unpaidSessaoIds.filter((id) => !profissionalMap[id]);
        if (missingIds.length > 0) {
          const { data: extraProfs } = await (supabase as any)
            .from("profiles")
            .select("id, nome")
            .in("id", missingIds);
          (extraProfs || []).forEach((pr: any) => {
            profissionalMap[pr.id] = pr.nome;
          });
        }
      }

      (agendamentosRealizados || []).forEach((ag: any) => {
        if (paidAgendamentoIds.has(ag.id)) return; // already has a payment record
        const hoje = now;
        const dataSessao = new Date(ag.data_horario);
        const isAtrasado = dataSessao < hoje;
        const dias_atraso = isAtrasado ? differenceInDays(hoje, dataSessao) : undefined;
        results.push({
          id: `sessao-pendente-${ag.id}`,
          source_table: "pagamentos_sessoes",
          data_pagamento: null,
          data_vencimento: ag.data_horario,
          descricao: `Sessão com ${ag.profissional_id ? (profissionalMap[ag.profissional_id] ?? "Profissional") : "Profissional"}`,
          status: isAtrasado ? "atrasado" : "pendente",
          dias_atraso,
          forma_pagamento: null,
          valor: 0,
          origem_tipo: "sessao_avulsa",
          observacoes: "Sessão realizada - pagamento pendente",
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: ag.created_at ?? "",
          profissional: ag.profissional_id ? (profissionalMap[ag.profissional_id] ?? null) : null,
        });
      });

      return results.sort((a, b) => {
        const dateA = a.data_pagamento || a.data_vencimento || a.created_at;
        const dateB = b.data_pagamento || b.data_vencimento || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // ── Generate period options (last 12 months) ──────────────────────────────
  const periodOptions = useMemo(() => {
    const options = [{ value: "todos", label: "Todos os períodos" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = format(d, "yyyy-MM");
      const label = format(d, "MMMM/yyyy", { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    return payments.filter((p) => {
      // Period filter
      if (filterPeriodo !== "todos") {
        const refDate = p.data_pagamento || p.data_vencimento || p.created_at;
        if (refDate) {
          if (filterPeriodo === "ultimos3") {
            const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            if (new Date(refDate) < cutoff) return false;
          } else {
            const month = refDate.substring(0, 7);
            if (month !== filterPeriodo) return false;
          }
        }
      }

      // Status filter
      if (filterStatus !== "todos" && p.status !== filterStatus) return false;

      // Tipo filter
      if (filterTipo !== "todos" && p.origem_tipo !== filterTipo) return false;

      // Forma filter
      if (filterForma !== "todos") {
        const forma = (p.forma_pagamento ?? "").toLowerCase();
        if (!forma.includes(filterForma.toLowerCase())) return false;
      }

      // Text search
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        if (
          !p.descricao.toLowerCase().includes(q) &&
          !(p.observacoes ?? "").toLowerCase().includes(q) &&
          !(p.forma_pagamento ?? "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [payments, filterPeriodo, filterStatus, filterTipo, filterForma, searchText]);

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalDebito = filtered
      .filter((p) => p.status !== "reembolsado" && p.status !== "cancelado")
      .reduce((sum, p) => sum + p.valor, 0);
    const totalPago = filtered
      .filter((p) => p.status === "pago")
      .reduce((sum, p) => sum + p.valor, 0);
    const totalPendente = filtered
      .filter((p) => ["pendente", "aberto", "nao_iniciado", "parcialmente_pago"].includes(p.status))
      .reduce((sum, p) => sum + p.valor, 0);
    const totalAtrasado = filtered
      .filter((p) => p.status === "atrasado" || p.status === "vencido")
      .reduce((sum, p) => sum + p.valor, 0);
    const saldo = totalDebito - totalPago;
    return { totalDebito, totalPago, saldo, totalPendente, totalAtrasado };
  }, [filtered]);

  const clearFilters = () => {
    setSearchText("");
    setFilterForma("todos");
    setFilterPeriodo("ultimos3");
    setFilterStatus("todos");
    setFilterTipo("todos");
  };

  const hasActiveFilters =
    searchText || filterForma !== "todos" || filterPeriodo !== "ultimos3" ||
    filterStatus !== "todos" || filterTipo !== "todos";

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="py-12 text-center animate-pulse text-muted-foreground">Carregando histórico de pagamentos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Histórico de Pagamentos</h2>
        <p className="text-sm text-muted-foreground">{pacienteNome}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-red-100 bg-red-50/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-red-700 flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> Total Débito
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-red-700">{formatBRL(summary.totalDebito)}</p>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-green-50/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-green-700 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Total Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-green-700">{formatBRL(summary.totalPago)}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-100 bg-orange-50/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-orange-700 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-orange-700">{formatBRL(summary.saldo)}</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-100 bg-yellow-50/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-yellow-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Pendente
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-yellow-700">{formatBRL(summary.totalPendente)}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-100/50">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-red-800 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Atrasado
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-xl font-bold text-red-800">{formatBRL(summary.totalAtrasado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar descrição..."
                  className="pl-8"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>

            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultimos3">Últimos 3 meses</SelectItem>
                {periodOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aberto">Em Aberto</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="nao_iniciado">Não Pago</SelectItem>
                <SelectItem value="parcialmente_pago">Parcialmente Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="reembolsado">Reembolsado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                <SelectItem value="matricula">Matrícula</SelectItem>
                <SelectItem value="mensalidade">Mensalidade</SelectItem>
                <SelectItem value="plano">Plano / Pacote</SelectItem>
                <SelectItem value="sessao_avulsa">Sessão Avulsa</SelectItem>
                <SelectItem value="manual">Pagamento Manual</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Movimentações ({filtered.length} {filtered.length === 1 ? "registro" : "registros"})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {payments.length === 0
                ? "Nenhuma movimentação financeira encontrada para este paciente."
                : "Nenhum registro encontrado com os filtros aplicados."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Header row */}
              <div className="hidden md:grid grid-cols-[140px_1fr_80px_120px_110px_160px_32px] gap-2 px-4 py-2 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div>Data</div>
                <div>Descrição</div>
                <div>Tipo</div>
                <div>Forma Pgto</div>
                <div className="text-right">Valor</div>
                <div>Conciliação</div>
                <div></div>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filtered.map((p) => {
                  const dateStr = p.data_pagamento || p.data_vencimento || p.created_at;
                  const { tipo, cor } = getMovimentacaoTipo(p.valor, p.status);
                  const statusInfo = labelStatus[p.status] ?? { label: p.status, variant: "secondary" as const };

                  return (
                    <div
                      key={`${p.source_table}-${p.id}`}
                      className="grid grid-cols-1 md:grid-cols-[140px_1fr_80px_120px_110px_160px_32px] gap-2 px-4 py-3 items-center hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedPayment(p)}
                    >
                      {/* Data */}
                      <div className="text-sm">
                        <span className="md:hidden text-xs text-muted-foreground font-medium mr-1">Data:</span>
                        {dateStr
                          ? format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </div>

                      {/* Descrição */}
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium truncate">{p.descricao}</p>
                        <Badge variant={statusInfo.variant} className="text-[10px] h-4 px-1.5">
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Tipo */}
                      <div className={`text-sm font-medium ${cor} hidden md:block`}>{tipo}</div>

                      {/* Forma de Pagamento */}
                      <div className="text-sm text-muted-foreground hidden md:block truncate">
                        {p.forma_pagamento || "—"}
                      </div>

                      {/* Valor */}
                      <div className={`text-sm font-semibold text-right ${cor}`}>
                        <span className="md:hidden text-xs text-muted-foreground font-normal mr-1">Valor: </span>
                        {tipo === "Débito" ? "-" : "+"}{formatBRL(Math.abs(p.valor))}
                      </div>

                      {/* Conciliação */}
                      <div className="hidden md:flex">
                        <ReconciliationBadge
                          bankStatus={p.bank_status}
                          dataConciliacao={p.bank_data_conciliacao}
                        />
                      </div>

                      {/* Expand icon */}
                      <div className="hidden md:flex items-center justify-center text-muted-foreground">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
