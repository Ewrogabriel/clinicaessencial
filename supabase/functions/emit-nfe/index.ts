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
    // Auth
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

    // Get Focus NFe API token
    const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");
    if (!FOCUS_NFE_TOKEN) {
      return new Response(
        JSON.stringify({ error: "FOCUS_NFE_TOKEN not configured. Add it in secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { emissao_id, paciente_id, mes_referencia } = body;

    if (!emissao_id || !paciente_id) {
      return new Response(
        JSON.stringify({ error: "emissao_id and paciente_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch NFe config
    const { data: config } = await supabase
      .from("config_nfe")
      .select("*")
      .limit(1)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuração de NF-e não encontrada. Configure em Ajustes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch patient data
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nome, cpf, nf_cnpj_cpf, nf_razao_social, nf_endereco, nf_email, email, endereco, bairro, cidade, estado, cep")
      .eq("id", paciente_id)
      .single();

    if (!paciente) {
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch emissao for valor
    const { data: emissao } = await supabase
      .from("emissoes_nf")
      .select("*")
      .eq("id", emissao_id)
      .single();

    if (!emissao) {
      return new Response(
        JSON.stringify({ error: "Registro de emissão não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Focus NFe NFS-e payload
    const ref = `nfse-${emissao_id.substring(0, 8)}`;
    const cpfCnpj = (paciente.nf_cnpj_cpf || paciente.cpf || "").replace(/\D/g, "");
    const isCnpj = cpfCnpj.length > 11;

    const nfsePayload: Record<string, unknown> = {
      data_emissao: new Date().toISOString(),
      natureza_operacao: "1", // Tributação no município
      prestador: {
        cnpj: (config.prestador_cnpj || "").replace(/\D/g, ""),
        inscricao_municipal: config.prestador_inscricao_municipal || "",
        codigo_municipio: config.prestador_codigo_municipio || "",
      },
      tomador: {
        ...(isCnpj
          ? { cnpj: cpfCnpj, razao_social: paciente.nf_razao_social || paciente.nome }
          : { cpf: cpfCnpj, razao_social: paciente.nf_razao_social || paciente.nome }),
        email: paciente.nf_email || paciente.email || "",
        endereco: {
          logradouro: paciente.nf_endereco || paciente.endereco || "",
          bairro: paciente.bairro || "",
          codigo_municipio: config.prestador_codigo_municipio || "",
          uf: paciente.estado || "",
          cep: (paciente.cep || "").replace(/\D/g, ""),
        },
      },
      servico: {
        aliquota: Number(config.aliquota_iss) || 5,
        discriminacao:
          config.servico_discriminacao_padrao ||
          "Serviços de Fisioterapia e Pilates",
        iss_retido: false,
        item_lista_servico: config.servico_item_lista || "",
        codigo_cnae: config.servico_cnae || "",
        codigo_tributacao_municipio: config.servico_codigo_tributacao || "",
        valor_servicos: Number(emissao.valor),
      },
    };

    // Determine API base URL
    const baseUrl =
      config.ambiente === "producao"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";

    // Call Focus NFe API
    const focusResponse = await fetch(`${baseUrl}/v2/nfse?ref=${ref}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(FOCUS_NFE_TOKEN + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nfsePayload),
    });

    const focusData = await focusResponse.json();

    if (!focusResponse.ok) {
      // Save error to DB
      await supabase
        .from("emissoes_nf")
        .update({
          focus_nfe_ref: ref,
          focus_nfe_status: "erro",
          focus_nfe_erro: JSON.stringify(focusData),
        })
        .eq("id", emissao_id);

      return new Response(
        JSON.stringify({
          error: "Erro na emissão via Focus NFe",
          details: focusData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update emissao record
    await supabase
      .from("emissoes_nf")
      .update({
        focus_nfe_ref: ref,
        focus_nfe_status: focusData.status || "processando",
        emitida: true,
        emitida_em: new Date().toISOString(),
        emitida_por: claimsData.claims.sub,
        // PDF URL will be available after processing - can be fetched via webhook or polling
        nf_pdf_url: focusData.url || null,
      })
      .eq("id", emissao_id);

    return new Response(
      JSON.stringify({
        success: true,
        ref,
        status: focusData.status || "processando",
        message: "NFS-e enviada para processamento. O PDF ficará disponível em instantes.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in emit-nfe:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
