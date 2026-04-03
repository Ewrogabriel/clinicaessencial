import { supabase } from "@/integrations/supabase/client";

export type LeaderboardPeriod = "week" | "month" | "all";

const getLevel = (points: number) => {
  if (points >= 500) return { name: "Diamante", threshold: 500, next: null };
  if (points >= 300) return { name: "Ouro", threshold: 300, next: 500 };
  if (points >= 150) return { name: "Prata", threshold: 150, next: 300 };
  if (points >= 50) return { name: "Bronze", threshold: 50, next: 150 };
  return { name: "Iniciante", threshold: 0, next: 50 };
};

async function getLeaderboard(clinicId: string, period: LeaderboardPeriod) {
  const query = (supabase as any).from("gamification_pontos")
    .select("paciente_id, pontos, pacientes(nome)")
    .eq("clinica_id", clinicId);

  if (period === "week") {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    query.gte("created_at", since.toISOString());
  } else if (period === "month") {
    const since = new Date();
    since.setMonth(since.getMonth() - 1);
    query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const totals = new Map<string, { paciente_id: string; nome: string; total_pontos: number }>();
  for (const row of data || []) {
    const id = row.paciente_id;
    const existing = totals.get(id);
    const nome = row.pacientes?.nome ?? "—";
    totals.set(id, {
      paciente_id: id,
      nome,
      total_pontos: (existing?.total_pontos ?? 0) + (row.pontos ?? 0),
    });
  }

  return Array.from(totals.values())
    .sort((a, b) => b.total_pontos - a.total_pontos)
    .slice(0, 10);
}

async function getPlayerAchievements(patientId: string) {
  const { data, error } = await (supabase as any).from("gamification_conquistas")
    .select("*")
    .eq("paciente_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function getChallenges(clinicId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await (supabase.from("gamification_desafios") as any)
    .select("*")
    .eq("clinica_id", clinicId)
    .eq("ativo", true)
    .lte("data_inicio", today)
    .gte("data_fim", today)
    .order("data_fim", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function getRewardsCatalog(clinicId: string) {
  const { data, error } = await (supabase.from("gamification_recompensas") as any)
    .select("*")
    .eq("clinica_id", clinicId)
    .eq("ativo", true)
    .order("custo_pontos", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function redeemReward(patientId: string, rewardId: string, clinicId: string) {
  const { data, error } = await (supabase.from("gamification_resgates") as any)
    .insert([{ paciente_id: patientId, recompensa_id: rewardId, clinica_id: clinicId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPlayerStats(patientId: string, clinicId: string) {
  const { data, error } = await (supabase.from("gamification_pontos") as any)
    .select("pontos")
    .eq("paciente_id", patientId)
    .eq("clinica_id", clinicId);
  if (error) throw error;

  const total = (data ?? []).reduce((sum: number, r: any) => sum + (r.pontos ?? 0), 0);
  const level = getLevel(total);

  return { total_pontos: total, nivel: level.name, proximo_nivel: level.next, threshold: level.threshold };
}

export const gamificationService = {
  getLeaderboard,
  getPlayerAchievements,
  getChallenges,
  getRewardsCatalog,
  redeemReward,
  getPlayerStats,
  getLevel,
};
