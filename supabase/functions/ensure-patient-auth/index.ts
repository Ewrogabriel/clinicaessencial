// Ensure that a patient (identified by codigo_acesso) has a Supabase Auth account.
// Creates one if missing, links it to pacientes.user_id and to a clinic via clinic_pacientes.
// Returns the email/password that the client can then use to signInWithPassword().
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { codigo_acesso } = await req.json();
    if (!codigo_acesso || typeof codigo_acesso !== "string") {
      return json({ error: "Código de acesso é obrigatório" }, 400);
    }
    const code = codigo_acesso.trim().toUpperCase();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1. Find patient
    const { data: pacientes, error: pErr } = await admin
      .from("pacientes")
      .select("id, nome, cpf, user_id")
      .eq("codigo_acesso", code)
      .limit(1);

    if (pErr) return json({ error: "Erro ao buscar paciente: " + pErr.message }, 500);
    if (!pacientes || pacientes.length === 0) {
      return json({ error: "Código de acesso inválido" }, 404);
    }

    const paciente = pacientes[0];
    const cpfClean = (paciente.cpf || "").replace(/\D/g, "");
    if (!cpfClean || cpfClean.length !== 11) {
      return json({ error: "Paciente sem CPF válido. Procure a clínica." }, 400);
    }

    const email = `${cpfClean}@paciente.essencial.com`;
    const password = cpfClean;

    // 2. Make sure auth user exists
    let userId = paciente.user_id as string | null;

    if (!userId) {
      // Try to find existing auth user by email (in case user_id wasn't linked)
      const { data: existing } = await (admin.auth.admin as any).listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      if (found) {
        userId = found.id;
        // Reset password to make sure CPF works
        await admin.auth.admin.updateUserById(found.id, { password });
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome: paciente.nome, paciente_id: paciente.id },
        });
        if (cErr || !created.user) {
          return json({ error: "Falha ao criar conta: " + (cErr?.message || "desconhecido") }, 500);
        }
        userId = created.user.id;
      }

      // Link user_id to pacientes
      await admin.from("pacientes").update({ user_id: userId }).eq("id", paciente.id);
    }

    // 3. Ensure paciente role
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "paciente" as any },
      { onConflict: "user_id,role" }
    );

    // 4. Ensure patient is linked to at least one clinic.
    //    If not, attach to the clinic of the professional that created the record (best-effort).
    const { data: linked } = await admin
      .from("clinic_pacientes")
      .select("id")
      .eq("paciente_id", paciente.id)
      .limit(1);

    if (!linked || linked.length === 0) {
      const { data: pacFull } = await admin
        .from("pacientes")
        .select("created_by, profissional_id")
        .eq("id", paciente.id)
        .single();

      const ownerId = (pacFull as any)?.created_by ?? (pacFull as any)?.profissional_id;
      if (ownerId) {
        const { data: ownerClinics } = await admin
          .from("clinic_users")
          .select("clinic_id")
          .eq("user_id", ownerId)
          .limit(1);

        const clinicId = ownerClinics?.[0]?.clinic_id;
        if (clinicId) {
          await admin
            .from("clinic_pacientes")
            .insert({ clinic_id: clinicId, paciente_id: paciente.id });
        }
      }
    }

    return json({ ok: true, email, password, paciente: { id: paciente.id, nome: paciente.nome } });
  } catch (e: any) {
    console.error("[ensure-patient-auth] error", e);
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
