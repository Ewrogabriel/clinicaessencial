
-- Add transcription fields to teleconsulta_sessions
ALTER TABLE public.teleconsulta_sessions
  ADD COLUMN transcricao_bruta TEXT,
  ADD COLUMN resumo_clinico TEXT,
  ADD COLUMN resumo_gerado_em TIMESTAMPTZ;
