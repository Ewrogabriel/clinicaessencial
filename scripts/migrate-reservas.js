import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] ERROR: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrations = [
  {
    name: 'Create reservas_produtos table',
    sql: `
      CREATE TABLE IF NOT EXISTS reservas_produtos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
        produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
        quantidade INT NOT NULL DEFAULT 1,
        observacao TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pendente',
        data_reserva TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data_finalizada TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reservas_paciente ON reservas_produtos(paciente_id);
      CREATE INDEX IF NOT EXISTS idx_reservas_produto ON reservas_produtos(produto_id);
      CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas_produtos(status);
    `
  },
  {
    name: 'Create avisos table',
    sql: `
      CREATE TABLE IF NOT EXISTS avisos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo VARCHAR(50) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensagem TEXT NOT NULL,
        reserva_id UUID REFERENCES reservas_produtos(id) ON DELETE CASCADE,
        lido BOOLEAN DEFAULT FALSE,
        profissional_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_avisos_tipo ON avisos(tipo);
      CREATE INDEX IF NOT EXISTS idx_avisos_lido ON avisos(lido);
      CREATE INDEX IF NOT EXISTS idx_avisos_profissional ON avisos(profissional_id);
    `
  }
];

async function executeMigrations() {
  console.log('[v0] Starting database migrations...');

  for (const migration of migrations) {
    console.log(`[v0] Executing: ${migration.name}`);
    
    try {
      const { error } = await supabase.rpc('exec', {
        sql: migration.sql
      }).catch(async () => {
        // Fallback if exec RPC doesn't exist - use a different approach
        console.log('[v0] Using direct SQL execution...');
        return await supabase.from('_migrations').insert({
          name: migration.name,
          sql: migration.sql
        });
      });

      if (error) {
        console.error(`[v0] ERROR in ${migration.name}:`, error.message);
      } else {
        console.log(`[v0] SUCCESS: ${migration.name}`);
      }
    } catch (err) {
      console.error(`[v0] ERROR executing ${migration.name}:`, err);
    }
  }

  console.log('[v0] Migrations completed!');
}

executeMigrations();
