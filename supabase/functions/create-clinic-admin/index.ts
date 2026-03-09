import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { clinic_id, admin_email, admin_nome, clinic_nome } = await req.json();

    if (!clinic_id || !admin_email || !admin_nome) {
      return new Response(
        JSON.stringify({ error: 'clinic_id, admin_email e admin_nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase();

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nome: admin_nome,
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário de autenticação', details: authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        nome: admin_nome,
        email: admin_email,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    }

    // Add to clinic_users as admin
    const { error: clinicUserError } = await supabaseAdmin
      .from('clinic_users')
      .insert({
        user_id: userId,
        clinic_id: clinic_id,
        role: 'admin',
      });

    if (clinicUserError) {
      console.error('Error adding to clinic_users:', clinicUserError);
      return new Response(
        JSON.stringify({ error: 'Erro ao vincular admin à clínica', details: clinicUserError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add admin role in user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'admin',
      });

    if (roleError) {
      console.error('Error adding admin role:', roleError);
    }

    console.log(`Admin created successfully for clinic ${clinic_nome}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: admin_email,
        tempPassword: tempPassword,
        message: 'Administrador criado com sucesso. Compartilhe as credenciais de forma segura.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
