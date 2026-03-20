ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS identidade_genero text,
  ADD COLUMN IF NOT EXISTS nome_social text;