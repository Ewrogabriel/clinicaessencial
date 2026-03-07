#!/usr/bin/env python3
import os
import psycopg2
from urllib.parse import urlparse

# Get database URL from environment
postgres_url = os.environ.get("POSTGRES_URL")

if not postgres_url:
    print("[v0] ERROR: POSTGRES_URL environment variable not set")
    exit(1)

# Fix Supabase URL format (replace supabase:// with postgres://)
if postgres_url.startswith("supabase://"):
    postgres_url = postgres_url.replace("supabase://", "postgres://", 1)

# Parse URL
parsed = urlparse(postgres_url)
dbname = parsed.path.lstrip('/')
user = parsed.username
password = parsed.password
host = parsed.hostname
port = parsed.port or 5432

print(f"[v0] Connecting to {host}:{port}/{dbname}")

try:
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port,
        sslmode='require'
    )
    
    cursor = conn.cursor()
    
    # SQL for creating tables
    sql = """
-- Create reservas_produtos table for product reservations
CREATE TABLE IF NOT EXISTS reservas_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'finalizado', 'cancelado')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservas_produtos_paciente_id ON reservas_produtos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_produtos_produto_id ON reservas_produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_produtos_status ON reservas_produtos(status);

CREATE TABLE IF NOT EXISTS avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(100) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  dados_json JSONB,
  lido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_avisos_tipo ON avisos(tipo);
CREATE INDEX IF NOT EXISTS idx_avisos_profissional_id ON avisos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_avisos_lido ON avisos(lido);
"""
    
    cursor.execute(sql)
    conn.commit()
    
    print("[v0] SUCCESS: Tables created successfully!")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"[v0] ERROR: {str(e)}")
    exit(1)
