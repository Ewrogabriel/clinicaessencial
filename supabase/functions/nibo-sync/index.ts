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

    const { action, clinicId, patientId, financialId } = await req.json();

    if (!clinicId) {
      throw new Error("clinicId is required");
    }

    const { data: config, error: configErr } = await supabase
      .from("config_integracoes")
      .select("nibo_api_key")
      .eq("clinic_id", clinicId)
      .single();

    if (configErr || !config?.nibo_api_key) {
      throw new Error("Nibo API key not found for this clinic");
    }

    const niboKey = config.nibo_api_key;
    const niboBaseUrl = "https://api.nibo.com.br/empresas/v1";

    if (action === "export-patient") {
      if (!patientId) throw new Error("patientId is required for export-patient");

      const { data: patient, error: pErr } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", patientId)
        .single();

      if (pErr || !patient) throw new Error("Patient not found");

      const payload = {
        name: patient.nome,
        email: patient.email,
        phone: patient.telefone,
        document: patient.cpf?.replace(/\D/g, ""),
        address: {
          zipCode: patient.cep,
          street: patient.endereco,
          number: patient.numero,
          neighborhood: patient.bairro,
          city: patient.cidade,
          state: patient.estado,
        }
      };

      const response = await fetch(`${niboBaseUrl}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apitoken": niboKey },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(`Nibo error: ${JSON.stringify(result)}`);

      await supabase.from("pacientes").update({ nibo_client_id: result.id }).eq("id", patientId);

      return new Response(JSON.stringify({ success: true, niboId: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "import-clients") {
      const response = await fetch(`${niboBaseUrl}/customers`, {
        headers: { "apitoken": niboKey }
      });

      const clients = await response.json();
      if (!response.ok) throw new Error(`Nibo error fetching clients`);

      const imported = [];
      const errors = [];

      for (const client of (clients.items || [])) {
        try {
          // Upsert logic: match by CPF (document) or Email using safe parameterized queries
          const { data: byDoc } = await supabase
            .from("pacientes")
            .select("id")
            .eq("cpf", String(client.document))
            .maybeSingle();
          const { data: byEmail } = !byDoc ? await supabase
            .from("pacientes")
            .select("id")
            .eq("email", String(client.email))
            .maybeSingle() : { data: null };
          const existing = byDoc || byEmail;

          if (existing) {
            await supabase.from("pacientes").update({ nibo_client_id: client.id }).eq("id", existing.id);
          } else {
            const { data: newP } = await supabase
              .from("pacientes")
              .insert({
                nome: client.name,
                email: client.email,
                telefone: client.phone,
                cpf: client.document,
                nibo_client_id: client.id,
                clinic_id: clinicId
              })
              .select("id")
              .single();
            imported.push(newP.id);
          }
        } catch (err) {
          errors.push({ name: client.name, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, importedCount: imported.length, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "sync-payment") {
      if (!financialId) throw new Error("financialId is required");

      const { data: payment, error: pErr } = await supabase
        .from("pagamentos")
        .select("*, pacientes(*)")
        .eq("id", financialId)
        .single();

      if (pErr || !payment) throw new Error("Payment not found");

      if (!payment.pacientes?.nibo_client_id) {
        throw new Error("Patient must be synced to Nibo before sending payment");
      }

      const payload = {
        description: payment.descricao || "Sessão de atendimento",
        value: payment.valor,
        dueDate: payment.data_vencimento || payment.created_at,
        customer: { id: payment.pacientes.nibo_client_id },
        category: "Atendimento"
      };

      const response = await fetch(`${niboBaseUrl}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apitoken": niboKey },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(`Nibo error syncing payment: ${JSON.stringify(result)}`);

      await supabase.from("pagamentos").update({ nibo_id: result.id }).eq("id", financialId);

      return new Response(JSON.stringify({ success: true, niboId: result.id }), {
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
