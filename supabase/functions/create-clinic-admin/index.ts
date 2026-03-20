import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // --- Authentication: verify caller identity ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Authorization: caller must be master or admin ---
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const roles = (callerRoles || []).map((r: { role: string }) => r.role);
    if (!roles.includes('master') && !roles.includes('admin')) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas master ou admin podem criar administradores.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clinic_id, admin_email, admin_nome, clinic_nome } = await req.json();

    if (!clinic_id || !admin_email || !admin_nome) {
      return new Response(
        JSON.stringify({ error: 'clinic_id, admin_email e admin_nome são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If caller is admin (not master), verify they belong to this clinic
    if (!roles.includes('master')) {
      const { data: clinicAccess } = await supabaseAdmin
        .from('clinic_users')
        .select('id')
        .eq('user_id', caller.id)
        .eq('clinic_id', clinic_id)
        .single();

      if (!clinicAccess) {
        return new Response(
          JSON.stringify({ error: 'Você não tem acesso a esta clínica.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate temporary password
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const tempPassword = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Create user in auth
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nome: admin_nome,
      },
    });

    if (createAuthError) {
      console.error('Error creating auth user:', createAuthError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário de autenticação' }),
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
        JSON.stringify({ error: 'Erro ao vincular admin à clínica' }),
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

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Unexpected error:', msg);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
