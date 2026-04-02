-- Enhanced teleconsult sessions with token auth
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER;
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS notas_sessao TEXT;
ALTER TABLE teleconsulta_sessions ADD COLUMN IF NOT EXISTS participantes_confirmados INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_teleconsulta_session_token ON teleconsulta_sessions(session_token);
