#!/usr/bin/env python3
import os
import sys

# Install psycopg2 if needed
try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("[v0] Installing psycopg2-binary...")
    os.system("pip install psycopg2-binary")
    import psycopg2
    from psycopg2 import sql

# Get database URL from environment
postgres_url = os.environ.get("POSTGRES_URL")

if not postgres_url:
    print("[v0] ERROR: POSTGRES_URL environment variable not set")
    sys.exit(1)

# Fix Supabase URL format (replace supabase:// with postgres://)
if postgres_url.startswith("supabase://"):
    postgres_url = postgres_url.replace("supabase://", "postgres://", 1)

print(f"[v0] Connecting to database...")

try:
    # Connect to database
    conn = psycopg2.connect(postgres_url)
    cursor = conn.cursor()
    
    print("[v0] Executing migration 1: base_tables...")
    
    # Migration 1: Create base tables
    migration_1 = """
    -- Users table for professionals/admins
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'professional',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Pacientes table
    CREATE TABLE IF NOT EXISTS pacientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      telefone VARCHAR(20),
      cpf VARCHAR(11) UNIQUE,
      data_nascimento DATE,
      endereco TEXT,
      sexo VARCHAR(10),
      profissional_id UUID REFERENCES users(id),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Patient sessions table for tracking access
    CREATE TABLE IF NOT EXISTS paciente_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
      session_token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_pacientes_profissional_id ON pacientes(profissional_id);
    CREATE INDEX IF NOT EXISTS idx_pacientes_created_by ON pacientes(created_by);
    CREATE INDEX IF NOT EXISTS idx_paciente_sessions_paciente_id ON paciente_sessions(paciente_id);
    CREATE INDEX IF NOT EXISTS idx_paciente_sessions_token ON paciente_sessions(session_token);
    """
    
    cursor.execute(migration_1)
    conn.commit()
    print("[v0] ✓ Migration 1 completed successfully")
    
    print("[v0] Executing migration 2: add_codigo_acesso...")
    
    # Migration 2: Add codigo_acesso column
    migration_2 = """
    ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS codigo_acesso VARCHAR(8) UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_pacientes_codigo_acesso ON pacientes(codigo_acesso);
    """
    
    cursor.execute(migration_2)
    conn.commit()
    print("[v0] ✓ Migration 2 completed successfully")
    
    cursor.close()
    conn.close()
    
    print("[v0] ✓ All migrations executed successfully!")
    
except psycopg2.Error as e:
    print(f"[v0] Database error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[v0] Error: {e}")
    sys.exit(1)
