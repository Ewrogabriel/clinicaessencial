import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";

export interface MonthlyTrend {
  mes: string;
  receita: number;
  sessoes: number;
  realizadas: number;
  faltas: number;
  canceladas: number;
}

export interface OccupancyHeatmap {
  dia: number;
  hora: string;
  count: number;
}

export function useProfessionalAnalytics() {
  const { user } = useAuth();
  const userId = user?.id;
  const hoje = new Date();
  const mesAtual = startOfMonth(hoje);
  const mesAnterior = startOfMonth(subMonths(hoje, 1));

  // KPIs avançados
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["prof-advanced-kpis", userId],
    queryFn: async () => {
      const mesIni = format(mesAtual, "yyyy-MM-dd");
      const mesFim = format(endOfMonth(hoje), "yyyy-MM-dd");
      const mesAntIni = format(mesAnterior, "yyyy-MM-dd");
      const mesAntFim = format(endOfMonth(mesAnterior), "yyyy-MM-dd");

      // Sessões mês atual
      const { data: sessAtual } = await supabase.from("agendamentos")
        .select("id, status, valor_sessao, duracao_minutos")
        .eq("profissional_id", userId!)
        .gte("data_horario", `${mesIni}T00:00:00`)
        .lte("data_horario", `${mesFim}T23:59:59`);

      // Sessões mês anterior
      const { data: sessAnterior } = await supabase.from("agendamentos")
        .select("id, status")
        .eq("profissional_id", userId!)
        .gte("data_horario", `${mesAntIni}T00:00:00`)
        .lte("data_horario", `${mesAntFim}T23:59:59`);

      // Comissão atual
      const { data: comAtual } = await supabase.from("commissions")
        .select("valor")
        .eq("professional_id", userId!)
        .gte("created_at", `${mesIni}T00:00:00`)
        .lte("created_at", `${mesFim}T23:59:59`);

      // Comissão anterior
      const { data: comAnterior } = await supabase.from("commissions")
        .select("valor")
        .eq("professional_id", userId!)
        .gte("created_at", `${mesAntIni}T00:00:00`)
        .lte("created_at", `${mesAntFim}T23:59:59`);

      // Pacientes ativos
      const { count: pacientesAtivos } = await supabase.from("matriculas")
        .select("paciente_id", { count: "exact", head: true })
        .eq("profissional_id", userId!)
        .eq("status", "ativa");

      // Pacientes únicos do mês
      const { data: pacUnicos } = await supabase.from("agendamentos")
        .select("paciente_id")
        .eq("profissional_id", userId!)
        .gte("data_horario", `${mesIni}T00:00:00`)
        .lte("data_horario", `${mesFim}T23:59:59`);

      const all = sessAtual || [];
      const allAnt = sessAnterior || [];
      const realizadas = all.filter(a => a.status === "realizado").length;
      const faltas = all.filter(a => a.status === "falta").length;
      const canceladas = all.filter(a => a.status === "cancelado").length;
      const realizadasAnt = allAnt.filter(a => a.status === "realizado").length;
      const faltasAnt = allAnt.filter(a => a.status === "falta").length;

      const receitaAtual = (comAtual || []).reduce((s, c) => s + Number(c.valor), 0);
      const receitaAnterior = (comAnterior || []).reduce((s, c) => s + Number(c.valor), 0);
      const crescimentoReceita = receitaAnterior > 0
        ? Math.round(((receitaAtual - receitaAnterior) / receitaAnterior) * 100)
        : receitaAtual > 0 ? 100 : 0;

      const horasTrabalhadas = all
        .filter(a => a.status === "realizado")
        .reduce((s, a) => s + (a.duracao_minutos || 50), 0) / 60;

      const ticketMedio = realizadas > 0
        ? all.filter(a => a.status === "realizado" && a.valor_sessao)
            .reduce((s, a) => s + Number(a.valor_sessao || 0), 0) / realizadas
        : 0;

      const taxaPresenca = all.length > 0 ? Math.round((realizadas / all.length) * 100) : 0;
      const taxaFalta = all.length > 0 ? Math.round((faltas / all.length) * 100) : 0;
      const taxaFaltaAnt = allAnt.length > 0 ? Math.round((faltasAnt / allAnt.length) * 100) : 0;

      const uniquePatients = new Set((pacUnicos || []).map(p => p.paciente_id)).size;

      return {
        pacientesAtivos: pacientesAtivos ?? 0,
        pacientesUnicos: uniquePatients,
        sessoesTotal: all.length,
        realizadas,
        faltas,
        canceladas,
        sessoesTotalAnt: allAnt.length,
        realizadasAnt,
        receitaAtual,
        receitaAnterior,
        crescimentoReceita,
        horasTrabalhadas: Math.round(horasTrabalhadas * 10) / 10,
        ticketMedio: Math.round(ticketMedio * 100) / 100,
        taxaPresenca,
        taxaFalta,
        taxaFaltaAnt,
      };
    },
    enabled: !!userId,
  });

  // Tendências 6 meses
  const { data: trends = [] } = useQuery({
    queryKey: ["prof-trends-6m", userId],
    queryFn: async () => {
      const results: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const start = format(d, "yyyy-MM-dd");
        const endStr = format(end, "yyyy-MM-dd");

        const [{ data: sess }, { data: com }] = await Promise.all([
          supabase.from("agendamentos")
            .select("status")
            .eq("profissional_id", userId!)
            .gte("data_horario", `${start}T00:00:00`)
            .lte("data_horario", `${endStr}T23:59:59`),
          supabase.from("commissions")
            .select("valor")
            .eq("professional_id", userId!)
            .gte("created_at", `${start}T00:00:00`)
            .lte("created_at", `${endStr}T23:59:59`),
        ]);

        const all = sess || [];
        results.push({
          mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          receita: (com || []).reduce((s, c) => s + Number(c.valor), 0),
          sessoes: all.length,
          realizadas: all.filter(a => a.status === "realizado").length,
          faltas: all.filter(a => a.status === "falta").length,
          canceladas: all.filter(a => a.status === "cancelado").length,
        });
      }
      return results;
    },
    enabled: !!userId,
  });

  // Heatmap de ocupação semanal
  const { data: heatmap = [] } = useQuery({
    queryKey: ["prof-heatmap", userId],
    queryFn: async () => {
      const ini = format(subMonths(hoje, 1), "yyyy-MM-dd");
      const fim = format(hoje, "yyyy-MM-dd");
      const { data } = await supabase.from("agendamentos")
        .select("data_horario")
        .eq("profissional_id", userId!)
        .gte("data_horario", `${ini}T00:00:00`)
        .lte("data_horario", `${fim}T23:59:59`)
        .in("status", ["agendado", "confirmado", "realizado"]);

      const map: Record<string, number> = {};
      (data || []).forEach(a => {
        const dt = new Date(a.data_horario);
        const key = `${dt.getDay()}-${dt.getHours()}`;
        map[key] = (map[key] || 0) + 1;
      });

      const result: OccupancyHeatmap[] = [];
      for (let dia = 1; dia <= 6; dia++) {
        for (let h = 7; h <= 20; h++) {
          result.push({ dia, hora: `${h}:00`, count: map[`${dia}-${h}`] || 0 });
        }
      }
      return result;
    },
    enabled: !!userId,
  });

  // Agenda de hoje
  const { data: todayAgenda = [] } = useQuery({
    queryKey: ["prof-today-agenda", userId],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const { data } = await supabase.from("agendamentos")
        .select("*, pacientes(nome)")
        .eq("profissional_id", userId!)
        .gte("data_horario", todayStart)
        .lte("data_horario", todayEnd)
        .order("data_horario", { ascending: true });
      return data || [];
    },
    enabled: !!userId,
  });

  return { kpis, kpisLoading, trends, heatmap, todayAgenda };
}
