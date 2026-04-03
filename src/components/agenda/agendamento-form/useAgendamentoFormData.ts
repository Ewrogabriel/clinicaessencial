import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Paciente, Profissional, Modalidade, FormaPagamento, PlanoItem } from "./types";

export function useAgendamentoFormData(open: boolean, fetchPlanos: boolean) {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [planos, setPlanos] = useState<PlanoItem[]>([]);

  useEffect(() => {
    if (!open) return;

    const loadPacientes = async () => {
      const { data } = await supabase.from("pacientes")
        .select("id, nome, cpf")
        .eq("status", "ativo")
        .order("nome");
      setPacientes((data ?? []) as Paciente[]);
    };

    const loadProfissionais = async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["profissional", "admin"]);
      const ids = (roles || []).map(r => r.user_id);
      if (!ids.length) { setProfissionais([]); return; }
      const { data } = await supabase.from("profiles").select("id, user_id, nome").in("user_id", ids).order("nome");
      setProfissionais((data ?? []) as Profissional[]);
    };

    const loadModalidades = async () => {
      const { data } = await supabase.from("modalidades").select("id, nome").eq("ativo", true).order("nome");
      setModalidades(data ?? []);
    };

    const loadFormasPagamento = async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      setFormasPagamento(data ?? []);
    };

    const loadPlanos = async () => {
      const { data: planosData } = await supabase
        .from("planos")
        .select("id, paciente_id, profissional_id, tipo_atendimento, total_sessoes, sessoes_utilizadas")
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
  }, [open, fetchPlanos]);

  return { pacientes, profissionais, modalidades, formasPagamento, planos };
}
