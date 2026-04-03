import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentEntry } from "./types";

function resolveStatus(
  status: string,
  dataVencimento: string | null,
  now: Date
): { status: string; dias_atraso?: number } {
  if ((status === "pendente" || status === "aberto") && dataVencimento) {
    const venc = new Date(dataVencimento);
    if (venc < now) {
      const dias = differenceInDays(now, venc);
      return { status: "atrasado", dias_atraso: dias };
    }
  }
  return { status };
}

export function usePatientPayments(pacienteId: string) {
  return useQuery<PaymentEntry[]>({
    queryKey: ["patient-payment-history", pacienteId],
    queryFn: async () => {
      const results: PaymentEntry[] = [];
      const now = new Date();

      // 1. pagamentos (includes sessao_avulsa, matricula, plano, manual)
      const { data: pgtos } = await supabase
        .from("pagamentos")
        .select(
          "id, valor, data_pagamento, data_vencimento, status, forma_pagamento, descricao, observacoes, created_at, origem_tipo, agendamento_id, profissional_id, matricula_id, plano_id"
        )
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      // Bank reconciliation map (no longer stored on pagamentos table)
      const bankMap: Record<string, { status: string; data_conciliacao: string | null }> = {};

      // Fetch profissional names for sessions
      const profissionalIds: string[] = [];
      (pgtos || []).forEach((p: any) => {
        if (
          p.profissional_id &&
          (p.origem_tipo === "sessao_avulsa" || p.origem_tipo === "plano")
        ) {
          if (!profissionalIds.includes(p.profissional_id))
            profissionalIds.push(p.profissional_id);
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
        const bt = null;
        const { status, dias_atraso } = resolveStatus(
          p.status ?? "pendente",
          p.data_vencimento,
          now
        );
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
        .select(
          "id, valor, data_pagamento, data_vencimento, status, forma_pagamento_id, mes_referencia, observacoes, created_at"
        )
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      (mensalidades || []).forEach((m: any) => {
        const mesRef = m.mes_referencia
          ? format(new Date(m.mes_referencia), "MM/yyyy", { locale: ptBR })
          : null;
        const { status, dias_atraso } = resolveStatus(
          m.status ?? "aberto",
          m.data_vencimento ?? m.mes_referencia,
          now
        );
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
        .select(
          "id, valor, data_pagamento, status, observacoes, created_at, forma_pagamento_id"
        )
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false });

      (sessoes || []).forEach((s: any) => {
        const { status, dias_atraso } = resolveStatus(s.status ?? "aberto", null, now);
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

      const paidMatriculaFromPgtos = new Set(
        (pgtos || [])
          .filter((p: any) => p.origem_tipo === "matricula" && p.matricula_id)
          .map((p: any) => p.matricula_id)
      );
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
        if (paidMatriculaRefIds.has(m.id)) return;
        const { status, dias_atraso } = resolveStatus("pendente", m.data_vencimento, now);
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
        .select(
          "id, tipo_atendimento, total_sessoes, sessoes_utilizadas, valor, status, data_inicio, data_vencimento, created_at, profissional_id"
        )
        .eq("paciente_id", pacienteId)
        .eq("status", "ativo");

      const paidPlanoIds = new Set(
        (pgtos || [])
          .filter((p: any) => p.origem_tipo === "plano" && p.plano_id)
          .map((p: any) => p.plano_id)
      );

      (planos || []).forEach((pl: any) => {
        if (paidPlanoIds.has(pl.id)) return;
        const { status, dias_atraso } = resolveStatus("pendente", pl.data_vencimento, now);
        const effectiveStatus = status === "atrasado" ? "atrasado" : "nao_iniciado";
        const sessoesPendentes = (pl.total_sessoes || 0) - (pl.sessoes_utilizadas || 0);
        results.push({
          id: pl.id,
          source_table: "planos",
          data_pagamento: null,
          data_vencimento: pl.data_vencimento,
          descricao:
            `Plano ${pl.tipo_atendimento || ""} (${pl.sessoes_utilizadas}/${pl.total_sessoes} sessões)`.trim(),
          status: effectiveStatus,
          dias_atraso,
          forma_pagamento: null,
          valor: Number(pl.valor),
          origem_tipo: "plano",
          observacoes:
            sessoesPendentes > 0 ? `${sessoesPendentes} sessão(ões) restante(s)` : null,
          bank_transaction_id: null,
          bank_status: null,
          bank_data_conciliacao: null,
          created_at: pl.created_at ?? "",
          profissional: pl.profissional_id
            ? (profissionalMap[pl.profissional_id] ?? null)
            : null,
        });
      });

      // 6. Sessões avulsas realizadas sem pagamento
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

      const unpaidSessaoIds: string[] = [];
      (agendamentosRealizados || []).forEach((ag: any) => {
        if (!paidAgendamentoIds.has(ag.id)) {
          if (ag.profissional_id && !profissionalIds.includes(ag.profissional_id)) {
            profissionalIds.push(ag.profissional_id);
            unpaidSessaoIds.push(ag.profissional_id);
          }
        }
      });

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
        if (paidAgendamentoIds.has(ag.id)) return;
        const dataSessao = new Date(ag.data_horario);
        const isAtrasado = dataSessao < now;
        const dias_atraso = isAtrasado ? differenceInDays(now, dataSessao) : undefined;
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
          profissional: ag.profissional_id
            ? (profissionalMap[ag.profissional_id] ?? null)
            : null,
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
}
