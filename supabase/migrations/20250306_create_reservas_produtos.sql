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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reservas_produtos_paciente_id ON reservas_produtos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_produtos_produto_id ON reservas_produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_produtos_status ON reservas_produtos(status);

-- Create avisos table if not exists (for admin notifications)
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

-- Create index for avisos
CREATE INDEX IF NOT EXISTS idx_avisos_tipo ON avisos(tipo);
CREATE INDEX IF NOT EXISTS idx_avisos_profissional_id ON avisos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_avisos_lido ON avisos(lido);
