import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { action: string; id: string; confirmacao?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { action, id } = body;

  if (!id || !action) {
    return new Response(JSON.stringify({ error: "id and action are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // action=get: fetch appointment details for the confirmation page
  if (action === "get") {
    const { data: agendamento, error } = await supabase
      .from("agendamentos")
      .select("id, data_horario, confirmacao_presenca, paciente_id, profissional_id, clinic_id")
      .eq("id", id)
      .single();

    if (error || !agendamento) {
      return new Response(JSON.stringify({ error: "Agendamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related data in parallel
    const [pacienteRes, profRes, clinicaRes] = await Promise.all([
      supabase
        .from("pacientes")
        .select("id, nome")
        .eq("id", agendamento.paciente_id)
        .single(),
      supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("user_id", agendamento.profissional_id)
        .single(),
      supabase
        .from("clinicas")
        .select("id, nome, logo_url")
        .eq("id", agendamento.clinic_id)
        .single(),
    ]);

    const result = {
      ...agendamento,
      pacientes: pacienteRes.data ?? null,
      profissionais: profRes.data ? { nome: profRes.data.nome } : { nome: "Profissional" },
      clinicas: clinicaRes.data ?? null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // action=update: update confirmacao_presenca
  if (action === "update") {
    const confirmacao = body.confirmacao;
    if (confirmacao !== "confirmado" && confirmacao !== "cancelado") {
      return new Response(
        JSON.stringify({ error: "confirmacao must be 'confirmado' or 'cancelado'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error } = await supabase
      .from("agendamentos")
      .update({ confirmacao_presenca: confirmacao })
      .eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

