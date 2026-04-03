import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePatientDashboardData(userId: string | undefined, pacienteId: string | undefined, activeClinicId: string | null) {
  const paciente = useQuery({
    queryKey: ["paciente-by-user", userId],
    queryFn: async () => {
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").eq("user_id", userId!).maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const nextAppointments = useQuery({
    queryKey: ["patient-next-appointments", pacienteId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("agendamentos").select("id, data_horario, tipo_atendimento, status")
        .eq("paciente_id", pacienteId!).gte("data_horario", now).in("status", ["agendado", "confirmado"]).order("data_horario").limit(5);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const planosExercicios = useQuery({
    queryKey: ["planos-exercicios", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("planos_exercicios" as never).select("id, nome, descricao, ativo")
        .eq("paciente_id", pacienteId!).eq("ativo", true).limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!pacienteId,
  });

  const meusPlanosServico = useQuery({
    queryKey: ["meus-planos-servico", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("planos" as never).select("id, nome, sessoes_contratadas, sessoes_utilizadas, status")
        .eq("paciente_id", pacienteId!).eq("status", "ativo").limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!pacienteId,
  });

  const pendingPayments = useQuery({
    queryKey: ["patient-pending-payments", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos").select("id, valor, data_vencimento, descricao")
        .eq("paciente_id", pacienteId!).eq("status", "pendente").order("data_vencimento").limit(5);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const mensagens = useQuery({
    queryKey: ["mensagens-recentes", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("mensagens" as never).select("id, assunto, created_at, lida")
        .eq("destinatario_id", userId!).order("created_at", { ascending: false }).limit(5);
      return (data as Record<string, unknown>[]) || [];
    },
    enabled: !!pacienteId && !!userId,
  });

  const contratos = useQuery({
    queryKey: ["contratos-paciente", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("contratos_digitais").select("id, titulo, created_at")
        .eq("paciente_id", pacienteId!).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const pastSessions = useQuery({
    queryKey: ["patient-past-sessions", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("agendamentos").select("id, data_horario, tipo_atendimento, status, duracao_minutos")
        .eq("paciente_id", pacienteId!).in("status", ["realizado", "falta", "cancelado"]).order("data_horario", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const matriculasAtivas = useQuery({
    queryKey: ["patient-matriculas", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("matriculas").select("id, modalidade_id, status, data_inicio, data_fim, dias_semana, horario")
        .eq("paciente_id", pacienteId!).eq("status", "ativa").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const convenios = useQuery({
    queryKey: ["convenios-ativos", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase.from("convenios").select("id, nome").eq("ativo", true).limit(5);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const rewardsAvailable = useQuery({
    queryKey: ["rewards-catalog-active"],
    queryFn: async () => {
      const { data } = await supabase.from("rewards_catalog").select("*").eq("ativo", true).order("pontos_necessarios");
      return data || [];
    },
  });

  const avisos = useQuery({
    queryKey: ["avisos-ativos", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase.from("avisos").select("*").eq("ativo", true).eq("clinic_id", activeClinicId!).order("created_at", { ascending: false }).limit(3);
      return data || [];
    },
    enabled: !!activeClinicId,
  });

  const clinicSettings = useQuery({
    queryKey: ["clinic-settings", activeClinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinicas").select("*").eq("id", activeClinicId!).maybeSingle();
      return data;
    },
    enabled: !!activeClinicId,
  });

  const feriados = useQuery({
    queryKey: ["feriados-proximos"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      const { data } = await supabase.from("feriados").select("*").gte("data", today).lte("data", in30Days.toISOString().split("T")[0]).order("data");
      return data || [];
    },
  });

  const totalPoints = useQuery({
    queryKey: ["patient-total-points", pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from("patient_points").select("pontos").eq("paciente_id", pacienteId!);
      return (data || []).reduce((sum, p) => sum + (p.pontos || 0), 0);
    },
    enabled: !!pacienteId,
  });

  return {
    paciente: paciente.data,
    nextAppointments: nextAppointments.data || [],
    planosExercicios: planosExercicios.data || [],
    meusPlanosServico: meusPlanosServico.data || [],
    pendingPayments: pendingPayments.data || [],
    mensagens: mensagens.data || [],
    contratos: contratos.data || [],
    pastSessions: pastSessions.data || [],
    matriculasAtivas: matriculasAtivas.data || [],
    convenios: convenios.data || [],
    rewardsAvailable: rewardsAvailable.data || [],
    avisos: avisos.data || [],
    clinicSettings: clinicSettings.data,
    feriados: feriados.data || [],
    totalPoints: totalPoints.data || 0,
  };
}
