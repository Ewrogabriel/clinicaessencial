import { supabase } from "@/integrations/supabase/client";

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

export const reportService = {
  async getAgendamentos(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioAgendamento[]> {
    let q = supabase.from("agendamentos")
      .select("id, data_horario, tipo_atendimento, tipo_sessao, status, profissional_id, paciente_id, valor_sessao, pacientes(nome, telefone), profiles(nome)")
      .gte("data_horario", `${mesInicio}-01T00:00:00`)
      .lte("data_horario", `${mesFim}-31T23:59:59`)
      .order("data_horario", { ascending: true });
    if (clinicId) q = q.eq("clinic_id", clinicId);
    
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as RelatorioAgendamento[];
  },

  async getPagamentos(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPagamento[]> {
    let q = supabase.from("pagamentos")
      .select("id, valor, data_pagamento, status, forma_pagamento, paciente_id, profissional_id, data_vencimento, pacientes(nome), profiles(nome)")
      .gte("data_pagamento", `${mesInicio}-01`)
      .lte("data_pagamento", `${mesFim}-31`)
      .order("data_pagamento", { ascending: true });
    if (clinicId) q = q.eq("clinic_id", clinicId);
    
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as RelatorioPagamento[];
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

  async getProfissionais(): Promise<RelatorioProfissional[]> {
    const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
    const ids = roles?.map(r => r.user_id) ?? [];
    if (!ids.length) return [];
    const { data, error } = await supabase.from("profiles").select("user_id, nome, especialidade, commission_rate").in("user_id", ids).order("nome");
    if (error) throw error;
    return (data || []) as RelatorioProfissional[];
  },

  async getRelatorioPorPaciente(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPorPaciente[]> {
    if (!clinicId) return [];
    const { data, error } = await (supabase.rpc as any)("relatorio_por_paciente", {
      p_clinic_id: clinicId,
      p_data_inicio: `${mesInicio}-01`,
      p_data_fim: `${mesFim}-31`,
    });
    if (error) throw error;
    return (data || []) as RelatorioPorPaciente[];
  },

  async getRelatorioPorProfissional(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioPorProfissional[]> {
    if (!clinicId) return [];
    const { data, error } = await (supabase.rpc as any)("relatorio_por_profissional", {
      p_clinic_id: clinicId,
      p_data_inicio: `${mesInicio}-01`,
      p_data_fim: `${mesFim}-31`,
    });
    if (error) throw error;
    return (data || []) as RelatorioPorProfissional[];
  },

  async getRelatorioFaturamentoMensal(mesInicio: string, mesFim: string, clinicId: string | null): Promise<RelatorioFaturamentoMensal[]> {
    if (!clinicId) return [];
    const { data, error } = await (supabase.rpc as any)("relatorio_faturamento_mensal", {
      p_clinic_id: clinicId,
      p_data_inicio: `${mesInicio}-01`,
      p_data_fim: `${mesFim}-31`,
    });
    if (error) throw error;
    return (data || []) as RelatorioFaturamentoMensal[];
  }
};
