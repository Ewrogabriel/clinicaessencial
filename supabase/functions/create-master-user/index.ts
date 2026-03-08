import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { email, password, nome } = await req.json();

    // Check if master already exists
    const { data: existingRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "master");

    if (existingRoles && existingRoles.length > 0) {
      return new Response(JSON.stringify({ error: "Master user already exists" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError) throw authError;
    const userId = authData.user.id;

    // Ensure profile exists (trigger should create it, but upsert to be safe)
    await adminClient.from("profiles").upsert({
      user_id: userId,
      nome: nome || "Gestor Master",
      email,
    }, { onConflict: "user_id" });

    // Assign master role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role: "master",
    });

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
