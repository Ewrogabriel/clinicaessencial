import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, clinicId, dataInicio, dataFim } = await req.json();

    if (!clinicId) throw new Error("clinicId is required");

    // Fetch Inter credentials
    const { data: config, error: configErr } = await supabase
      .from("config_integracoes")
      .select("inter_client_id, inter_client_secret")
      .eq("clinic_id", clinicId)
      .single();

    if (configErr || !config?.inter_client_id) {
      throw new Error("Banco Inter configuration not found");
    }

    // Get Certificate and Key from Environment (Secrets)
    // These should be set via `supabase secrets set INTER_CERT="---BEGIN CERTIFICATE---..."`
    const cert = Deno.env.get("INTER_CERT");
    const key = Deno.env.get("INTER_KEY");

    if (!cert || !key) {
      throw new Error("Banco Inter Certificate or Key not found in Environment Secrets");
    }

    // Initialize HTTP Client with mTLS
    const httpClient = Deno.createHttpClient({
      cert: cert,
      privateKey: key,
    });

    const interBaseUrl = "https://cdpj.partners.bancointer.com.br";

    // 1. Get OAuth2 Token
    const authPayload = new URLSearchParams({
      client_id: config.inter_client_id,
      client_secret: config.inter_client_secret,
      grant_type: "client_credentials",
      scope: "extrato.read" 
    });

    const tokenResponse = await fetch(`${interBaseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: authPayload,
      client: httpClient,
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`Banco Inter Auth Error: ${JSON.stringify(tokenData)}`);

    const accessToken = tokenData.access_token;

    if (action === "fetch-extrato") {
      const start = dataInicio || new Date().toISOString().split("T")[0];
      const end = dataFim || new Date().toISOString().split("T")[0];

      const extratoResponse = await fetch(
        `${interBaseUrl}/banking/v2/extrato?dataInicio=${start}&dataFim=${end}`,
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
          client: httpClient,
        }
      );

      const extrato = await extratoResponse.json();
      if (!extratoResponse.ok) throw new Error(`Banco Inter Extrato Error: ${JSON.stringify(extrato)}`);

      // Reconciliation Logic (Simple Match)
      const matches = [];
      for (const item of (extrato.transacoes || [])) {
        if (item.tipoLancamento === "CREDITO") {
          // Attempt to match by exact value and date with pending payments
          const { data: possiblePayments } = await supabase
            .from("pagamentos")
            .select("*, pacientes(*)")
            .eq("valor", Math.abs(item.valor))
            .eq("status", "pendente");

          if (possiblePayments && possiblePayments.length > 0) {
            // Further matching logic could go here (e.g., description match or CPF)
            matches.push({
              extrato: item,
              possibleMatches: possiblePayments.map(p => ({ id: p.id, patient: p.pacientes?.nome }))
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, transacoes: extrato.transacoes, matches }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Invalid action or missing implementation");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
