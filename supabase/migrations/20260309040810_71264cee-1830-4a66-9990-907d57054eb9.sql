-- Adicionar coluna evolution_id e notas_pos_consulta à tabela teleconsulta_sessions
ALTER TABLE public.teleconsulta_sessions
ADD COLUMN IF NOT EXISTS evolution_id UUID REFERENCES public.evolutions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notas_pos_consulta TEXT;