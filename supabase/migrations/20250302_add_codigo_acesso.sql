-- Add codigo_acesso column to pacientes table for patient access codes
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS codigo_acesso VARCHAR(8) UNIQUE;

-- Create table for patient sessions to track login history
CREATE TABLE IF NOT EXISTS paciente_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
  remember_me BOOLEAN DEFAULT false,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pacientes_codigo_acesso ON pacientes(codigo_acesso);

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_paciente_sessions_token ON paciente_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_paciente_sessions_paciente_id ON paciente_sessions(paciente_id);
