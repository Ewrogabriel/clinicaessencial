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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { cpf, nome, paciente_id } = await req.json();

    if (!cpf || !nome) {
      return new Response(
        JSON.stringify({ error: "CPF e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF deve conter 11 dígitos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = `${cleanCpf}@paciente.essencial.com`;
    const defaultPassword = cleanCpf;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    if (existingUser) {
      // Link patient to existing user
      if (paciente_id) {
        await supabaseAdmin
          .from("pacientes")
          .update({ user_id: existingUser.id })
          .eq("id", paciente_id);
      }

      // Ensure paciente role exists
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: existingUser.id, role: "paciente" },
        { onConflict: "user_id,role" }
      );

      return new Response(
        JSON.stringify({ message: "Conta já existe", user_id: existingUser.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add paciente role
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: "paciente",
    });

    // Link paciente record to new auth user
    if (paciente_id) {
      await supabaseAdmin
        .from("pacientes")
        .update({ user_id: newUser.user.id })
        .eq("id", paciente_id);
    }

    return new Response(
      JSON.stringify({ message: "Conta criada com sucesso", user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
