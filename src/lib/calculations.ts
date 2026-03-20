/**
 * Centralized business logic for sessions and commissions
 */

interface SessionData {
  enrollment_id?: string | null;
  valor_sessao?: number | string | null;
  observacoes?: string | null;
  tipo_atendimento?: string | null;
}

interface EnrollmentData {
  id: string;
  valor_mensal: number | string;
}

interface PlanData {
  id: string;
  valor: number | string;
  total_sessoes: number;
}

interface CommissionRule {
  profissional_id: string;
  tipo_atendimento: string;
  percentual?: number | string;
  valor_fixo?: number | string;
  ativo: boolean;
}

interface Professional {
  user_id: string;
  commission_rate?: number | string;
  commission_fixed?: number | string;
}

/**
 * Gets the applicable commission rule for a professional and a specific service type.
 * Unifies rules from 'regras_comissao' and fallbacks from the profile.
 */
export function getProfessionalCommissionRule(
  profId: string,
  tipoAtendimento: string,
  profProfile: any,
  allRules: any[]
) {
  const profRegras = allRules.filter((r: any) => r.profissional_id === profId && r.ativo);
  
  // Specific rule for the modality
  const specificRule = profRegras.find(
    (r: any) => r.tipo_atendimento?.toLowerCase() === tipoAtendimento?.toLowerCase()
  );

  // Fallback to "todos" (all) rule
  const genericRule = profRegras.find((r: any) => r.tipo_atendimento?.toLowerCase() === "todos");

  const rule = specificRule || genericRule;

  if (rule) {
    return {
      percentual: rule.percentual || 0,
      fixo: rule.valor_fixo || 0,
    };
  }

  // Final fallback to profile rates
  return {
    percentual: profProfile?.commission_rate || 0,
    fixo: profProfile?.commission_fixed || 0,
  };
}

/**
 * Counts how many scheduled sessions (including confirmed/realized) exist for an enrollment in a specific month.
 * Used for accurate "valor_sessao" calculation.
 */
export function countSessionsInMonth(
  enrollmentId: string,
  monthRef: string, // YYYY-MM
  allAgendamentos: any[]
) {
  return allAgendamentos.filter(a => 
    a.enrollment_id === enrollmentId && 
    a.data_horario.startsWith(monthRef) &&
    a.status !== 'cancelado'
  ).length;
}

/**
 * Calculates the value of a single session based on enrollment value and sessions in the month.
 */
export function calculateSessionValue(
  atendimento: any,
  matriculas: any[],
  agendamentos: any[],
  planos: any[] = []
): number {
  if (!atendimento) return 0;
  
  if (atendimento.valor_sessao && atendimento.valor_sessao > 0) {
    return atendimento.valor_sessao;
  }

  const matricula = matriculas.find((m) => m.id === atendimento.enrollment_id);
  if (matricula) {
    const monthRef = atendimento.data_horario.substring(0, 7);
    const sessoesNoMes = countSessionsInMonth(matricula.id, monthRef, agendamentos);
    
    if (sessoesNoMes > 0) {
      return parseFloat((matricula.valor_mensal / sessoesNoMes).toFixed(2));
    }
    return 0;
  }

  // Fallback for independent sessions or plans
  const plano = planos.find((p) => p.id === atendimento.plano_id);
  if (plano && plano.total_sessoes > 0) {
    return parseFloat((plano.valor / plano.total_sessoes).toFixed(2));
  }

  return 0;
}

/**
 * Calculates the commission for a session.
 */
export function calculateSessionCommission(
  valorSessao: number,
  tipoAtendimento: string,
  profProfile: any,
  regras: any[] = []
) {
  const rule = getProfessionalCommissionRule(
    profProfile?.user_id || "",
    tipoAtendimento,
    profProfile,
    regras
  );

  const commission = parseFloat(
    ((valorSessao * rule.percentual) / 100 + rule.fixo).toFixed(2)
  );

  return {
    percentual: rule.percentual,
    fixo: rule.fixo,
    commission,
  };
}
