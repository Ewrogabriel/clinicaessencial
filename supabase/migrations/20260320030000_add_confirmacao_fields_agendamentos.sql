-- Add confirmation fields to agendamentos table
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS confirmacao_presenca TEXT CHECK (confirmacao_presenca IN ('confirmado', 'cancelado')),
  ADD COLUMN IF NOT EXISTS confirmacao_enviada_at TIMESTAMPTZ;
