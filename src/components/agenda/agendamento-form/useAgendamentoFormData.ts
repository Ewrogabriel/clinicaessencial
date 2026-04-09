import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Paciente, Profissional, Modalidade, FormaPagamento, PlanoItem } from "./types";

export function useAgendamentoFormData(open: boolean, fetchPlanos: boolean, clinicId: string | null) {

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [planos, setPlanos] = useState<PlanoItem[]>([]);

  useEffect(() => {
    if (!open || !clinicId) return;

    const loadPacientes = async () => {
      const { data } = await (supabase.from("pacientes") as any)
        .select("id, nome, cpf")
        .eq("clinic_id", clinicId)
        .eq("status", "ativo")
        .order("nome");
      setPacientes((data ?? []) as Paciente[]);
    };

    const loadProfissionais = async () => {
      // 1. Fetch user IDs assigned to this clinic
      const { data: clinicAssigned } = await supabase
        .from("clinic_users")
        .select("user_id")
        .eq("clinic_id", clinicId);
      
      const assignedIds = (clinicAssigned || []).map(ca => ca.user_id);
      if (!assignedIds.length) { setProfissionais([]); return; }

      // 2. Fetch profiles for assigned users who are professionals or admins
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", assignedIds)
        .in("role", ["profissional", "admin"]);
      
      const filteredIds = (roles || []).map(r => r.user_id);
      if (!filteredIds.length) { setProfissionais([]); return; }

      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, nome")
        .in("user_id", filteredIds)
        .order("nome");
        
      setProfissionais((data ?? []) as Profissional[]);
    };

    const loadModalidades = async () => {
      // Modalidades are usually shared or clinic-specific
      const { data } = await supabase.from("modalidades")
        .select("id, nome")
        .eq("ativo", true)
        .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
        .order("nome");
      setModalidades(data ?? []);
    };


    const loadFormasPagamento = async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      setFormasPagamento(data ?? []);
    };

    const loadPlanos = async () => {
      const { data: planosData } = await (supabase
        .from("planos") as any)
        .select("id, paciente_id, profissional_id, tipo_atendimento, total_sessoes, sessoes_utilizadas")
        .eq("clinic_id", clinicId)
        .eq("status", "ativo");
      if (!planosData) { setPlanos([]); return; }

      const pacienteIds = [...new Set(planosData.map(p => p.paciente_id))];
      const { data: pacientesData } = await supabase.from("pacientes").select("id, nome").in("id", pacienteIds);
      const pacienteMap: Record<string, string> = {};
      (pacientesData ?? []).forEach(p => { pacienteMap[p.id] = p.nome; });

      setPlanos(planosData.map(p => ({ ...p, paciente_nome: pacienteMap[p.paciente_id] ?? p.paciente_id })));
    };

    loadPacientes();
    loadProfissionais();
    loadModalidades();
    loadFormasPagamento();
    if (fetchPlanos) loadPlanos();
  }, [open, fetchPlanos, clinicId]);

  return { pacientes, profissionais, modalidades, formasPagamento, planos };
}
