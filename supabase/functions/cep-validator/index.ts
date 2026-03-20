import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep } = await req.json();

    if (!cep) {
      return new Response(JSON.stringify({ error: "CEP is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limpar CEP: remover todos os caracteres não numéricos
    const cepNumeros = cep.replace(/\D/g, "");

    // Validar formato: deve ter 8 dígitos
    if (cepNumeros.length !== 8) {
      return new Response(
        JSON.stringify({ 
          error: "CEP must have 8 digits",
          status: "invalid_format"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Consultar ViaCEP
    const viacepResponse = await fetch(
      `https://viacep.com.br/ws/${cepNumeros}/json/`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!viacepResponse.ok) {
      throw new Error(`ViaCEP API error: ${viacepResponse.statusText}`);
    }

    const viacepData = await viacepResponse.json();

    // Verificar se CEP foi encontrado
    if (viacepData.erro) {
      return new Response(
        JSON.stringify({
          error: "CEP not found",
          status: "not_found",
          cep: cepNumeros,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Formatar resposta
    const resultado = {
      status: "success",
      cep: cepNumeros,
      rua: viacepData.logradouro || "",
      bairro: viacepData.bairro || "",
      cidade: viacepData.localidade || "",
      estado: viacepData.uf || "",
      complemento: viacepData.complemento || "",
      ddd: viacepData.ddd || "",
      siafi: viacepData.siafi || "",
      ibge: viacepData.ibge || "",
    };

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
