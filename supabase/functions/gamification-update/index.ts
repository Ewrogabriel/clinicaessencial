import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { paciente_id, action, agendamento_id } = await req.json();

    if (!paciente_id || !action) {
      return new Response(JSON.stringify({ error: "paciente_id and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pointsAwarded = 0;
    let description = "";

    switch (action) {
      case "checkin":
        pointsAwarded = 5;
        description = "Check-in realizado";
        break;
      case "sessao_realizada":
        pointsAwarded = 10;
        description = "Sessão concluída";
        break;
      case "avaliacao_nps":
        pointsAwarded = 15;
        description = "Avaliação NPS respondida";
        break;
      case "reserva_produto":
        pointsAwarded = 3;
        description = "Reserva de produto";
        break;
      default:
        pointsAwarded = 1;
        description = action;
    }

    // Award points
    await supabase.from("patient_points").insert({
      paciente_id,
      pontos: pointsAwarded,
      origem: action,
      descricao: description,
      agendamento_id: agendamento_id || null,
    });

    // Calculate total points
    const { data: allPoints } = await supabase
      .from("patient_points")
      .select("pontos")
      .eq("paciente_id", paciente_id);
    const totalPoints = (allPoints || []).reduce((s: number, p: any) => s + (p.pontos || 0), 0);

    // Check achievements
    const { data: achievements } = await supabase
      .from("achievements")
      .select("*")
      .eq("ativo", true);

    const { data: unlocked } = await supabase
      .from("patient_achievements")
      .select("achievement_id")
      .eq("paciente_id", paciente_id);
    const unlockedIds = new Set((unlocked || []).map((u: any) => u.achievement_id));

    // Count check-ins
    const { count: checkinCount } = await supabase
      .from("patient_points")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", paciente_id)
      .eq("origem", "checkin");

    const newUnlocks: string[] = [];

    for (const ach of achievements || []) {
      if (unlockedIds.has(ach.id)) continue;

      const cond = ach.condicao as any;
      let met = false;

      if (cond?.tipo === "pontos_totais" && totalPoints >= (cond.quantidade || 0)) met = true;
      if (cond?.tipo === "check_ins" && (checkinCount || 0) >= (cond.quantidade || 0)) met = true;
      if (cond?.tipo === "sessoes" && (checkinCount || 0) >= (cond.quantidade || 0)) met = true;

      if (met) {
        await supabase.from("patient_achievements").insert({
          paciente_id,
          achievement_id: ach.id,
        });
        // Bonus points for achievement
        await supabase.from("patient_points").insert({
          paciente_id,
          pontos: ach.pontos,
          origem: "achievement",
          descricao: `Conquista: ${ach.nome}`,
        });
        newUnlocks.push(ach.nome);
      }
    }

    // Update challenge progress
    const { data: activeChallenges } = await supabase
      .from("patient_challenges")
      .select("*")
      .eq("paciente_id", paciente_id)
      .eq("completado", false);

    for (const pc of activeChallenges || []) {
      const newProgress = pc.progresso + 1;
      const completed = newProgress >= pc.meta;
      await supabase
        .from("patient_challenges")
        .update({
          progresso: newProgress,
          completado: completed,
          completado_em: completed ? new Date().toISOString() : null,
        })
        .eq("id", pc.id);

      if (completed) {
        const { data: challenge } = await supabase
          .from("challenges")
          .select("pontos_recompensa, titulo")
          .eq("id", pc.challenge_id)
          .single();
        if (challenge) {
          await supabase.from("patient_points").insert({
            paciente_id,
            pontos: challenge.pontos_recompensa,
            origem: "challenge",
            descricao: `Desafio: ${challenge.titulo}`,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ points_awarded: pointsAwarded, new_unlocks: newUnlocks, total_points: totalPoints + pointsAwarded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
