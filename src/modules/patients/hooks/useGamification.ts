import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useGamification = (pacienteId: string | null, enabled = true) => {
    const isEnabled = !!pacienteId && enabled;

    const { data: totalPoints = 0 } = useQuery({
        queryKey: ["patient-total-points", pacienteId],
        queryFn: async () => {
            const { data } = await supabase
                .from("patient_points")
                .select("pontos")
                .eq("paciente_id", pacienteId!);
            return (data || []).reduce((sum, p) => sum + (p.pontos || 0), 0);
        },
        staleTime: 1000 * 60, // 1 minuto
        enabled: isEnabled,
    });

    const { data: pointsHistory = [] } = useQuery({
        queryKey: ["patient-points-history", pacienteId],
        queryFn: async () => {
            const { data } = await supabase
                .from("patient_points")
                .select("id, pontos, descricao, created_at, tipo")
                .eq("paciente_id", pacienteId!)
                .order("created_at", { ascending: false })
                .limit(20);
            return data || [];
        },
        staleTime: 1000 * 60, // 1 minuto
        enabled: isEnabled,
    });

    const { data: unlockedAchievements = [] } = useQuery({
        queryKey: ["patient-unlocked-achievements", pacienteId],
        queryFn: async () => {
            const { data } = await supabase
                .from("patient_achievements")
                .select("*, achievements(*)")
                .eq("paciente_id", pacienteId!);
            return data || [];
        },
        staleTime: 1000 * 60, // 1 minuto
        enabled: isEnabled,
    });

    const { data: allAchievements = [] } = useQuery({
        queryKey: ["all-achievements"],
        queryFn: async () => {
            const { data } = await supabase
                .from("achievements")
                .select("id, titulo, descricao, pontos, ativo, badge_icon, condicao_tipo, condicao_valor")
                .eq("ativo", true)
                .order("pontos", { ascending: true });
            return data || [];
        },
        staleTime: 1000 * 60, // 1 minuto
        enabled: isEnabled,
    });

    const { data: activeChallenges = [] } = useQuery({
        queryKey: ["patient-active-challenges", pacienteId],
        queryFn: async () => {
            const today = new Date().toISOString().split("T")[0];
            const { data: challenges } = await (supabase as any)
                .from("challenges")
                .select("id, titulo, descricao, pontos_recompensa, ativo, data_inicio, data_fim, tipo, meta, badge_icon")
                .eq("ativo", true)
                .lte("data_inicio", today)
                .gte("data_fim", today);

            if (!challenges?.length) return [];

            const { data: progress } = await (supabase as any)
                .from("patient_challenges")
                .select("id, challenge_id, paciente_id, progresso_atual, concluido, concluido_em")
                .eq("paciente_id", pacienteId!)
                .in("challenge_id", challenges.map((c) => c.id));

            const progressMap = new Map((progress || []).map((p) => [p.challenge_id, p]));

            return challenges.map((c) => ({
                ...c,
                progress: progressMap.get(c.id) || null,
            }));
        },
        staleTime: 1000 * 60, // 1 minuto
        enabled: isEnabled,
    });

    const { data: ranking = [] } = useQuery({
        queryKey: ["gamification-ranking"],
        queryFn: async () => {
            const { data } = await supabase.rpc("get_gamification_ranking", { limit_count: 10 });
            return data || [];
        },
        enabled: isEnabled,
    });

    return {
        totalPoints,
        pointsHistory,
        unlockedAchievements,
        allAchievements,
        activeChallenges,
        ranking,
    };
};
