import { supabase } from "@/integrations/supabase/client";

const QUERY_LIMIT = 5000;
const PENDING_PAYMENT_STATUSES = new Set(["pendente", "aberto", "nao_iniciado", "parcialmente_pago"]);

type PatientLookup = { nome: string; telefone: string | null };
type ProfessionalLookup = { nome: string };

function parseMonth(month: string): Date {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1);
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthRange(mesInicio: string, mesFim: string) {
  const start = parseMonth(mesInicio);
  const end = parseMonth(mesFim);
  const endExclusive = new Date(end.getFullYear(), end.getMonth() + 1, 1);

  return {
    startDate: formatDateOnly(start),
    endDateExclusive: formatDateOnly(endExclusive),
  };
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function isDateInRange(
  value: string | null | undefined,
  startDate: string,
  endDateExclusive: string,
): boolean {
  const dateOnly = toDateOnly(value);
  return !!dateOnly && dateOnly >= startDate && dateOnly < endDateExclusive;
}

function normalizePaymentStatus(status: string | null | undefined): string {
  const normalized = (status ?? "pendente").toLowerCase();
  return normalized === "aberto" ? "pendente" : normalized;
}

function isPendingStatus(status: string | null | undefined): boolean {
  return PENDING_PAYMENT_STATUSES.has(normalizePaymentStatus(status));
}

function getPaymentReferenceDate(payment: {
  status: string | null | undefined;
  data_pagamento: string | null | undefined;
  data_vencimento: string | null | undefined;
}): string | null {
  const normalizedStatus = normalizePaymentStatus(payment.status);
  if (normalizedStatus === "pago") {
    return payment.data_pagamento ?? payment.data_vencimento ?? null;
  }

  return payment.data_vencimento ?? payment.data_pagamento ?? null;
}

function buildMonthKeys(mesInicio: string, mesFim: string): string[] {
  const months: string[] = [];
  const cursor = parseMonth(mesInicio);
  const lastMonth = parseMonth(mesFim);

  while (cursor <= lastMonth) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

async function fetchPatientLookup(patientIds: string[]): Promise<Record<string, PatientLookup>> {
  if (!patientIds.length) return {};

  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome, telefone")
    .in("id", patientIds)
    .range(0, QUERY_LIMIT - 1);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((patient) => [patient.id, { nome: patient.nome, telefone: patient.telefone }]),
  );
}

async function fetchProfessionalLookup(professionalIds: string[]): Promise<Record<string, ProfessionalLookup>> {
  if (!professionalIds.length) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nome")
    .in("user_id", professionalIds)
    .range(0, QUERY_LIMIT - 1);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((professional) => [professional.user_id, { nome: professional.nome }]),
  );
}

async function fetchPaymentMethodLookup(paymentMethodIds: string[]): Promise<Record<string, string>> {
  if (!paymentMethodIds.length) return {};

  const { data, error } = await supabase
    .from("formas_pagamento")
    .select("id, nome")
    .in("id", paymentMethodIds)
    .range(0, QUERY_LIMIT - 1);

  if (error) throw error;

  return Object.fromEntries((data ?? []).map((method) => [method.id, method.nome]));
}

async function fetchAppointmentProfessionals(appointmentIds: string[]): Promise<Record<string, string>> {
  if (!appointmentIds.length) return {};

  const { data, error } = await supabase
    .from("agendamentos")
    .select("id, profissional_id")
    .in("id", appointmentIds)
    .range(0, QUERY_LIMIT - 1);

  if (error) throw error;

  return Object.fromEntries(
    (data ?? [])
      .filter((appointment) => !!appointment.profissional_id)
      .map((appointment) => [appointment.id, appointment.profissional_id]),
  );
}

// Tipagens para retornos das RPCs e Consultas
export interface RelatorioPorPaciente {
  paciente_id: string;
  paciente_nome: string;
  total_sessoes: number;
  sessoes_realizadas: number;
  sessoes_falta: number;
  taxa_faltas: number;
  total_pago: number;
  total_pendente: number;
  ultima_sessao: string | null;
}

export interface RelatorioPorProfissional {
  profissional_id: string;
  profissional_nome: string;
  total_sessoes: number;
  sessoes_realizadas: number;
  sessoes_falta?: number; // pode não vir no rpc, mas caso venha
  faturamento_total: number;
  faturamento_recebido: number;
  faturamento_pendente: number;
}

export interface RelatorioFaturamentoMensal {
  mes: string;
  receita_total: number;
  receita_paga: number;
  receita_pendente: number;
}

export interface RelatorioAgendamento {
  id: string;
  data_horario: string;
  tipo_atendimento: string;
  tipo_sessao: string | null;
  status: string;
  profissional_id: string;
  paciente_id: string;
  valor_sessao: number | null;
  pacientes: { nome: string; telefone: string | null } | null;
  profiles: { nome: string } | null;
}

export interface RelatorioPagamento {
  id: string;
  valor: number;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  paciente_id: string;
  profissional_id: string;
  data_vencimento: string | null;
  pacientes: { nome: string } | null;
  profiles: { nome: string } | null;
}

export interface RelatorioPaciente {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  tipo_atendimento: string;
  profissional_id: string;
  created_at: string;
}

export interface RelatorioProfissional {
  user_id: string;
  nome: string;
  especialidade: string | null;
  commission_rate: number | null;
}

async function getUnifiedPayments(
  mesInicio: string,
  mesFim: string,
  clinicId: string | null,
): Promise<RelatorioPagamento[]> {
  const { startDate, endDateExclusive } = getMonthRange(mesInicio, mesFim);

  let pagamentosQuery = supabase
    .from("pagamentos")
    .select("id, valor, data_pagamento, status, forma_pagamento, paciente_id, profissional_id, data_vencimento")
    .range(0, QUERY_LIMIT - 1);
  if (clinicId) pagamentosQuery = pagamentosQuery.eq("clinic_id", clinicId);

  let mensalidadesQuery = supabase
    .from("pagamentos_mensalidade")
    .select("id, valor, data_pagamento, status, forma_pagamento_id, paciente_id, data_vencimento, mes_referencia")
    .range(0, QUERY_LIMIT - 1);
  if (clinicId) mensalidadesQuery = mensalidadesQuery.eq("clinic_id", clinicId);

  let sessoesQuery = supabase
    .from("pagamentos_sessoes")
    .select("id, valor, data_pagamento, status, forma_pagamento_id, paciente_id, agendamento_id")
    .range(0, QUERY_LIMIT - 1);
  if (clinicId) sessoesQuery = sessoesQuery.eq("clinic_id", clinicId);

  const [pagamentosRes, mensalidadesRes, sessoesRes] = await Promise.all([
    pagamentosQuery,
    mensalidadesQuery,
    sessoesQuery,
  ]);

  if (pagamentosRes.error) throw pagamentosRes.error;
  if (mensalidadesRes.error) throw mensalidadesRes.error;
  if (sessoesRes.error) throw sessoesRes.error;

  const pagamentos = (pagamentosRes.data ?? []).filter((payment) =>
    isDateInRange(
      getPaymentReferenceDate({
        status: payment.status,
        data_pagamento: payment.data_pagamento,
        data_vencimento: payment.data_vencimento,
      }),
      startDate,
      endDateExclusive,
    ),
  );

  const mensalidades = (mensalidadesRes.data ?? []).filter((payment) => {
    const dueDate = payment.data_vencimento ?? payment.mes_referencia;
    return isDateInRange(
      getPaymentReferenceDate({
        status: payment.status,
        data_pagamento: payment.data_pagamento,
        data_vencimento: dueDate,
      }),
      startDate,
      endDateExclusive,
    );
  });

  const sessoes = (sessoesRes.data ?? []).filter((payment) =>
    isDateInRange(
      getPaymentReferenceDate({
        status: payment.status,
        data_pagamento: payment.data_pagamento,
        data_vencimento: payment.data_pagamento,
      }),
      startDate,
      endDateExclusive,
    ),
  );

  const patientIds = Array.from(
    new Set([
      ...pagamentos.map((payment) => payment.paciente_id),
      ...mensalidades.map((payment) => payment.paciente_id),
      ...sessoes.map((payment) => payment.paciente_id),
    ].filter(Boolean)),
  );

  const appointmentIds = Array.from(
    new Set(sessoes.map((payment) => payment.agendamento_id).filter(Boolean)),
  );

  const paymentMethodIds = Array.from(
    new Set([
      ...mensalidades.map((payment) => payment.forma_pagamento_id),
      ...sessoes.map((payment) => payment.forma_pagamento_id),
    ].filter(Boolean)),
  );

  const appointmentProfessionalMap = await fetchAppointmentProfessionals(appointmentIds);

  const professionalIds = Array.from(
    new Set([
      ...pagamentos.map((payment) => payment.profissional_id),
      ...Object.values(appointmentProfessionalMap),
    ].filter(Boolean)),
  );

  const [patientLookup, professionalLookup, paymentMethodLookup] = await Promise.all([
    fetchPatientLookup(patientIds),
    fetchProfessionalLookup(professionalIds),
    fetchPaymentMethodLookup(paymentMethodIds),
  ]);

  const unified: RelatorioPagamento[] = [];

  pagamentos.forEach((payment) => {
    unified.push({
      id: payment.id,
      valor: Number(payment.valor),
      data_pagamento: payment.data_pagamento,
      status: normalizePaymentStatus(payment.status),
      forma_pagamento: payment.forma_pagamento,
      paciente_id: payment.paciente_id,
      profissional_id: payment.profissional_id ?? "",
      data_vencimento: payment.data_vencimento,
      pacientes: patientLookup[payment.paciente_id]
        ? { nome: patientLookup[payment.paciente_id].nome }
        : null,
      profiles: payment.profissional_id && professionalLookup[payment.profissional_id]
        ? { nome: professionalLookup[payment.profissional_id].nome }
        : null,
    });
  });

  mensalidades.forEach((payment) => {
    unified.push({
      id: payment.id,
      valor: Number(payment.valor),
      data_pagamento: payment.data_pagamento,
      status: normalizePaymentStatus(payment.status),
      forma_pagamento: payment.forma_pagamento_id
        ? paymentMethodLookup[payment.forma_pagamento_id] ?? payment.forma_pagamento_id
        : null,
      paciente_id: payment.paciente_id,
      profissional_id: "",
      data_vencimento: payment.data_vencimento ?? payment.mes_referencia,
      pacientes: patientLookup[payment.paciente_id]
        ? { nome: patientLookup[payment.paciente_id].nome }
        : null,
      profiles: null,
    });
  });

  sessoes.forEach((payment) => {
    const professionalId = payment.agendamento_id
      ? appointmentProfessionalMap[payment.agendamento_id] ?? ""
      : "";

    unified.push({
      id: payment.id,
      valor: Number(payment.valor),
      data_pagamento: payment.data_pagamento,
      status: normalizePaymentStatus(payment.status),
      forma_pagamento: payment.forma_pagamento_id
        ? paymentMethodLookup[payment.forma_pagamento_id] ?? payment.forma_pagamento_id
        : null,
      paciente_id: payment.paciente_id,
      profissional_id: professionalId,
      data_vencimento: payment.status === "pago" ? null : payment.data_pagamento,
      pacientes: patientLookup[payment.paciente_id]
        ? { nome: patientLookup[payment.paciente_id].nome }
        : null,
      profiles: professionalId && professionalLookup[professionalId]
        ? { nome: professionalLookup[professionalId].nome }
        : null,
    });
  });

  return unified.sort((a, b) => {
    const left = getPaymentReferenceDate({
      status: b.status,
      data_pagamento: b.data_pagamento,
      data_vencimento: b.data_vencimento,
    }) ?? "";
    const right = getPaymentReferenceDate({
      status: a.status,
      data_pagamento: a.data_pagamento,
      data_vencimento: a.data_vencimento,
    }) ?? "";

    return left.localeCompare(right);
  });
}

export const reportService = {
  async getAgendamentos(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioAgendamento[]> {
    const { startDate, endDateExclusive } = getMonthRange(mesInicio, mesFim);

    let q = supabase.from("agendamentos")
      .select("id, data_horario, tipo_atendimento, tipo_sessao, status, profissional_id, paciente_id, valor_sessao")
      .gte("data_horario", `${startDate}T00:00:00`)
      .lt("data_horario", `${endDateExclusive}T00:00:00`)
      .order("data_horario", { ascending: true })
      .range(0, QUERY_LIMIT - 1);
    if (clinicId) q = q.eq("clinic_id", clinicId);

    const { data, error } = await q;
    if (error) throw error;

    const agendamentos = data || [];
    const patientIds = Array.from(new Set(agendamentos.map((item) => item.paciente_id).filter(Boolean)));
    const professionalIds = Array.from(new Set(agendamentos.map((item) => item.profissional_id).filter(Boolean)));

    const [patientLookup, professionalLookup] = await Promise.all([
      fetchPatientLookup(patientIds),
      fetchProfessionalLookup(professionalIds),
    ]);

    return agendamentos.map((item) => ({
      id: item.id,
      data_horario: item.data_horario,
      tipo_atendimento: item.tipo_atendimento,
      tipo_sessao: item.tipo_sessao,
      status: item.status,
      profissional_id: item.profissional_id,
      paciente_id: item.paciente_id,
      valor_sessao: item.valor_sessao,
      pacientes: patientLookup[item.paciente_id]
        ? {
            nome: patientLookup[item.paciente_id].nome,
            telefone: patientLookup[item.paciente_id].telefone,
          }
        : null,
      profiles: professionalLookup[item.profissional_id]
        ? { nome: professionalLookup[item.profissional_id].nome }
        : null,
    }));
  },

  async getPagamentos(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPagamento[]> {
    return getUnifiedPayments(mesInicio, mesFim, clinicId);
  },

  async getPacientes(clinicId: string | null): Promise<RelatorioPaciente[]> {
    if (clinicId) {
      const { data: cp } = await supabase.from("clinic_pacientes")
        .select("paciente_id").eq("clinic_id", clinicId);
      const ids = (cp || []).map(c => c.paciente_id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from("pacientes")
        .select("id, nome, telefone, status, tipo_atendimento, profissional_id, created_at")
        .in("id", ids).order("nome");
      if (error) throw error;
      return (data || []) as RelatorioPaciente[];
    }
    const { data, error } = await supabase.from("pacientes")
      .select("id, nome, telefone, status, tipo_atendimento, profissional_id, created_at").order("nome");
    if (error) throw error;
    return (data || []) as RelatorioPaciente[];
  },

  async getProfissionais(clinicId?: string | null): Promise<RelatorioProfissional[]> {
    let ids: string[] = [];

    if (clinicId) {
      const { data: clinicMembers, error } = await supabase
        .from("clinic_users")
        .select("user_id")
        .eq("clinic_id", clinicId)
        .range(0, QUERY_LIMIT - 1);

      if (error) throw error;
      ids = clinicMembers?.map((member) => member.user_id) ?? [];
    } else {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .range(0, QUERY_LIMIT - 1);

      if (error) throw error;
      ids = roles?.map((role) => role.user_id) ?? [];
    }

    if (!ids.length) return [];

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nome, especialidade, commission_rate")
      .in("user_id", ids)
      .order("nome");
    if (error) throw error;
    return (data || []) as RelatorioProfissional[];
  },

  async getRelatorioPorPaciente(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPorPaciente[]> {
    const { startDate, endDateExclusive } = getMonthRange(mesInicio, mesFim);
    
    const { data: results, error } = await (supabase as any).rpc("get_patient_reports_summary", {
      p_start_date: startDate,
      p_end_date: endDateExclusive,
      p_clinic_id: clinicId || undefined
    });
    
    if (error) {
      console.error("Error from get_patient_reports_summary:", error);
      throw error;
    }

    return (results || [])
      .map((row: any) => ({
        paciente_id: row.paciente_id,
        paciente_nome: row.paciente_nome,
        total_sessoes: Number(row.total_sessoes),
        sessoes_realizadas: Number(row.sessoes_realizadas),
        sessoes_falta: Number(row.sessoes_falta),
        taxa_faltas: Number(row.taxa_faltas),
        total_pago: Number(row.total_pago),
        total_pendente: Number(row.total_pendente),
        ultima_sessao: row.ultima_sessao,
      }))
      .filter((entry) =>
        entry.total_sessoes > 0 || entry.total_pago > 0 || entry.total_pendente > 0,
      )
      .sort((a, b) => a.paciente_nome.localeCompare(b.paciente_nome));
  },

  async getRelatorioPorProfissional(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPorProfissional[]> {
    const { startDate, endDateExclusive } = getMonthRange(mesInicio, mesFim);
    
    const { data: results, error } = await (supabase as any).rpc("get_professional_reports_summary", {
      p_start_date: startDate,
      p_end_date: endDateExclusive,
      p_clinic_id: clinicId || undefined
    });

    if (error) {
      console.error("Error from get_professional_reports_summary:", error);
      throw error;
    }

    return (results || [])
      .map((row: any) => ({
        profissional_id: row.profissional_id,
        profissional_nome: row.profissional_nome,
        total_sessoes: Number(row.total_sessoes),
        sessoes_realizadas: Number(row.sessoes_realizadas),
        sessoes_falta: Number(row.sessoes_falta),
        faturamento_total: Number(row.faturamento_total),
        faturamento_recebido: Number(row.faturamento_recebido),
        faturamento_pendente: Number(row.faturamento_pendente),
      }))
      .filter((entry) => entry.total_sessoes > 0 || entry.faturamento_total > 0)
      .sort((a, b) => a.profissional_nome.localeCompare(b.profissional_nome));
  },

  async getRelatorioFaturamentoMensal(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioFaturamentoMensal[]> {
    if (!clinicId) return [];

    const pagamentos = await getUnifiedPayments(mesInicio, mesFim, clinicId);
    const months = buildMonthKeys(mesInicio, mesFim);
    const grouped = new Map<string, RelatorioFaturamentoMensal>(
      months.map((month) => [
        month,
        {
          mes: month,
          receita_total: 0,
          receita_paga: 0,
          receita_pendente: 0,
        },
      ]),
    );

    pagamentos.forEach((payment) => {
      const referenceDate = getPaymentReferenceDate({
        status: payment.status,
        data_pagamento: payment.data_pagamento,
        data_vencimento: payment.data_vencimento,
      });

      if (!referenceDate) return;

      const monthKey = referenceDate.slice(0, 7);
      const entry = grouped.get(monthKey);
      if (!entry) return;

      const amount = Number(payment.valor);
      entry.receita_total += amount;

      if (payment.status === "pago") {
        entry.receita_paga += amount;
      } else if (isPendingStatus(payment.status)) {
        entry.receita_pendente += amount;
      }
    });

    return months.map((month) => grouped.get(month)!);
  }
};
