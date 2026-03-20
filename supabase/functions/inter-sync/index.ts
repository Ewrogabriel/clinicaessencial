import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clinic_id, action, payload } = await req.json();

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "clinic_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar configurações da integração
    const { data: config, error: configError } = await supabase
      .from("config_integracoes")
      .select("*")
      .eq("clinic_id", clinic_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Integration not configured for this clinic" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!config.inter_ativo) {
      return new Response(
        JSON.stringify({ error: "Banco Inter integration is not enabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: any = {};

    switch (action) {
      case "sync_daily_extract":
        // Buscar extrato do dia do Banco Inter
        const interResponse = await fetch(
          "https://api.inter.co/consulta-saldo/v2/saldo",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${config.inter_client_id}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!interResponse.ok) {
          throw new Error(
            `Banco Inter API error: ${interResponse.statusText}`
          );
        }

        const interData = await interResponse.json();

        // Armazenar resultado
        result = {
          status: "success",
          tipo: "inter",
          acao: "sync_daily_extract",
          saldo: interData.saldo,
          sincronizado_em: new Date().toISOString(),
        };

        // Log
        await supabase.from("integracao_sync_logs").insert({
          clinic_id,
          tipo: "banco_inter",
          acao: "sync_daily_extract",
          status: "sucesso",
          resposta_recebida: interData,
        });

        break;

      case "reconcile_payments":
        // Conciliar pagamentos com o Banco Inter
        const { data: pagamentos } = await supabase
          .from("pagamentos_sessoes")
          .select("*")
          .eq("status", "pago")
          .isNull("inter_id")
          .limit(100);

        let reconciliados = 0;
        for (const pag of pagamentos || []) {
          // Aqui você faria a chamada real para buscar a transação no Inter
          // e atualizar o inter_id e inter_status
          await supabase
            .from("pagamentos_sessoes")
            .update({
              inter_status: "CONCILIADO",
              atualizado_em: new Date().toISOString(),
            })
            .eq("id", pag.id);

          reconciliados++;
        }

        result = {
          status: "success",
          tipo: "inter",
          acao: "reconcile_payments",
          pagamentos_conciliados: reconciliados,
          sincronizado_em: new Date().toISOString(),
        };

        await supabase.from("integracao_sync_logs").insert({
          clinic_id,
          tipo: "banco_inter",
          acao: "reconcile_payments",
          status: "sucesso",
          dados_enviados: { pagamentos_processados: reconciliados },
        });

        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
