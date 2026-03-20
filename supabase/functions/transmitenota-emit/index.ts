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

    const { action, clinicId, paymentId } = await req.json();

    if (!clinicId) throw new Error("clinicId is required");

    // Fetch TransmiteNota credentials
    const { data: config, error: configErr } = await supabase
      .from("config_integracoes")
      .select("transmitenota_token")
      .eq("clinic_id", clinicId)
      .single();

    if (configErr || !config?.transmitenota_token) {
      throw new Error("TransmiteNota API token not found");
    }

    const token = config.transmitenota_token;
    const transmitenotaUrl = "https://api.transmitenota.com.br/v2";

    if (action === "emit-nfs") {
      if (!paymentId) throw new Error("paymentId is required");

      const { data: payment, error: pErr } = await supabase
        .from("pagamentos")
        .select("*, pacientes(*), clinicas(*)")
        .eq("id", paymentId)
        .single();

      if (pErr || !payment) throw new Error("Payment or patient data not found");

      const patient = payment.pacientes;
      const clinic = payment.clinicas;

      if (!patient || !clinic) throw new Error("Incomplete data for invoice emission");

      // Construct TransmiteNota payload (Simplified example, mapping depends on municipal requirements)
      const payload = {
        prestador: {
          cnpj: clinic.cnpj?.replace(/\D/g, ""),
          inscricaoMunicipal: "", // Might need another field
        },
        tomador: {
          cpfCnpj: patient.cpf?.replace(/\D/g, ""),
          razaoSocial: patient.nome,
          email: patient.email,
          endereco: {
            logradouro: patient.endereco,
            numero: patient.numero,
            bairro: patient.bairro,
            codigoMunicipio: "", // Usually requires IBGE code, might need a mapping
            uf: patient.estado,
            cep: patient.cep?.replace(/\D/g, ""),
          }
        },
        servico: {
          valorServicos: payment.valor,
          discriminacao: payment.descricao || "Sessão de Fisioterapia/Pilates",
          codigoItemListaServico: "04.03", // Example: Fisioterapia
        }
      };

      const response = await fetch(`${transmitenotaUrl}/EnviarNfse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": token
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(`TransmiteNota Error: ${JSON.stringify(result)}`);

      // Update payment with NFS info
      // result.numeroNota, result.codigoVerificacao, result.urlPdf
      await supabase
        .from("pagamentos")
        .update({
          nfs_id: result.id || result.numeroNota,
          nfs_status: "emitida",
          nfs_url_pdf: result.linkPdf || result.urlPdf
        })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ success: true, nfsId: result.id || result.numeroNota }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
