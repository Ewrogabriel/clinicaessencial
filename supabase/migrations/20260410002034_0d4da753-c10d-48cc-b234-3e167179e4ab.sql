ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS tipo_sessao TEXT DEFAULT 'grupo';

UPDATE public.matriculas SET tipo_sessao = 'grupo' WHERE tipo_sessao IS NULL;