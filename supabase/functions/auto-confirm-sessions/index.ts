/**
 * auto-confirm-sessions
 * 
 * Runs as a scheduled cron job (every hour via pg_cron or Supabase Cron).
 * Finds appointments that:
 *   - Are still in status "agendado" or "confirmado"
 *   - Have a data_horario older than 24 hours from now
 * 
 * Marks them as "realizado" automatically.
 * Also creates an in-app notification for the professional.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cutoff: 24 hours ago
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find all appointments that ended 24+ hours ago and haven't been resolved
    const { data: agendamentos, error: fetchError } = await supabase
      .from("agendamentos")
      .select("id, data_horario, tipo_atendimento, profissional_id, paciente_id, clinic_id, pacientes(nome), profiles(nome)")
      .in("status", ["agendado", "confirmado"])
      .lte("data_horario", cutoff);

    if (fetchError) throw fetchError;

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, auto_confirmed: 0, message: "No pending sessions found." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-confirm-sessions] Found ${agendamentos.length} sessions to auto-confirm.`);

    let confirmed = 0;
    const errors: string[] = [];

    for (const ag of agendamentos) {
      try {
        // Mark as "realizado"
        const { error: updateError } = await supabase
          .from("agendamentos")
          .update({
            status: "realizado",
            // Optionally record who auto-confirmed it
            observacoes: `${(ag as any).observacoes ? (ag as any).observacoes + "\n" : ""}[Auto-confirmado pelo sistema após 24h]`,
          })
          .eq("id", ag.id);

        if (updateError) throw updateError;

        confirmed++;

        // Create a notification for the professional
        const profissionalId = (ag as any).profissional_id;
        if (profissionalId) {
          const pacienteNome = (ag as any).pacientes?.nome || "Paciente";
          const dataFormatted = new Date(ag.data_horario).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit",
            hour: "2-digit", minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });

          // Get professional's user_id from profiles
          const { data: profProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("user_id", profissionalId)
            .maybeSingle();

          if (profProfile?.user_id) {
            await supabase.from("notificacoes").insert({
              user_id: profProfile.user_id,
              tipo: "sistema",
              titulo: "Sessão confirmada automaticamente",
              resumo: `A sessão de ${pacienteNome} em ${dataFormatted} foi marcada como realizada automaticamente (24h sem registro).`,
              conteudo: `A sessão de ${ag.tipo_atendimento} do paciente ${pacienteNome}, agendada para ${dataFormatted}, foi automaticamente marcada como "realizada" pois não foi atualizada em 24 horas. Se houve falta ou cancelamento, corrija manualmente na agenda.`,
              link: "/agenda",
            });
          }
        }
      } catch (err: any) {
        console.error(`[auto-confirm-sessions] Error processing appointment ${ag.id}:`, err);
        errors.push(`${ag.id}: ${err.message}`);
      }
    }

    const result = {
      success: true,
      auto_confirmed: confirmed,
      errors: errors.length > 0 ? errors : undefined,
      processed_at: new Date().toISOString(),
    };

    console.log("[auto-confirm-sessions] Done:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[auto-confirm-sessions] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
