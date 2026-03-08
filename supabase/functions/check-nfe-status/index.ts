import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!FOCUS_NFE_TOKEN) {
      return new Response(
        JSON.stringify({ error: "FOCUS_NFE_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { emissao_id } = body;

    // Fetch emissao
    const { data: emissao } = await supabase
      .from("emissoes_nf")
      .select("*")
      .eq("id", emissao_id)
      .single();

    if (!emissao || !emissao.focus_nfe_ref) {
      return new Response(
        JSON.stringify({ error: "Emissão sem referência Focus NFe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch NFe config for ambiente
    const { data: config } = await supabase
      .from("config_nfe")
      .select("ambiente")
      .limit(1)
      .single();

    const baseUrl =
      config?.ambiente === "producao"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";

    // Check status at Focus NFe
    const focusResponse = await fetch(
      `${baseUrl}/v2/nfse/${emissao.focus_nfe_ref}`,
      {
        headers: {
          Authorization: `Basic ${btoa(FOCUS_NFE_TOKEN + ":")}`,
        },
      }
    );

    const focusData = await focusResponse.json();
    const responseBody = await focusResponse.text(); // consume body

    // Update local record
    const updateData: Record<string, unknown> = {
      focus_nfe_status: focusData.status || "desconhecido",
    };

    if (focusData.url) {
      updateData.nf_pdf_url = focusData.url;
    }
    if (focusData.status === "autorizado") {
      updateData.emitida = true;
    }
    if (focusData.erros) {
      updateData.focus_nfe_erro = JSON.stringify(focusData.erros);
    }

    await supabase.from("emissoes_nf").update(updateData).eq("id", emissao_id);

    return new Response(
      JSON.stringify({
        status: focusData.status,
        url: focusData.url || null,
        erros: focusData.erros || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in check-nfe-status:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
