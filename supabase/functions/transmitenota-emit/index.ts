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

    if (!config.transmitenota_ativo || !config.transmitenota_token) {
      return new Response(
        JSON.stringify({ error: "TransmiteNota integration is not enabled or not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: any = {};

    switch (action) {
      case "emit_nfse":
        // Emitir NFS-e para um pagamento realizado
        const { pagamento_id } = payload;

        if (!pagamento_id) {
          return new Response(
            JSON.stringify({ error: "pagamento_id is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: pagamento } = await supabase
          .from("pagamentos_sessoes")
          .select(
            "*, pacientes(nome, cpf, email, telefone, cep, rua, numero, bairro, cidade, estado)"
          )
          .eq("id", pagamento_id)
          .single();

        if (!pagamento) {
          return new Response(
            JSON.stringify({ error: "Payment not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Buscar clínica
        const { data: clinic } = await supabase
          .from("clinicas")
          .select("*")
          .eq("id", clinic_id)
          .single();

        const nfsPayload = {
          numero_rps: Math.floor(Math.random() * 999999999),
          serie_rps: "1",
          tipo_rps: "1", // 1 = RPS, 2 = Recibo
          data_emissao: new Date().toISOString().split("T")[0],
          
          // Serviço
          codigo_servico: "1406",
          descricao: pagamento.descricao || "Serviço de saúde",
          valor_servico: Number(pagamento.valor).toFixed(2),
          valor_deducoes: "0.00",
          valor_pis: "0.00",
          valor_cofins: "0.00",
          valor_inss: "0.00",
          valor_ir: "0.00",
          value_csll: "0.00",
          valor_iss: (Number(pagamento.valor) * 0.05).toFixed(2), // 5% de ISS padrão
          valor_liquido: (Number(pagamento.valor) * 0.95).toFixed(2),
          
          // Prestador
          cnpj_prestador: config.transmitenota_cnpj_tomador,
          nome_prestador: clinic?.nome || "Clínica",
          inscricao_municipal: clinic?.inscricao_municipal || "",
          endereco_prestador: {
            endereco: clinic?.endereco || "",
            numero: clinic?.numero || "",
            bairro: clinic?.bairro || "",
            cidade: clinic?.cidade || "",
            uf: clinic?.estado || "",
            cep: clinic?.cep || "",
          },

          // Tomador (paciente)
          cpf_cnpj_tomador: pagamento.pacientes?.cpf?.replace(/\D/g, "") || "",
          nome_tomador: pagamento.pacientes?.nome || "Paciente",
          endereco_tomador: {
            endereco: pagamento.pacientes?.rua || "",
            numero: pagamento.pacientes?.numero || "",
            complemento: pagamento.pacientes?.complemento || "",
            bairro: pagamento.pacientes?.bairro || "",
            cidade: pagamento.pacientes?.cidade || "",
            uf: pagamento.pacientes?.estado || "",
            cep: pagamento.pacientes?.cep || "",
          },
          email_tomador: pagamento.pacientes?.email || "",
          telefone_tomador: pagamento.pacientes?.telefone || "",
        };

        try {
          const apiUrl =
            config.transmitenota_ambiente === "producao"
              ? "https://api.transmitenotajs.com.br/api/v2"
              : "https://api-homolog.transmitenotajs.com.br/api/v2";

          const nfsResponse = await fetch(`${apiUrl}/nfse`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.transmitenota_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(nfsPayload),
          });

          if (!nfsResponse.ok) {
            const errorData = await nfsResponse.json();
            throw new Error(
              `TransmiteNota API error: ${errorData.message || nfsResponse.statusText}`
            );
          }

          const nfsData = await nfsResponse.json();

          // Atualizar pagamento com dados da NFS-e
          await supabase
            .from("pagamentos_sessoes")
            .update({
              nfs_id: nfsData.id || nfsData.numero,
              nfs_status: "emitida",
              nfs_url_pdf: nfsData.pdf_url || nfsData.url_pdf,
              nfs_emissao_em: new Date().toISOString(),
            })
            .eq("id", pagamento_id);

          result = {
            status: "success",
            tipo: "transmitenota",
            acao: "emit_nfse",
            nfs_id: nfsData.id || nfsData.numero,
            nfs_numero: nfsData.numero,
            nfs_url_pdf: nfsData.pdf_url || nfsData.url_pdf,
            sincronizado_em: new Date().toISOString(),
          };

          await supabase.from("integracao_sync_logs").insert({
            clinic_id,
            tipo: "transmitenota",
            acao: "emit_nfse",
            status: "sucesso",
            resposta_recebida: nfsData,
          });
        } catch (err) {
          const errorMsg = (err as Error).message;

          await supabase.from("integracao_sync_logs").insert({
            clinic_id,
            tipo: "transmitenota",
            acao: "emit_nfse",
            status: "erro",
            erro_mensagem: errorMsg,
            dados_enviados: nfsPayload,
          });

          throw err;
        }

        break;

      case "cancel_nfse":
        // Cancelar NFS-e emitida
        const { nfs_id } = payload;

        if (!nfs_id) {
          return new Response(
            JSON.stringify({ error: "nfs_id is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        try {
          const apiUrl =
            config.transmitenota_ambiente === "producao"
              ? "https://api.transmitenotajs.com.br/api/v2"
              : "https://api-homolog.transmitenotajs.com.br/api/v2";

          const cancelResponse = await fetch(`${apiUrl}/nfse/${nfs_id}/cancel`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${config.transmitenota_token}`,
              "Content-Type": "application/json",
            },
          });

          if (!cancelResponse.ok) {
            const errorData = await cancelResponse.json();
            throw new Error(
              `TransmiteNota cancel error: ${errorData.message || cancelResponse.statusText}`
            );
          }

          const cancelData = await cancelResponse.json();

          // Atualizar status do pagamento
          await supabase
            .from("pagamentos_sessoes")
            .update({
              nfs_status: "cancelada",
            })
            .eq("nfs_id", nfs_id);

          result = {
            status: "success",
            tipo: "transmitenota",
            acao: "cancel_nfse",
            nfs_id,
            mensagem: "NFS-e cancelada com sucesso",
            sincronizado_em: new Date().toISOString(),
          };

          await supabase.from("integracao_sync_logs").insert({
            clinic_id,
            tipo: "transmitenota",
            acao: "cancel_nfse",
            status: "sucesso",
            resposta_recebida: cancelData,
          });
        } catch (err) {
          const errorMsg = (err as Error).message;

          await supabase.from("integracao_sync_logs").insert({
            clinic_id,
            tipo: "transmitenota",
            acao: "cancel_nfse",
            status: "erro",
            erro_mensagem: errorMsg,
          });

          throw err;
        }

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
