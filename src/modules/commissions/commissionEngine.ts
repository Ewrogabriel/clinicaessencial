/**
 * CommissionEngine
 *
 * Motor de cálculo de comissão proporcional baseado em matrícula.
 *
 * Modelo:
 *   - A matrícula define o valor mensal e o número de sessões semanais
 *   - Cada sessão vale: monthly_value / total_sessoes_no_mes
 *   - O profissional recebe: session_value × commission_pct
 *   - Em falta do paciente: commission_pct × missed_session_pct
 *
 * Uso:
 *   await CommissionEngine.processSession({ agendamentoId, clinicId, supabase });
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────

export type SessionOutcome =
  | "realizado"    // sessão concluída → 100%
  | "falta"        // paciente faltou → usar missed_session_pct da política
  | "cancelado"    // cancelado com antecedência → 0%
  | "reagendado";  // será pago quando a nova sessão acontecer → 0% agora

export interface ProcessSessionParams {
  agendamentoId: string;
  clinicId: string;
  outcome: SessionOutcome;
  supabaseClient: SupabaseClient;
}

export interface SessionCommissionResult {
  commission_id: string | null;
  session_value: number;
  commission_value: number;
  commission_pct: number;
  missed_pct_applied: number;
  skipped: boolean;
  reason?: string;
}

// ─────────────────────────────────────────────
// Utilitários de cálculo
// ─────────────────────────────────────────────

/**
 * Conta quantas vezes um dia da semana ocorre em um mês, 
 * respeitando uma data mínima (início da matrícula).
 */
function countDayOccurrencesInMonth(
  year: number, 
  month: number, 
  dayOfWeek: number, 
  minDate?: Date
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === dayOfWeek) {
      if (!minDate || date >= minDate) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calcula o total de sessões de uma matrícula em um dado mês
 * respeitando a data de início da matrícula.
 */
export function calcTotalSessionsInMonth(
  weeklySchedules: { day_of_week: number }[],
  year: number,
  month: number,
  enrollmentStartDate?: string
): number {
  const minDate = enrollmentStartDate ? new Date(enrollmentStartDate) : undefined;
  
  return weeklySchedules.reduce((total, { day_of_week }) => {
    return total + countDayOccurrencesInMonth(year, month, day_of_week, minDate);
  }, 0);
}

export function calcSessionValue(monthlyValue: number, totalSessions: number): number {
  if (totalSessions === 0) return 0;
  return monthlyValue / totalSessions;
}

// ─────────────────────────────────────────────
// Helper: comissão para sessão sem matrícula (avulsa/plano)
// ─────────────────────────────────────────────

async function processStandaloneSession(
  sb: any,
  agendamento: any,
  clinicId: string,
  outcome: SessionOutcome
): Promise<SessionCommissionResult> {
  // Cancelado/reagendado → sem comissão
  if (outcome === "cancelado" || outcome === "reagendado") {
    await sb.from("commissions").delete().eq("agendamento_id", agendamento.id);
    return { commission_id: null, session_value: 0, commission_value: 0, commission_pct: 0, missed_pct_applied: 0, skipped: true, reason: "Sessão avulsa não-realizada" };
  }

  const { data: rules } = await sb
    .from("commission_rules")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("professional_id", agendamento.profissional_id)
    .eq("ativo", true);

  const rulesList = rules || [];
  const bestRule = rulesList.find((r: any) =>
    r.modalidade?.toLowerCase() === agendamento.tipo_atendimento?.toLowerCase()
  ) || rulesList.find((r: any) => !r.modalidade);

  const type = bestRule?.tipo_calculo || "percentual";
  const basePct = (bestRule?.percentage ?? 0) / 100;
  const valorFixo = Number(bestRule?.valor_fixo ?? 0);
  const sessionValue = Number(agendamento.valor_sessao ?? 0);
  const missedPct = outcome === "falta" ? (bestRule?.missed_session_pct ?? 0.5) : 1.0;

  const commissionValue = type === "fixo"
    ? valorFixo * missedPct
    : sessionValue * basePct * missedPct;

  const sessionDate = new Date(agendamento.data_horario);
  const mesReferencia = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}-01`;

  const payload: any = {
    clinic_id: clinicId,
    professional_id: agendamento.profissional_id,
    paciente_id: agendamento.paciente_id,
    agendamento_id: agendamento.id,
    session_value: sessionValue,
    commission_pct: type === "percentual" ? basePct * 100 : 0,
    valor_fixo_regra: type === "fixo" ? valorFixo : null,
    tipo_calculo: type,
    missed_pct_applied: missedPct,
    valor: commissionValue,
    mes_referencia: mesReferencia,
    status: "pendente",
    status_liberacao: "bloqueado",
  };

  const { data: existing } = await sb.from("commissions").select("id").eq("agendamento_id", agendamento.id).maybeSingle();
  let commissionId: string | null = null;
  if (existing?.id) {
    await sb.from("commissions").update(payload).eq("id", existing.id);
    commissionId = existing.id;
  } else {
    const { data: inserted } = await sb.from("commissions").insert(payload).select("id").single();
    commissionId = inserted?.id ?? null;
  }

  return {
    commission_id: commissionId,
    session_value: sessionValue,
    commission_value: commissionValue,
    commission_pct: type === "percentual" ? basePct * 100 : 0,
    missed_pct_applied: missedPct,
    skipped: false,
  };
}

// ─────────────────────────────────────────────
// Motor principal
// ─────────────────────────────────────────────

export const CommissionEngine = {
  async processSession({
    agendamentoId,
    clinicId,
    outcome,
    supabaseClient,
  }: ProcessSessionParams): Promise<SessionCommissionResult> {
    const sb = supabaseClient as any;

    // 1. Buscar dados do agendamento (com link de reposição)
    const { data: agendamento, error: agErr } = await sb
      .from("agendamentos")
      .select(`
        id,
        profissional_id,
        paciente_id,
        data_horario,
        tipo_atendimento,
        tipo_sessao,
        enrollment_id,
        replaces_agendamento_id,
        status
      `)
      .eq("id", agendamentoId)
      .single();

    if (agErr || !agendamento) {
      return { commission_id: null, session_value: 0, commission_value: 0, commission_pct: 0, missed_pct_applied: 0, skipped: true, reason: "Agendamento não encontrado" };
    }

    const enrollmentId = agendamento.enrollment_id;
    if (!enrollmentId) {
      // Sessão avulsa: calcular comissão simples sobre valor_sessao
      return await processStandaloneSession(sb, agendamento, clinicId, outcome);
    }

    // 2. Buscar Política e Configurações da Clínica
    const { data: policy } = await sb
      .from("cancellation_policies")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    // 3. Ajuste de Outcome: Cancelamento Tardio
    let effectiveOutcome = outcome;
    if (outcome === "cancelado") {
      const apptTime = new Date(agendamento.data_horario).getTime();
      const now = Date.now();
      const minHours = policy?.min_hours_before_cancel ?? 0;
      const hoursDiff = (apptTime - now) / (1000 * 60 * 60);

      if (hoursDiff < minHours) {
        // Se o cancelamento for tardio, vira "falta" para fins de comissão
        effectiveOutcome = "falta";
      } else {
        // Cancelamento normal → Remover comissão
        await sb.from("commissions").delete().eq("agendamento_id", agendamentoId);
        return { commission_id: null, session_value: 0, commission_value: 0, commission_pct: 0, missed_pct_applied: 0, skipped: true, reason: "Cancelamento dentro do prazo" };
      }
    }

    if (effectiveOutcome === "reagendado") {
      await sb.from("commissions").delete().eq("agendamento_id", agendamentoId);
      return { commission_id: null, session_value: 0, commission_value: 0, commission_pct: 0, missed_pct_applied: 0, skipped: true, reason: "Reagendado não gera comissão" };
    }

    // 4. Buscar dados da matrícula (incluindo data início)
    const { data: matricula } = await sb
      .from("matriculas")
      .select(`
        id,
        valor_mensal,
        data_inicio,
        weekly_schedules:matricula_schedules(day_of_week)
      `)
      .eq("id", enrollmentId)
      .single();

    if (!matricula) {
      return { commission_id: null, session_value: 0, commission_value: 0, commission_pct: 0, missed_pct_applied: 1, skipped: true, reason: "Matrícula não encontrada" };
    }

    // 5. Buscar regras de comissão
    const { data: rules } = await sb
      .from("commission_rules")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("professional_id", agendamento.profissional_id)
      .eq("ativo", true);

    const rulesList = rules || [];
    let bestRule = rulesList.find((r: any) =>
      r.modalidade?.toLowerCase() === agendamento.tipo_atendimento?.toLowerCase() &&
      r.tipo_sessao?.toLowerCase() === agendamento.tipo_sessao?.toLowerCase()
    ) || rulesList.find((r: any) =>
      r.modalidade?.toLowerCase() === agendamento.tipo_atendimento?.toLowerCase() && !r.tipo_sessao
    ) || rulesList.find((r: any) =>
      !r.modalidade && r.tipo_sessao?.toLowerCase() === agendamento.tipo_sessao?.toLowerCase()
    ) || rulesList.find((r: any) => !r.modalidade && !r.tipo_sessao);

    // 6. Definir MULTIPLICADORES
    const type = bestRule?.tipo_calculo || "percentual";
    const basePct = (bestRule?.percentage ?? 40) / 100;
    const valorFixo = Number(bestRule?.valor_fixo ?? 0);
    const missedPct = bestRule?.missed_session_pct ?? policy?.missed_session_pct ?? 0.5;

    // 7. Calcular VALOR DA SESSÃO (PROPORCIONAL AO INÍCIO)
    const sessionDate = new Date(agendamento.data_horario);
    const year = sessionDate.getFullYear();
    const month = sessionDate.getMonth();

    const totalSessions = calcTotalSessionsInMonth(
      matricula.weekly_schedules ?? [],
      year,
      month,
      matricula.data_inicio
    );

    const sessionValue = calcSessionValue(
      Number(matricula.valor_mensal ?? 0),
      totalSessions || 1
    );

    // 8. Lógica de Comissão Especial (Reposição)
    let finalMissedPct = effectiveOutcome === "falta" ? missedPct : 1.0;
    
    if (agendamento.status === "reposicao") {
      // Se era o mesmo profissional da falta, ele não ganha de novo
      if (agendamento.replaces_agendamento_id) {
        const { data: original } = await sb
          .from("agendamentos")
          .select("profissional_id")
          .eq("id", agendamento.replaces_agendamento_id)
          .single();

        if (original?.profissional_id === agendamento.profissional_id) {
          finalMissedPct = 0; // Já recebeu na falta
        } else {
          // Profissional trocou → O novo ganha, e o original (da falta) perde.
          await sb.from("commissions").delete().eq("agendamento_id", agendamento.replaces_agendamento_id);
          finalMissedPct = 1.0; // Novo profissional ganha 100%
        }
      } else {
        // Se não linkou, por segurança paga zero (ou conforme regra de reposição)
        finalMissedPct = 0;
      }
    }

    // 9. Calcular VALOR FINAL
    let commissionValue = (type === "fixo") 
      ? valorFixo * finalMissedPct 
      : sessionValue * basePct * finalMissedPct;

    const mesReferencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // 10. Checar Vínculo com Pagamento (Mensalidade ou Geral)
    let pgto = null;
    let paymentTable = "pagamentos_mensalidade";

    const { data: pgtoMensalidade } = await sb
      .from("pagamentos_mensalidade")
      .select("id, status")
      .eq("matricula_id", enrollmentId)
      .eq("mes_referencia", mesReferencia)
      .maybeSingle();

    if (pgtoMensalidade) {
      pgto = pgtoMensalidade;
    } else {
      // Se não for mensalidade, busca na tabela de pagamentos geral (sessões avulsas/planos)
      const { data: pgtoGeral } = await sb
        .from("pagamentos")
        .select("id, status")
        .eq("agendamento_id", agendamentoId)
        .maybeSingle();
      
      if (pgtoGeral) {
        pgto = pgtoGeral;
        paymentTable = "pagamentos";
      }
    }

    // Regra: Liberado somente se Pago E Agendamento Realizado/Falta (terminal)
    const isSessionDone = agendamento.status === "realizado" || agendamento.status === "falta";
    const statusLiberacao = (pgto?.status === "pago" && isSessionDone) ? "liberado" : "bloqueado";

    // 11. Upsert na tabela commissions
    const payload = {
      clinic_id: clinicId,
      profissional_id: agendamento.profissional_id,
      paciente_id: agendamento.paciente_id,
      agendamento_id: agendamentoId,
      enrollment_id: enrollmentId,
      session_value: sessionValue,
      commission_pct: type === "percentual" ? basePct * 100 : 0,
      valor_fixo_regra: type === "fixo" ? valorFixo : null,
      tipo_calculo: type,
      missed_pct_applied: finalMissedPct,
      valor: commissionValue,
      mes_referencia: mesReferencia,
      status: "pendente",
      payment_id: pgto?.id,
      status_liberacao: statusLiberacao
    };

    const { data: existing } = await sb.from("commissions").select("id").eq("agendamento_id", agendamentoId).maybeSingle();

    let commissionId: string | null = null;
    if (existing?.id) {
      await sb.from("commissions").update(payload).eq("id", existing.id);
      commissionId = existing.id;
    } else {
      const { data: inserted } = await sb.from("commissions").insert(payload).select("id").single();
      commissionId = inserted?.id ?? null;
    }

    return {
      commission_id: commissionId,
      session_value: sessionValue,
      commission_value: commissionValue,
      commission_pct: type === "percentual" ? basePct * 100 : 0,
      missed_pct_applied: finalMissedPct,
      skipped: false,
    };
  },

  async getMonthSummary(clinicId: string, mesReferencia: string, supabaseClient: SupabaseClient) {
    const sb = supabaseClient as any;
    const { data, error } = await sb
      .from("commissions")
      .select(`
        profissional_id,
        valor,
        session_value,
        status,
        status_liberacao,
        profiles:profissional_id(nome_completo)
      `)
      .eq("clinic_id", clinicId)
      .eq("mes_referencia", mesReferencia);

    if (error) throw error;

    const summary: Record<string, { nome: string; total: number; sessions: number; pendente: boolean; bloqueado: boolean }> = {};
    for (const c of data || []) {
      const pid = c.profissional_id;
      if (!summary[pid]) {
        summary[pid] = {
          nome: c.profiles?.nome_completo ?? pid,
          total: 0,
          sessions: 0,
          pendente: false,
          bloqueado: false,
        };
      }
      summary[pid].total += Number(c.valor ?? 0);
      summary[pid].sessions += 1;
      if (c.status === "pendente") summary[pid].pendente = true;
      if (c.status_liberacao === "bloqueado") summary[pid].bloqueado = true;
    }

    return Object.entries(summary).map(([id, data]) => ({ id, ...data }));
  },

  /**
   * Libera comissões bloqueadas quando o pagamento é confirmado.
   * Deve ser chamado após marcar um pagamento_mensalidade como 'pago'.
   */
  async releaseCommissionsByPayment(paymentId: string) {
    if (!paymentId) return;

    // Busca quais comissões estão ligadas a este pagamento
    const { data: comms } = await (supabase
      .from("commissions") as any)
      .select("id, agendamento_id")
      .eq("payment_id", paymentId);

    if (!comms || comms.length === 0) return;

    // Para cada comissão, verifica se o agendamento já está "realizado" ou "falta"
    for (const comm of comms) {
      const { data: agend } = await supabase
        .from("agendamentos")
        .select("status")
        .eq("id", comm.agendamento_id)
        .single();

      if (agend?.status === "realizado" || agend?.status === "falta") {
        await (supabase
          .from("commissions") as any)
          .update({ status_liberacao: "liberado" })
          .eq("id", comm.id);
      }
    }
  },
};
