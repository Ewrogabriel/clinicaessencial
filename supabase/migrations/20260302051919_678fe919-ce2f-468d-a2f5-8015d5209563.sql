
-- Add patient photo and legal guardian fields
ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS tem_responsavel_legal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_rg text,
  ADD COLUMN IF NOT EXISTS responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_email text,
  ADD COLUMN IF NOT EXISTS responsavel_parentesco text,
  ADD COLUMN IF NOT EXISTS responsavel_endereco text;
