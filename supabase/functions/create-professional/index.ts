import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin/gestor
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "gestor"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, nome, telefone, especialidade, commission_rate, commission_fixed, cor_agenda, registro_profissional, tipo_contratacao, cnpj, cpf, rg, data_nascimento, estado_civil, endereco, numero, bairro, cidade, estado, cep, role, permissions } = body;

    if (!email || !password || !nome) {
      return new Response(JSON.stringify({ error: "Email, senha e nome são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetRole = role || "profissional";

    // Create user with admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Update profile
    await adminClient.from("profiles").update({
      nome,
      email,
      telefone: telefone || null,
      especialidade: especialidade || null,
      commission_rate: commission_rate || 0,
      commission_fixed: commission_fixed || 0,
      cor_agenda: cor_agenda || "#3b82f6",
      registro_profissional: registro_profissional || null,
      tipo_contratacao: tipo_contratacao || null,
      cnpj: cnpj || null,
      cpf: cpf || null,
      rg: rg || null,
      data_nascimento: data_nascimento || null,
      estado_civil: estado_civil || null,
      endereco: endereco || null,
      numero: numero || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
    }).eq("user_id", newUserId);

    // Set role
    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: targetRole,
    });

    // Set permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permRows = permissions.map((resource: string) => ({
        user_id: newUserId,
        resource,
        enabled: true,
      }));
      await adminClient.from("user_permissions").insert(permRows);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
