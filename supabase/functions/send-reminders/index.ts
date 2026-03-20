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

    // Find appointments in the next 24-26 hours that haven't been reminded
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const { data: agendamentos, error } = await supabase
      .from("agendamentos")
      .select("id, data_horario, tipo_atendimento, duracao_minutos, paciente_id, profissional_id, pacientes(nome, user_id)")
      .in("status", ["agendado", "confirmado"])
      .gte("data_horario", in24h.toISOString())
      .lte("data_horario", in26h.toISOString());

    if (error) throw error;

    let notificationsCreated = 0;

    for (const ag of agendamentos || []) {
      const paciente = (ag as any).pacientes;
      if (!paciente?.user_id) continue;

      // Check if notification already exists for this appointment
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("user_id", paciente.user_id)
        .eq("tipo", "lembrete_sessao")
        .eq("link", `/minha-agenda`)
        .ilike("resumo", `%${ag.id.substring(0, 8)}%`)
        .maybeSingle();

      if (existing) continue;

      const dataFormatted = new Date(ag.data_horario).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      });

      // Get professional name
      const { data: profProfile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", ag.profissional_id)
        .single();

      const profName = profProfile?.nome || "seu profissional";

      await supabase.from("notificacoes").insert({
        user_id: paciente.user_id,
        tipo: "lembrete_sessao",
        titulo: "Lembrete: Sessão amanhã",
        resumo: `Sua sessão de ${ag.tipo_atendimento} é amanhã às ${dataFormatted.split(", ")[1] || dataFormatted}. [${ag.id.substring(0, 8)}]`,
        conteudo: `Olá ${paciente.nome?.split(" ")[0]}! Lembramos que sua sessão de ${ag.tipo_atendimento} com ${profName} está marcada para ${dataFormatted}. Duração: ${ag.duracao_minutos} minutos.`,
        link: "/minha-agenda",
      });

      notificationsCreated++;
    }

    return new Response(
      JSON.stringify({ success: true, notifications_sent: notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
